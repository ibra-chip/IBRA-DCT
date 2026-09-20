import * as path from 'node:path';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto, CreatePurchaseDto } from './dto';
import { extractDevisFields, extractInvoiceFields, inspectDevisWithGemini, parseAmount } from './devis-extraction.util';
import { parsePdfText } from './pdf-text.util';
import { budgetUploadDir } from './upload.config';

const managerRoles = new Set(['admin', 'manager', 'gerant']);
const purchaseCategories = ['material', 'tools', 'machines', 'workers', 'subcontracting', 'other'];

type UploadedFile = Express.Multer.File;

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  private companyScope(user: AuthenticatedUser) {
    return user.companyId ?? '__missing_company__';
  }

  private assertManager(user: AuthenticatedUser) {
    if (!managerRoles.has(user.role)) {
      throw new ForbiddenException('Only company managers can change the budget.');
    }
  }

  private async getProject(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId: this.companyScope(user) },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  async getBudget(projectId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    const budget = await this.prisma.projectBudget.findUnique({ where: { projectId } });
    return budget ?? { projectId, status: 'missing', total: 0, spent: 0, remaining: 0 };
  }

  async inspectDevis(projectId: string, user: AuthenticatedUser, file?: UploadedFile) {
    await this.getProject(projectId, user);
    if (!file) throw new BadRequestException('A Devis PDF is required');

    const text = await parsePdfText(file.buffer);
    const extracted = extractDevisFields(text);
    let source = file.originalname;

    if (!extracted.number || !extracted.client || !extracted.chantier || !extracted.total) {
      const ai = await inspectDevisWithGemini(file);
      if (ai) {
        extracted.number = extracted.number || String(ai.number || '');
        extracted.client = extracted.client || String(ai.client || '');
        extracted.chantier = extracted.chantier || String(ai.chantier || '');
        extracted.total = extracted.total || parseAmount(ai.total);
        source = `${file.originalname} · Gemini`;
      }
    }

    return {
      extracted,
      textFound: text.length > 0,
      needsConfirmation: !extracted.number || !extracted.client || !extracted.chantier || !extracted.total,
      source,
      aiFallbackUsed: source.includes('Gemini'),
    };
  }

  async createBudget(projectId: string, user: AuthenticatedUser, dto: CreateBudgetDto, file?: UploadedFile) {
    this.assertManager(user);
    const project = await this.getProject(projectId, user);
    if (!file) throw new BadRequestException('A Devis PDF is required');

    const existing = await this.prisma.projectBudget.findUnique({ where: { projectId } });
    if (existing?.devisNumber && dto.devisNumber !== existing.devisNumber && dto.replaceExisting !== 'true') {
      throw new ConflictException('An active Devis already exists. Confirm replacement explicitly.');
    }

    const data = {
      chantierName: dto.chantierName || project.name,
      devisNumber: dto.devisNumber || '',
      client: dto.client || '',
      total: dto.total,
      spent: 0,
      remaining: dto.total,
      sourceFile: file.filename,
      sourceName: file.originalname,
      status: 'uploaded',
      uploadedBy: user.userId,
    };

    return this.prisma.projectBudget.upsert({
      where: { projectId },
      update: data,
      create: { projectId, ...data },
    });
  }

  async getBudgetDocumentPath(projectId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    const budget = await this.prisma.projectBudget.findUnique({ where: { projectId } });
    if (!budget?.sourceFile) throw new NotFoundException('No devis document stored for this project');
    return { filePath: path.join(budgetUploadDir, budget.sourceFile), fileName: budget.sourceName || budget.sourceFile };
  }

  async listPurchases(projectId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    return this.prisma.purchase.findMany({ where: { projectId }, orderBy: { purchaseDate: 'desc' } });
  }

  async inspectInvoice(projectId: string, user: AuthenticatedUser, file?: UploadedFile) {
    await this.getProject(projectId, user);
    if (!file) throw new BadRequestException('An invoice PDF is required');

    const text = await parsePdfText(file.buffer);
    const extracted = extractInvoiceFields(text);
    return { textFound: text.length > 0, extracted, source: file.originalname, needsOcr: text.length === 0 };
  }

  async createPurchase(projectId: string, user: AuthenticatedUser, dto: CreatePurchaseDto, file?: UploadedFile) {
    this.assertManager(user);
    await this.getProject(projectId, user);
    if (!file) throw new BadRequestException('A purchase invoice PDF is required');

    return this.prisma.purchase.create({
      data: {
        projectId,
        createdBy: user.userId,
        category: dto.category,
        supplier: dto.supplier,
        description: dto.description,
        amount: dto.amount,
        purchaseDate: new Date(dto.purchaseDate || new Date().toISOString().slice(0, 10)),
        invoiceKey: file.filename,
        invoiceName: file.originalname,
      },
    });
  }

  async getPurchaseInvoicePath(projectId: string, purchaseId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    const purchase = await this.prisma.purchase.findFirst({ where: { id: purchaseId, projectId } });
    if (!purchase?.invoiceKey) throw new NotFoundException('No invoice stored for this purchase');
    return { filePath: path.join(budgetUploadDir, purchase.invoiceKey), fileName: purchase.invoiceName || purchase.invoiceKey };
  }

  async financialSummary(projectId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);

    const [budget, purchases, approvedTimeEntries] = await Promise.all([
      this.prisma.projectBudget.findUnique({ where: { projectId } }),
      this.prisma.purchase.findMany({ where: { projectId } }),
      this.prisma.timeEntry.findMany({ where: { projectId, status: 'approved' } }),
    ]);

    const purchaseTotals = Object.fromEntries(
      purchaseCategories.map((category) => [
        category,
        purchases.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0),
      ]),
    );
    const purchaseTotal = Object.values(purchaseTotals).reduce((sum, amount) => sum + amount, 0);
    const approvedWorkHours = approvedTimeEntries.reduce((sum, item) => sum + item.hours, 0);
    const approvedLaborTotal = approvedTimeEntries.reduce((sum, item) => sum + item.workAmount, 0);
    const spent = purchaseTotal + approvedLaborTotal;

    return {
      projectId,
      budget: budget?.total || 0,
      purchases: purchaseTotal,
      approvedWorkHours,
      approvedLaborTotal,
      breakdown: { ...purchaseTotals, approvedLabor: approvedLaborTotal, approvedWorkHours },
      spent,
      remaining: budget ? budget.total - spent : null,
      budgetStatus: budget ? 'available' : 'missing',
    };
  }
}
