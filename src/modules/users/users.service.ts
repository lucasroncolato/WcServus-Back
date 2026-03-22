import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateUserDto } from './dto/create-user.dto';
import { LinkUserServantDto } from './dto/link-user-servant.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private readonly userSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    status: true,
    phone: true,
    servantId: true,
    servant: {
      select: {
        id: true,
        name: true,
        status: true,
        trainingStatus: true,
        mainSectorId: true,
      },
    },
    createdAt: true,
    updatedAt: true,
  } as const;

  async findAll(actor: JwtPayload) {
    this.assertCanReadUsers(actor.role);

    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.userSelect,
    });
  }

  async findOne(id: string, actor: JwtPayload) {
    this.assertCanReadUsers(actor.role);

    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: this.userSelect,
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

    if (dto.servantId) {
      await this.assertServantAvailableForUser(dto.servantId);
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
        servantId: dto.servantId,
      },
      select: this.userSelect,
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
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, servantId: true },
    });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (dto.email) {
      const duplicated = await this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase(), NOT: { id } },
        select: { id: true },
      });

      if (duplicated) {
        throw new ConflictException('Email already in use');
      }
    }

    const shouldUpdateServantLink = Object.prototype.hasOwnProperty.call(dto, 'servantId');
    if (shouldUpdateServantLink && dto.servantId) {
      await this.assertServantAvailableForUser(dto.servantId, id);
    }

    const isBeingInactivated =
      dto.status === UserStatus.INACTIVE && existingUser.status !== UserStatus.INACTIVE;
    const hasPasswordChange = Boolean(dto.password);

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email?.toLowerCase(),
          role: dto.role,
          phone: dto.phone,
          status: dto.status,
          passwordHash,
          servantId: shouldUpdateServantLink ? (dto.servantId ?? null) : undefined,
        },
        select: this.userSelect,
      });

      if (isBeingInactivated || hasPasswordChange) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return updated;
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
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: dto.status },
        select: this.userSelect,
      });

      if (dto.status === UserStatus.INACTIVE && existingUser.status !== UserStatus.INACTIVE) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return updated;
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

  async updateRole(id: string, dto: UpdateUserRoleDto, actorUserId?: string) {
    if (actorUserId && actorUserId === id) {
      throw new BadRequestException('You cannot change your own role');
    }

    await this.ensureExists(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: this.userSelect,
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'UserRole',
      entityId: id,
      userId: actorUserId,
      metadata: { role: dto.role },
    });

    return user;
  }

  async setServantLink(id: string, dto: LinkUserServantDto, actorUserId?: string) {
    await this.ensureExists(id);

    if (dto.servantId) {
      await this.assertServantAvailableForUser(dto.servantId, id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { servantId: dto.servantId ?? null },
      select: this.userSelect,
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actorUserId,
      metadata: {
        servantId: dto.servantId ?? null,
        action: dto.servantId ? 'LINKED' : 'UNLINKED',
      },
    });

    return user;
  }

  async remove(id: string, actorUserId?: string) {
    if (actorUserId && actorUserId === id) {
      throw new BadRequestException('You cannot delete your own user');
    }

    await this.ensureExists(id);

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.INACTIVE,
          servantId: null,
        },
        select: this.userSelect,
      });

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return updated;
    });

    await this.auditService.log({
      action: AuditAction.DELETE,
      entity: 'User',
      entityId: id,
      userId: actorUserId,
      metadata: { softDeleted: true },
    });

    return {
      message: 'User deactivated successfully',
      user,
    };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }

  private async assertServantAvailableForUser(servantId: string, userIdToIgnore?: string) {
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { id: true },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    const linkedUser = await this.prisma.user.findFirst({
      where: {
        servantId,
        ...(userIdToIgnore ? { NOT: { id: userIdToIgnore } } : {}),
      },
      select: { id: true, email: true },
    });

    if (linkedUser) {
      throw new ConflictException('Servant is already linked to another user');
    }
  }

  private assertCanReadUsers(role: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN and ADMIN can access users');
    }
  }
}
