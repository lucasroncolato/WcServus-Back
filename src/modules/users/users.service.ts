import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateUserDto, actorUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        status: dto.status,
        phone: dto.phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      userId: actorUserId,
      metadata: { role: user.role },
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorUserId?: string) {
    await this.ensureExists(id);

    if (dto.email) {
      const duplicated = await this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase(), NOT: { id } },
        select: { id: true },
      });

      if (duplicated) {
        throw new ConflictException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email?.toLowerCase(),
        role: dto.role,
        phone: dto.phone,
        status: dto.status,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actorUserId,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return user;
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto, actorUserId?: string) {
    await this.ensureExists(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'User',
      entityId: id,
      userId: actorUserId,
      metadata: { status: dto.status },
    });

    return user;
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }
}