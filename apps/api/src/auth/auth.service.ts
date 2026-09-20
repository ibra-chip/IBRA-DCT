import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { jwtConstants } from './constants';
import type { LoginDto, RegisterDto } from './dto';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  companyId?: string;
};

type UserWithRoleAndCompany = Prisma.UserGetPayload<{ include: { role: true; company: true } }>;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      await this.ensureDefaultAdmin();
    }
  }

  async validateUser(data: LoginDto) {
    const identifier = String(data.identifier ?? data.email ?? data.phone ?? '').trim();
    const normalizedEmail = identifier.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { phone: identifier },
        ],
      },
      include: { role: true, company: true },
    });

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.sanitizeUser(user);
  }

  async login(data: LoginDto) {
    const user = await this.validateUser(data);
    const token = this.issueToken(user);

    return {
      token,
      access_token: token,
      user,
    };
  }

  async register(data: RegisterDto) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      throw new UnauthorizedException('User already exists');
    }

    const company = await this.prisma.company.create({
      data: { name: data.companyName?.trim() || 'IBRA-BA Client' },
    });
    const role = await this.prisma.role.upsert({
      where: { name: 'manager' },
      update: {},
      create: { name: 'manager', description: 'Project manager' },
    });
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash,
        companyId: company.id,
        roleId: role.id,
      },
      include: { role: true, company: true },
    });

    return this.login({ email: user.email, password: data.password });
  }

  async getPublicUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, company: true },
    });

    return user ? this.sanitizeUser(user) : null;
  }

  private sanitizeUser(user: UserWithRoleAndCompany): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name ?? 'user',
      company: user.company?.name ?? '',
      companyId: user.companyId ?? undefined,
    };
  }

  private issueToken(user: PublicUser) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: user.company,
      companyId: user.companyId,
    }, {
      secret: jwtConstants.secret,
      expiresIn: jwtConstants.expiresIn,
    });
  }

  private async ensureDefaultAdmin() {
    const adminRole = await this.prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin', description: 'Platform administrator' },
    });
    const company = await this.prisma.company.upsert({
      where: { id: 'ibra-demo-company' },
      update: {},
      create: { id: 'ibra-demo-company', name: 'IBRA-BA Demo Company' },
    });
    const existing = await this.prisma.user.findUnique({ where: { email: 'admin@ibra-ba.dev' } });

    if (!existing) {
      const passwordHash = await bcrypt.hash('password123', 12);
      await this.prisma.user.create({
        data: {
          name: 'IBRA Demo Admin',
          email: 'admin@ibra-ba.dev',
          passwordHash,
          companyId: company.id,
          roleId: adminRole.id,
        },
      });
      this.logger.log('Seeded local admin account.');
    }
  }
}
