import * as path from 'node:path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { uploadDir } from '../common/upload.util';
import { CreateWorkReportDto, UpdateWorkReportStatusDto } from './dto';
import { estimateQuantityWithGemini } from './quantity-estimate.util';

const managerRoles = new Set(['admin', 'manager', 'gerant']);

type UploadedFile = Express.Multer.File;

@Injectable()
export class WorkReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private companyScope(user: AuthenticatedUser) {
    return user.companyId ?? '__missing_company__';
  }

  private isManager(user: AuthenticatedUser) {
    return managerRoles.has(user.role);
  }

  private assertManager(user: AuthenticatedUser) {
    if (!this.isManager(user)) {
      throw new ForbiddenException('Only company managers can review work reports.');
    }
  }

  private async getProject(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId: this.companyScope(user) },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  async estimateQuantity(projectId: string, user: AuthenticatedUser, quantityUnit: 'm2' | 'ml', file?: UploadedFile) {
    await this.getProject(projectId, user);
    if (!file) throw new BadRequestException('A work photo is required');
    return estimateQuantityWithGemini(file, quantityUnit);
  }

  async create(projectId: string, user: AuthenticatedUser, dto: CreateWorkReportDto, file?: UploadedFile) {
    await this.getProject(projectId, user);
    if (!file) throw new BadRequestException('A work photo is required');

    return this.prisma.workReport.create({
      data: {
        projectId,
        workerId: user.userId,
        title: dto.description.slice(0, 120),
        description: dto.description,
        date: new Date(dto.date),
        capturedAt: new Date(dto.capturedAt),
        locationName: dto.locationName,
        latitude: dto.latitude,
        longitude: dto.longitude,
        quantityUnit: dto.quantityUnit,
        quantity: dto.quantity,
        unitRate: dto.unitRate,
        calculatedAmount: dto.quantity * dto.unitRate,
        photoKey: file.filename,
        photoName: file.originalname,
        aiStatus: dto.m2Source === 'ai' ? 'estimated' : 'manual',
        m2Source: dto.m2Source,
      },
    });
  }

  async findAll(projectId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    const manager = this.isManager(user);

    const reports = await this.prisma.workReport.findMany({
      where: { projectId, ...(manager ? {} : { workerId: user.userId }) },
      orderBy: { date: 'desc' },
    });

    if (manager) return reports;
    return reports.map(({ unitRate: _unitRate, calculatedAmount: _calculatedAmount, ...report }) => report);
  }

  async updateStatus(projectId: string, reportId: string, user: AuthenticatedUser, dto: UpdateWorkReportStatusDto) {
    this.assertManager(user);
    await this.getProject(projectId, user);
    const report = await this.prisma.workReport.findFirst({ where: { id: reportId, projectId } });
    if (!report) throw new NotFoundException(`Work report ${reportId} not found`);

    return this.prisma.workReport.update({
      where: { id: reportId },
      data: { status: dto.status, reviewedBy: user.userId, reviewedAt: new Date() },
    });
  }

  async getPhotoPath(projectId: string, reportId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    const manager = this.isManager(user);
    const report = await this.prisma.workReport.findFirst({
      where: { id: reportId, projectId, ...(manager ? {} : { workerId: user.userId }) },
    });
    if (!report) throw new NotFoundException(`Work report ${reportId} not found`);
    return { filePath: path.join(uploadDir, report.photoKey), fileName: report.photoName || report.photoKey };
  }

  async situationSummary(projectId: string, user: AuthenticatedUser, month?: string, date?: string) {
    await this.getProject(projectId, user);
    const manager = this.isManager(user);
    const period = month || new Date().toISOString().slice(0, 7);

    const reports = await this.prisma.workReport.findMany({
      where: {
        projectId,
        status: 'approved',
        ...(date
          ? { date: { gte: new Date(`${date}T00:00:00.000Z`), lt: new Date(`${date}T23:59:59.999Z`) } }
          : { date: { gte: new Date(`${period}-01T00:00:00.000Z`), lt: new Date(new Date(`${period}-01T00:00:00.000Z`).getFullYear(), new Date(`${period}-01T00:00:00.000Z`).getMonth() + 1, 1) } }),
      },
    });

    const quantityM2 = reports.filter((r) => r.quantityUnit === 'm2').reduce((sum, r) => sum + r.quantity, 0);
    const quantityMl = reports.filter((r) => r.quantityUnit === 'ml').reduce((sum, r) => sum + r.quantity, 0);
    const amount = reports.reduce((sum, r) => sum + r.calculatedAmount, 0);

    const byWorkerMap = new Map<string, { workerId: string; quantityM2: number; quantityMl: number; amount: number; reportCount: number }>();
    for (const report of reports) {
      const group = byWorkerMap.get(report.workerId) ?? { workerId: report.workerId, quantityM2: 0, quantityMl: 0, amount: 0, reportCount: 0 };
      if (report.quantityUnit === 'm2') group.quantityM2 += report.quantity;
      if (report.quantityUnit === 'ml') group.quantityMl += report.quantity;
      group.amount += report.calculatedAmount;
      group.reportCount += 1;
      byWorkerMap.set(report.workerId, group);
    }
    const byWorker = [...byWorkerMap.values()];

    return {
      projectId,
      month: date ? null : period,
      date: date || null,
      reportCount: reports.length,
      quantityM2,
      quantityMl,
      amount: manager ? amount : null,
      byWorker: manager ? byWorker : byWorker.map(({ amount: _amount, ...worker }) => worker),
      requiresHumanConfirmation: true,
    };
  }
}
