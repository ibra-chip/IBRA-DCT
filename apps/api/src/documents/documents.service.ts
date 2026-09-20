import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private projectScope(user: AuthenticatedUser) {
    return user.companyId ?? '__missing_company__';
  }

  async findByProject(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId: this.projectScope(user) },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return this.prisma.document.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(projectId: string, data: CreateDocumentDto, user: AuthenticatedUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId: this.projectScope(user) },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return this.prisma.document.create({
      data: {
        projectId,
        uploadedBy: user.userId,
        title: data.title,
        fileName: data.fileName,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        category: data.category ?? 'general',
        evidenceType: data.evidenceType,
        phase: data.phase,
        status: data.status ?? 'pending',
      },
    });
  }
}
