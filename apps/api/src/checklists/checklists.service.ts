import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistDto } from './dto';

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  private companyScope(user: AuthenticatedUser) {
    return user.companyId ?? '__missing_company__';
  }

  private async getProject(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId: this.companyScope(user) },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  async findByProject(projectId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    return this.prisma.checklist.findMany({
      where: { projectId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(projectId: string, data: CreateChecklistDto, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    return this.prisma.checklist.create({
      data: {
        projectId,
        type: data.type,
        title: data.title,
        createdBy: user.userId,
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
