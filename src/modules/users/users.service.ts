import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, Role, UserScope, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { getUserAccessWhere } from 'src/common/auth/access-scope';
import { CreateUserDto } from './dto/create-user.dto';
import { LinkUserServantDto } from './dto/link-user-servant.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserScopeDto } from './dto/update-user-scope.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  scope: true,
  status: true,
  mustChangePassword: true,
  phone: true,
  sectorTeam: true,
  servantId: true,
  lastLoginAt: true,
  servant: {
    select: {
      id: true,
      name: true,
      status: true,
      trainingStatus: true,
      mainSectorId: true,
      classGroup: true,
      mainSector: {
        select: {
          id: true,
          name: true,
        },
      },
      servantSectors: {
        take: 1,
        select: {
          sector: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  scopeBindings: {
    select: {
      id: true,
      sectorId: true,
      teamName: true,
      sector: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  permissionOverrides: {
    select: {
      permissionKey: true,
      effect: true,
      reason: true,
    },
    orderBy: { permissionKey: 'asc' },
  },
  createdAt: true,
  updatedAt: true,
} as const;

type UserRecord = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const ROLE_RANK: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 0,
  [Role.ADMIN]: 1,
  [Role.PASTOR]: 2,
  [Role.COORDENADOR]: 3,
  [Role.LIDER]: 4,
  [Role.SERVO]: 5,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: ListUsersQueryDto, actor: JwtPayload) {
    this.assertCanReadUsers(actor.role);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const accessWhere = await getUserAccessWhere(this.prisma, actor);

    const where: Prisma.UserWhereInput = {
      status: query.status ?? UserStatus.ACTIVE,
      ...(query.role ? { role: query.role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { servant: { name: { contains: search, mode: 'insensitive' } } },
              { servant: { classGroup: { contains: search, mode: 'insensitive' } } },
              { servant: { mainSector: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const finalWhere: Prisma.UserWhereInput =
      accessWhere !== undefined ? { AND: [where, accessWhere] } : where;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: finalWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where: finalWhere }),
    ]);

    return {
      data: users.map((user) => this.formatUser(user)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findOne(id: string, actor: JwtPayload) {
    this.assertCanReadUsers(actor.role);
    await this.assertCanAccessTargetUser(actor, id);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { data: this.formatUser(user) };
  }

  async findEligible(servantId: string | undefined, actor: JwtPayload) {
    this.assertCanListEligibleUsers(actor.role);

    if (servantId) {
      const servantExists = await this.prisma.servant.findUnique({
        where: { id: servantId },
        select: { id: true },
      });

      if (!servantExists) {
        throw new NotFoundException('Servant not found');
      }
    }

    const accessWhere = await getUserAccessWhere(this.prisma, actor);
    const queryWhere: Prisma.UserWhereInput = {
      OR: [{ servantId: null }, ...(servantId ? [{ servantId }] : [])],
    };
    const where: Prisma.UserWhereInput =
      accessWhere !== undefined ? { AND: [queryWhere, accessWhere] } : queryWhere;

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        servantId: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    return {
      data: users,
    };
  }

  async create(dto: CreateUserDto, actorUserId?: string) {
    this.assertScopeSectorTeam(dto.scope ?? UserScope.GLOBAL, dto.sectorTeam);

    const existing = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (dto.servantId) {
      await this.assertServantAvailableForUser(dto.servantId);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.createUserWithConflictHandling({
      name: dto.name,
      email: this.normalizeEmail(dto.email),
      passwordHash,
      role: dto.role,
      scope: dto.scope ?? UserScope.GLOBAL,
      status: dto.status ?? UserStatus.ACTIVE,
      phone: dto.phone,
      sectorTeam: dto.sectorTeam,
      servantId: dto.servantId,
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      userId: actorUserId,
      metadata: {
        targetUserId: user.id,
        role: user.role,
        status: user.status,
        scope: user.scope,
      },
    });

    await this.notificationsService.create({
      userId: user.id,
      type: 'USER_ACCESS_CREATED',
      title: 'Seu acesso foi criado',
      message: 'Sua conta foi criada e ja pode ser utilizada no sistema.',
      link: '/auth/me',
      metadata: {
        createdBy: actorUserId ?? null,
      },
    });

    return {
      message: 'User created successfully',
      data: this.formatUser(user),
    };
  }

  async update(id: string, dto: UpdateUserDto, actorUserId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided for update');
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'role')) {
      throw new BadRequestException('Role must be changed via PATCH /users/:id/role');
    }

    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, servantId: true, scope: true, sectorTeam: true },
    });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (dto.email) {
      const duplicated = await this.prisma.user.findFirst({
        where: { email: this.normalizeEmail(dto.email), NOT: { id } },
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

    const nextScope = dto.scope ?? existingUser.scope;
    const nextSectorTeam =
      Object.prototype.hasOwnProperty.call(dto, 'sectorTeam') ? dto.sectorTeam : existingUser.sectorTeam;
    this.assertScopeSectorTeam(nextScope, nextSectorTeam);

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    const user = await this.updateUserWithConflictHandling(async () =>
      this.prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({
            where: { id },
            data: {
              name: dto.name,
              email: dto.email ? this.normalizeEmail(dto.email) : undefined,
              role: dto.role,
              scope: dto.scope,
              phone: dto.phone,
              status: dto.status,
              sectorTeam: dto.sectorTeam,
              passwordHash,
              servantId: shouldUpdateServantLink ? (dto.servantId ?? null) : undefined,
            },
            select: USER_SELECT,
          });

          if (isBeingInactivated || hasPasswordChange) {
            await tx.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }

          return updated;
        }),
    );

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actorUserId,
      metadata: {
        targetUserId: id,
        changedFields: Object.keys(dto),
        changes: {
          name: dto.name,
          email: dto.email ? this.normalizeEmail(dto.email) : undefined,
          scope: dto.scope,
          phone: dto.phone,
          status: dto.status,
          sectorTeam: dto.sectorTeam,
          servantId: shouldUpdateServantLink ? (dto.servantId ?? null) : undefined,
          passwordChanged: hasPasswordChange || undefined,
        },
      },
    });

    return {
      message: 'User updated successfully',
      data: this.formatUser(user),
    };
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto, actorUserId?: string) {
    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    if (
      dto.status &&
      typeof dto.isActive === 'boolean' &&
      (dto.status === UserStatus.ACTIVE) !== dto.isActive
    ) {
      throw new BadRequestException('status and isActive are conflicting');
    }

    const nextStatus =
      dto.status ??
      (typeof dto.isActive === 'boolean'
        ? dto.isActive
          ? UserStatus.ACTIVE
          : UserStatus.INACTIVE
        : undefined);
    if (!nextStatus) {
      throw new BadRequestException('status or isActive must be provided');
    }

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
        data: { status: nextStatus },
        select: USER_SELECT,
      });

      if (nextStatus === UserStatus.INACTIVE && existingUser.status !== UserStatus.INACTIVE) {
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
      metadata: {
        targetUserId: id,
        fromStatus: existingUser.status,
        toStatus: nextStatus,
      },
    });

    return {
      message: 'User status updated successfully',
      data: this.formatUser(user),
    };
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, actorUserId?: string) {
    if (actorUserId && actorUserId === id) {
      throw new ForbiddenException('You cannot reset your own password via this endpoint');
    }

    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    await this.ensureExists(id);

    const rawPassword = dto.password ?? dto.newPassword;
    if (!rawPassword) {
      throw new BadRequestException('password is required');
    }
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const mustChangePassword = dto.forceChangeOnNextLogin ?? true;

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword,
        },
        select: USER_SELECT,
      });

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return updated;
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'UserPasswordReset',
      entityId: id,
      userId: actorUserId,
      metadata: {
        targetUserId: id,
        mustChangePassword,
      },
    });

    await this.notificationsService.create({
      userId: id,
      type: 'USER_PASSWORD_RESET',
      title: 'Senha redefinida',
      message: 'Sua senha foi redefinida por um administrador.',
      link: '/auth/me',
      metadata: {
        mustChangePassword,
      },
    });

    return {
      message: 'Password reset successfully',
      data: this.formatUser(user),
    };
  }

  async updateRole(id: string, dto: UpdateUserRoleDto, actor: JwtPayload) {
    if (actor.sub === id) {
      throw new ForbiddenException('You cannot change your own role');
    }

    await this.assertCanAccessTargetUser(actor, id);

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageRoleChange(actor.role, targetUser.role, dto.role);

    const user = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: USER_SELECT,
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'UserRole',
      entityId: id,
      userId: actor.sub,
      metadata: {
        targetUserId: id,
        fromRole: targetUser.role,
        toRole: dto.role,
      },
    });

    return {
      message: 'User role updated successfully',
      data: this.formatUser(user),
    };
  }

  async updateScope(id: string, dto: UpdateUserScopeDto, actorUserId?: string) {
    if (actorUserId && actorUserId === id) {
      throw new ForbiddenException('You cannot change your own scope');
    }

    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    await this.ensureExists(id);

    const sectorIds = [...new Set(dto.sectorIds ?? [])];
    const teamNames = [...new Set((dto.teamNames ?? []).map((value) => value.trim()).filter(Boolean))];

    if (dto.scopeType === UserScope.SETOR && sectorIds.length === 0) {
      throw new BadRequestException('scopeType=SETOR requires at least one sectorId');
    }

    if (dto.scopeType === UserScope.EQUIPE && sectorIds.length === 0 && teamNames.length === 0) {
      throw new BadRequestException('scopeType=EQUIPE requires sectorIds and/or teamNames');
    }

    if (dto.scopeType === UserScope.SELF && sectorIds.length > 0) {
      throw new BadRequestException('scopeType=SELF does not accept sectorIds');
    }

    if (dto.scopeType === UserScope.SELF && teamNames.length > 0) {
      throw new BadRequestException('scopeType=SELF does not accept teamNames');
    }

    if (sectorIds.length > 0) {
      const sectors = await this.prisma.sector.findMany({
        where: { id: { in: sectorIds } },
        select: { id: true },
      });

      if (sectors.length !== sectorIds.length) {
        throw new NotFoundException('One or more informed sectors were not found');
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.userScopeBinding.deleteMany({ where: { userId: id } });

      if (dto.scopeType !== UserScope.GLOBAL && dto.scopeType !== UserScope.SELF) {
        if (sectorIds.length > 0) {
          await tx.userScopeBinding.createMany({
            data: sectorIds.map((sectorId) => ({
              userId: id,
              sectorId,
              teamName: null,
            })),
            skipDuplicates: true,
          });
        }

        if (teamNames.length > 0) {
          await tx.userScopeBinding.createMany({
            data: teamNames.map((teamName) => ({
              userId: id,
              sectorId: null,
              teamName,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: { scope: dto.scopeType },
        select: USER_SELECT,
      });
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'UserScope',
      entityId: id,
      userId: actorUserId,
      metadata: {
        targetUserId: id,
        scopeType: dto.scopeType,
        sectorIds,
        teamNames,
      },
    });

    return {
      message: 'User scope updated successfully',
      data: this.formatUser(user),
    };
  }

  async setServantLink(id: string, dto: LinkUserServantDto, actorUserId?: string) {
    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    await this.ensureExists(id);

    if (dto.servantId) {
      await this.assertServantAvailableForUser(dto.servantId, id);
    }

    const user = await this.updateUserWithConflictHandling(() =>
      this.prisma.user.update({
        where: { id },
        data: { servantId: dto.servantId ?? null },
        select: USER_SELECT,
      }),
    );

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actorUserId,
      metadata: {
        targetUserId: id,
        servantId: dto.servantId ?? null,
        action: dto.servantId ? 'LINKED' : 'UNLINKED',
      },
    });

    return {
      message: dto.servantId ? 'User linked to servant successfully' : 'User unlinked from servant successfully',
      data: this.formatUser(user),
    };
  }

  async remove(id: string, actorUserId?: string) {
    if (actorUserId && actorUserId === id) {
      throw new BadRequestException('You cannot delete your own user');
    }

    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    await this.ensureExists(id);

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.INACTIVE,
          servantId: null,
        },
        select: USER_SELECT,
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
      metadata: {
        targetUserId: id,
        softDeleted: true,
      },
    });

    return {
      message: 'User deactivated successfully',
      data: this.formatUser(user),
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

  private assertCanListEligibleUsers(role: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN && role !== Role.COORDENADOR) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN, ADMIN and COORDENADOR can list eligible users',
      );
    }
  }

  private assertCanManageRoleChange(actorRole: Role, targetRole: Role, nextRole: Role) {
    if (actorRole === Role.SUPER_ADMIN) {
      return;
    }

    const actorRank = ROLE_RANK[actorRole];
    const targetRank = ROLE_RANK[targetRole];
    const nextRank = ROLE_RANK[nextRole];

    if (actorRank === undefined || targetRank === undefined || nextRank === undefined) {
      throw new ForbiddenException('Invalid role hierarchy');
    }

    const canEditTarget = actorRank < targetRank;
    const canAssignNextRole = actorRank < nextRank;

    if (!canEditTarget || !canAssignNextRole) {
      throw new ForbiddenException(
        'You cannot promote, demote, or edit roles at your own level or above',
      );
    }
  }

  private async createUserWithConflictHandling(data: Prisma.UserUncheckedCreateInput) {
    try {
      return await this.prisma.user.create({
        data,
        select: USER_SELECT,
      });
    } catch (error) {
      this.throwFriendlyConflict(error);
      throw error;
    }
  }

  private async updateUserWithConflictHandling(operation: () => Promise<UserRecord>): Promise<UserRecord> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      this.throwFriendlyConflict(error);
      throw error;
    }
  }

  private throwFriendlyConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(',')
        : String(error.meta?.target ?? '');

      if (target.includes('email') || target.includes('User_email_lower_key')) {
        throw new ConflictException('Email already in use');
      }

      if (target.includes('servantId')) {
        throw new ConflictException('Servant is already linked to another user');
      }
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private assertScopeSectorTeam(scope: UserScope, sectorTeam: string | null | undefined) {
    if (scope !== UserScope.GLOBAL && !sectorTeam?.trim()) {
      throw new BadRequestException('sectorTeam is required when scope is not GLOBAL');
    }
  }

  private async assertCanAccessTargetUser(actor: JwtPayload, targetUserId: string) {
    const where = await getUserAccessWhere(this.prisma, actor);
    if (!where) {
      return;
    }

    const allowed = await this.prisma.user.findFirst({
      where: {
        AND: [{ id: targetUserId }, where],
      },
      select: { id: true },
    });

    if (!allowed) {
      throw new ForbiddenException('You do not have permission for this user');
    }
  }

  private async assertCanAccessTargetUserByActorId(actorUserId: string | undefined, targetUserId: string) {
    if (!actorUserId) {
      return;
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        email: true,
        role: true,
        servantId: true,
      },
    });

    if (!actor) {
      throw new ForbiddenException('Invalid actor');
    }

    await this.assertCanAccessTargetUser(
      {
        sub: actor.id,
        email: actor.email,
        role: actor.role,
        servantId: actor.servantId,
      },
      targetUserId,
    );
  }

  private formatUser(user: UserRecord) {
    const sectorName =
      user.servant?.mainSector?.name ??
      user.servant?.servantSectors[0]?.sector.name ??
      user.sectorTeam ??
      null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      scope: user.scope,
      scopeType: user.scope,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      isActive: user.status === UserStatus.ACTIVE,
      phone: user.phone,
      sectorTeam: user.sectorTeam,
      servantId: user.servantId,
      servantName: user.servant?.name ?? null,
      sectorName,
      teamName: user.servant?.classGroup ?? user.sectorTeam ?? null,
      scopeLinks: user.scopeBindings.map((item) => ({
        sectorId: item.sectorId,
        sectorName: item.sector?.name ?? null,
        teamName: item.teamName,
      })),
      permissionOverrides: user.permissionOverrides.map((override) => ({
        key: override.permissionKey,
        effect: override.effect,
        reason: override.reason,
      })),
      lastAccessAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      servant: user.servant
        ? {
            id: user.servant.id,
            name: user.servant.name,
            status: user.servant.status,
            trainingStatus: user.servant.trainingStatus,
            mainSectorId: user.servant.mainSectorId,
            classGroup: user.servant.classGroup,
          }
        : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
