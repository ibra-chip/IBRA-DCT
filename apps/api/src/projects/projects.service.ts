import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      include: {
        company: true,
        documents: true,
        evidence: true,
        checklists: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        company: true,
        documents: { orderBy: { createdAt: 'desc' } },
        evidence: { orderBy: { createdAt: 'desc' } },
        checklists: { include: { items: true } },
        members: { include: { user: true, role: true } },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  create(data: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        location: data.location,
        status: data.status ?? 'planning',
        managerId: data.managerId,
      },
      include: { company: true },
    });
  }

  async update(id: string, data: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    await this.prisma.project.delete({ where: { id } });
    return { deleted: true, id };
  }
}
