import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRendezvousDto, UpdateRendezvousDto } from './dto';

const managerRoles = new Set(['admin', 'manager', 'gerant']);
const MINIMUM_NOTICE_DAYS = 3;

const dateOnlyTimestamp = (value: string) => {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

@Injectable()
export class RendezvousService {
  constructor(private readonly prisma: PrismaService) {}

  private companyScope(user: AuthenticatedUser) {
    return user.companyId ?? '__missing_company__';
  }

  private isManager(user: AuthenticatedUser) {
    return managerRoles.has(user.role);
  }

  private async getProject(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId: this.companyScope(user) },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  async findAll(projectId: string, user: AuthenticatedUser) {
    await this.getProject(projectId, user);
    const manager = this.isManager(user);

    return this.prisma.rendezvous.findMany({
      where: { projectId, ...(manager ? {} : { workerId: user.userId }) },
      orderBy: { absenceDate: 'asc' },
    });
  }

  async create(projectId: string, user: AuthenticatedUser, dto: CreateRendezvousDto) {
    await this.getProject(projectId, user);

    const todayTimestamp = dateOnlyTimestamp(new Date().toISOString().slice(0, 10));
    const absenceTimestamp = dateOnlyTimestamp(dto.absenceDate);
    if (!Number.isFinite(absenceTimestamp)) {
      throw new BadRequestException('A valid absence date is required');
    }
    const noticeDays = Math.floor((absenceTimestamp - todayTimestamp) / 86400000);
    if (noticeDays < MINIMUM_NOTICE_DAYS) {
      throw new BadRequestException(`Absence/RDV must be declared at least ${MINIMUM_NOTICE_DAYS} days ahead`);
    }

    const owner = user.companyId
      ? await this.prisma.user.findFirst({
          where: { companyId: user.companyId, role: { name: { in: [...managerRoles] } } },
        })
      : null;

    return this.prisma.rendezvous.create({
      data: {
        projectId,
        workerId: user.userId,
        ownerId: owner?.id ?? null,
        absenceDate: new Date(`${dto.absenceDate}T00:00:00.000Z`),
        time: dto.time,
        reason: dto.reason || null,
      },
    });
  }

  async update(projectId: string, rendezvousId: string, user: AuthenticatedUser, dto: UpdateRendezvousDto) {
    await this.getProject(projectId, user);
    if (!dto.absenceDate && !dto.time) {
      throw new BadRequestException('Provide a new date or time to update');
    }

    const rendezvous = await this.prisma.rendezvous.findFirst({ where: { id: rendezvousId, projectId } });
    if (!rendezvous) throw new NotFoundException(`Rendezvous ${rendezvousId} not found`);
    if (rendezvous.workerId !== user.userId && !this.isManager(user)) {
      throw new ForbiddenException('You can only edit your own rendezvous.');
    }

    return this.prisma.rendezvous.update({
      where: { id: rendezvousId },
      data: {
        ...(dto.absenceDate ? { absenceDate: new Date(`${dto.absenceDate}T00:00:00.000Z`) } : {}),
        ...(dto.time ? { time: dto.time } : {}),
      },
    });
  }
}
