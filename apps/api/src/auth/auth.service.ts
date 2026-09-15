import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  async validateUser(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true, company: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.sanitizeUser(user);
  }

  async login(data: { email: string; password: string }) {
    const user = await this.validateUser(data.email, data.password);
    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async register(data: { name: string; email: string; password: string; companyName?: string }) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      throw new UnauthorizedException('User already exists');
    }

    const company = await this.prisma.company.upsert({
      where: { id: 'default-company' },
      update: {},
      create: {
        id: 'default-company',
        name: data.companyName ?? 'IBRA-BA Client',
      },
    });

    const role = await this.prisma.role.upsert({
      where: { name: 'manager' },
      update: {},
      create: { name: 'manager', description: 'Project manager' },
    });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        passwordHash,
        companyId: company.id,
        roleId: role.id,
      },
      include: { role: true, company: true },
    });

    return this.login({ email: user.email, password: data.password });
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      role: user.role?.name ?? 'user',
      company: user.company?.name ?? 'Unknown company',
    };
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
      create: {
        id: 'ibra-demo-company',
        name: 'IBRA-BA Demo Company',
      },
    });

    const existing = await this.prisma.user.findUnique({
      where: { email: 'admin@ibra-ba.dev' },
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash('password123', 10);
      await this.prisma.user.create({
        data: {
          name: 'IBRA Demo Admin',
          email: 'admin@ibra-ba.dev',
          passwordHash,
          companyId: company.id,
          roleId: adminRole.id,
        },
      });
      this.logger.log('Seeded default admin user: admin@ibra-ba.dev / password123');
    }
  }
}
