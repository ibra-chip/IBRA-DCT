import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistDto } from './dto';

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  findByProject(projectId: string) {
    return this.prisma.checklist.findMany({
      where: { projectId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(projectId: string, data: CreateChecklistDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return this.prisma.checklist.create({
      data: {
        projectId,
        type: data.type,
        title: data.title,
        createdBy: data.createdBy ?? 'system',
        items: {
          create: data.items.map((item) => ({
            title: item.title,
            description: item.description,
            assignedTo: item.assignedTo,
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          })),
        },
      },
      include: { items: true },
    });
  }
}
