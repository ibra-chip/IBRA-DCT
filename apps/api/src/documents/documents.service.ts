import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  findByProject(projectId: string) {
    return this.prisma.document.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(projectId: string, data: CreateDocumentDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return this.prisma.document.create({
      data: {
        projectId,
        uploadedBy: data.uploadedBy ?? 'system',
        title: data.title,
        fileName: data.fileName,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        category: data.category ?? 'general',
      },
    });
  }
}
