import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';

const managerRoles = new Set(['admin', 'manager', 'gerant']);

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private companyScope(user: AuthenticatedUser) {
    return user.companyId ?? '__missing_company__';
  }

  private assertManager(user: AuthenticatedUser) {
    if (!managerRoles.has(user.role)) {
      throw new ForbiddenException('Only company managers can change projects.');
    }
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.project.findMany({
      where: { companyId: this.companyScope(user) },
      include: {
        company: true,
        documents: {
          select: { id: true, title: true, fileName: true, category: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        evidence: {
          select: { id: true, type: true, phase: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        checklists: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId: this.companyScope(user) },
      include: {
        company: true,
        documents: { orderBy: { createdAt: 'desc' } },
        evidence: { orderBy: { createdAt: 'desc' } },
        checklists: { include: { items: true }, orderBy: { createdAt: 'desc' } },
        members: { include: { user: true, role: true } },
        budget: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  async create(data: CreateProjectDto, user: AuthenticatedUser) {
    this.assertManager(user);

    if (!user.companyId) {
      throw new ForbiddenException('A company is required to create a project.');
    }

    return this.prisma.project.create({
      data: {
        companyId: user.companyId,
        name: data.name,
        location: data.location,
        status: data.status ?? 'planning',
        managerId: data.managerId,
      },
      include: { company: true },
    });
  }

  async update(id: string, data: UpdateProjectDto, user: AuthenticatedUser) {
    this.assertManager(user);
    await this.findOne(id, user);

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    this.assertManager(user);
    await this.findOne(id, user);
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true, id };
  }
}
