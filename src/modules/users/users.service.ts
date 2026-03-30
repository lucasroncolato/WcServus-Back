import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, Role, ServantStatus, UserScope, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
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
  servantId: true,
  lastLoginAt: true,
  servant: {
    select: {
      id: true,
      name: true,
      status: true,
      trainingStatus: true,
      mainMinistryId: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      mainMinistry: {
        select: {
          id: true,
          name: true,
        },
      },
      servantMinistries: {
        take: 1,
        select: {
          ministry: {
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
      ministryId: true,
      teamId: true,
      ministry: {
        select: {
          id: true,
          name: true,
        },
      },
      team: {
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
  [Role.SERVO]: 4,
};
const MINISTRY_SCOPE = (UserScope as unknown as { MINISTRY?: UserScope }).MINISTRY ?? UserScope.MINISTRY;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly tenantIntegrity: TenantIntegrityService = {
      assertSameChurch: () => undefined,
      assertActorChurch: () => '',
    } as unknown as TenantIntegrityService,
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
              { servant: { team: { name: { contains: search, mode: 'insensitive' } } } },
              { servant: { mainMinistry: { name: { contains: search, mode: 'insensitive' } } } },
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

  async create(dto: CreateUserDto, actor: JwtPayload) {
    this.assertCanCreateUser(actor.role, dto.role);
    const actorChurchId = this.tenantIntegrity.assertActorChurch(actor);

    const existing = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (dto.servantId) {
      await this.assertServantAvailableForUser(dto.servantId, undefined, actorChurchId);
    }

    if (dto.role === Role.SERVO && !dto.servantId) {
      throw new BadRequestException('SERVO user must be linked to a servant');
    }

    if (dto.role === Role.SERVO && dto.scope && dto.scope !== UserScope.SELF) {
      throw new BadRequestException('SERVO user scope must be SELF');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const requestedScopeType = dto.scopeType ?? dto.scope ?? UserScope.GLOBAL;
    const scopeType = dto.role === Role.SERVO ? UserScope.SELF : requestedScopeType;
    const ministryIds = [...new Set(dto.ministryIds ?? [])];
    const teamIds = [...new Set((dto.teamIds ?? []).map((value) => value.trim()).filter(Boolean))];
    const finalTeamIds = [...new Set(teamIds)];

    await this.validateScopeBindingsInput({
      scopeType,
      targetRole: dto.role,
      ministryIds,
      teamIds: finalTeamIds,
      actorChurchId,
    });

    const user = await this.updateUserWithConflictHandling(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: this.normalizeEmail(dto.email),
            passwordHash,
            role: dto.role,
            scope: scopeType,
            status: dto.status ?? UserStatus.ACTIVE,
            phone: dto.phone,
            servantId: dto.servantId,
            churchId: actorChurchId,
          },
          select: USER_SELECT,
        });

        await this.replaceUserScopeBindings(tx, created.id, scopeType, ministryIds, finalTeamIds);

        return tx.user.findUniqueOrThrow({
          where: { id: created.id },
          select: USER_SELECT,
        });
      }),
    );

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      userId: actor.sub,
      metadata: {
        targetUserId: user.id,
        role: user.role,
        status: user.status,
        scopeType: user.scope,
        ministryIds,
        teamIds: finalTeamIds,
      },
    });

    await this.notificationsService.create({
      userId: user.id,
      type: 'USER_ACCESS_CREATED',
      title: 'Seu acesso foi criado',
      message: 'Sua conta foi criada e ja pode ser utilizada no sistema.',
      link: '/auth/me',
      metadata: {
        createdBy: actor.sub,
      },
    });

    return {
      message: 'User created successfully',
      data: this.formatUser(user),
    };
  }

  async update(id: string, dto: UpdateUserDto, actorUserId?: string) {
    const allowedFields = new Set(['name', 'email', 'phone']);
    const incomingFields = Object.keys(dto);
    const disallowedFields = incomingFields.filter((field) => !allowedFields.has(field));

    if (disallowedFields.length > 0) {
      throw new BadRequestException(
        `The following fields must be updated via dedicated endpoints: ${disallowedFields.join(', ')}`,
      );
    }

    if (incomingFields.length === 0) {
      throw new BadRequestException('At least one field must be provided for update');
    }

    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
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

    const user = await this.updateUserWithConflictHandling(async () =>
      this.prisma.$transaction(async (tx) => {
        return tx.user.update({
          where: { id },
          data: {
            name: dto.name,
            email: dto.email ? this.normalizeEmail(dto.email) : undefined,
            phone: dto.phone,
          },
          select: USER_SELECT,
        });
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
          phone: dto.phone,
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

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

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
    this.assertOnlySuperAdmin(actor.role, 'Only SUPER_ADMIN can manage user roles');

    if (actor.sub === id) {
      throw new ForbiddenException('You cannot change your own role');
    }

    await this.assertCanAccessTargetUser(actor, id);

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, servantId: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageRoleChange(actor.role, targetUser.role, dto.role);

    if (dto.role === Role.SERVO && !targetUser.servantId) {
      throw new BadRequestException('SERVO user must be linked to a servant');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
        scope: dto.role === Role.SERVO ? UserScope.SELF : undefined,
      },
      select: USER_SELECT,
    });

    await this.auditService.log({
      action: AuditAction.USER_ROLE_CHANGE,
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

  async updateScope(id: string, dto: UpdateUserScopeDto, actor: JwtPayload) {
    this.assertOnlySuperAdmin(actor.role, 'Only SUPER_ADMIN can manage user scope');

    if (actor.sub === id) {
      throw new ForbiddenException('You cannot change your own scope');
    }

    await this.assertCanAccessTargetUserByActorId(actor.sub, id);

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const ministryIds = [...new Set(dto.ministryIds ?? [])];
    const teamIds = [...new Set((dto.teamIds ?? []).map((value) => value.trim()).filter(Boolean))];
    const finalTeamIds = [...new Set(teamIds)];

    await this.validateScopeBindingsInput({
      scopeType: dto.scopeType,
      targetRole: target.role,
      ministryIds,
      teamIds: finalTeamIds,
      actorChurchId: this.tenantIntegrity.assertActorChurch(actor),
    });

    const user = await this.prisma.$transaction(async (tx) => {
      await this.replaceUserScopeBindings(tx, id, dto.scopeType, ministryIds, finalTeamIds);

      return tx.user.update({
        where: { id },
        data: { scope: dto.scopeType },
        select: USER_SELECT,
      });
    });

    await this.auditService.log({
      action: AuditAction.USER_SCOPE_CHANGE,
      entity: 'UserScope',
      entityId: id,
      userId: actor.sub,
      metadata: {
        targetUserId: id,
        scopeType: dto.scopeType,
        ministryIds,
        teamIds: finalTeamIds,
      },
    });

    return {
      message: 'User scope updated successfully',
      data: this.formatUser(user),
    };
  }

  async setServantLink(id: string, dto: LinkUserServantDto, actorUserId?: string) {
    await this.assertCanAccessTargetUserByActorId(actorUserId, id);

    if (dto.servantId === undefined) {
      throw new BadRequestException('servantId must be provided (or null to unlink)');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, servantId: true },
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    if ((dto.servantId === null || dto.servantId === undefined) && currentUser.role === Role.SERVO) {
      throw new BadRequestException(
        'SERVO user must stay linked to a servant.',
      );
    }

    if (dto.servantId) {
      await this.assertServantAvailableForUser(
        dto.servantId,
        id,
        actorUserId
          ? (
              await this.prisma.user.findUnique({
                where: { id: actorUserId },
                select: { churchId: true },
              })
            )?.churchId ?? null
          : null,
      );
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

    const currentUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, servantId: true },
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.role === Role.SERVO && currentUser.servantId) {
      throw new BadRequestException(
        'SERVO user cannot be deactivated while linked to servant. Reassign access first.',
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.INACTIVE,
          servantId: null,
          deletedAt: new Date(),
          deletedBy: actorUserId ?? null,
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

  private async assertServantAvailableForUser(
    servantId: string,
    userIdToIgnore?: string,
    actorChurchId?: string | null,
  ) {
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { id: true, churchId: true },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
    if (actorChurchId) {
      this.tenantIntegrity.assertSameChurch(actorChurchId, servant.churchId, 'Servant');
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

  private async validateScopeBindingsInput(input: {
    scopeType: UserScope;
    targetRole: Role;
    ministryIds: string[];
    teamIds: string[];
    actorChurchId?: string | null;
  }) {
    const { scopeType, ministryIds, teamIds, actorChurchId } = input;

    if (scopeType === MINISTRY_SCOPE && ministryIds.length === 0) {
      throw new BadRequestException('scopeType=MINISTRY requires at least one ministryId');
    }

    if (scopeType === UserScope.EQUIPE && ministryIds.length === 0 && teamIds.length === 0) {
      throw new BadRequestException('scopeType=EQUIPE requires teamIds and/or ministryIds');
    }

    if (scopeType === UserScope.SELF && ministryIds.length > 0) {
      throw new BadRequestException('scopeType=SELF does not accept ministryIds');
    }

    if (scopeType === UserScope.SELF && teamIds.length > 0) {
      throw new BadRequestException('scopeType=SELF does not accept teamIds');
    }

    if (ministryIds.length > 0) {
      const ministries = await this.prisma.ministry.findMany({
        where: { id: { in: ministryIds } },
        select: { id: true, churchId: true },
      });

      if (ministries.length !== ministryIds.length) {
        throw new NotFoundException('One or more informed ministries were not found');
      }
      if (actorChurchId) {
        ministries.forEach((ministry) =>
          this.tenantIntegrity.assertSameChurch(actorChurchId, ministry.churchId, 'Ministry'),
        );
      }
    }

    if (teamIds.length > 0) {
      const teams = await this.prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, ministryId: true, churchId: true },
      });

      if (teams.length !== teamIds.length) {
        throw new NotFoundException('One or more informed teams were not found');
      }
      if (actorChurchId) {
        teams.forEach((team) =>
          this.tenantIntegrity.assertSameChurch(actorChurchId, team.churchId, 'Team'),
        );
      }

      if (ministryIds.length > 0) {
        const sectorSet = new Set(ministryIds);
        const invalidTeamSector = teams.some((team) => !sectorSet.has(team.ministryId));
        if (invalidTeamSector) {
          throw new BadRequestException('All teamIds must belong to informed ministryIds');
        }
      }
    }
  }

  private async replaceUserScopeBindings(
    tx: Prisma.TransactionClient,
    userId: string,
    scopeType: UserScope,
    ministryIds: string[],
    teamIds: string[],
  ) {
    await tx.userMinistryBinding.deleteMany({ where: { userId } });

    if (scopeType === UserScope.GLOBAL || scopeType === UserScope.SELF) {
      return;
    }

    if (ministryIds.length > 0) {
      await tx.userMinistryBinding.createMany({
        data: ministryIds.map((ministryId) => ({
          userId,
          ministryId,
          teamId: null,
        })),
        skipDuplicates: true,
      });
    }

    if (teamIds.length > 0) {
      await tx.userMinistryBinding.createMany({
        data: teamIds.map((teamId) => ({
          userId,
          ministryId: null,
          teamId,
        })),
        skipDuplicates: true,
      });
    }
  }

  private assertCanReadUsers(role: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN and ADMIN can access users');
    }
  }

  private assertCanListEligibleUsers(role: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN and ADMIN can list eligible users',
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

  private assertCanCreateUser(actorRole: Role, targetRole: Role) {
    if (actorRole === Role.SUPER_ADMIN) {
      return;
    }

    if (actorRole === Role.ADMIN) {
      if (targetRole === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Only SUPER_ADMIN can create SUPER_ADMIN users');
      }
      return;
    }

    throw new ForbiddenException('Only SUPER_ADMIN and ADMIN can create users');
  }

  private assertOnlySuperAdmin(actorRole: Role, message: string) {
    if (actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(message);
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
        churchId: true,
      },
    });

    if (!actor) {
      throw new ForbiddenException('Invalid actor');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, churchId: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (actor.role !== Role.SUPER_ADMIN && target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can manage SUPER_ADMIN users');
    }
    if (actor.churchId) {
      this.tenantIntegrity.assertSameChurch(actor.churchId, target.churchId, 'User');
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
      user.servant?.mainMinistry?.name ??
      user.servant?.servantMinistries[0]?.ministry.name ??
      null;
    const ministryIds = [
      ...new Set(
        user.scopeBindings
          .map((item) => item.ministryId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const teamIds = [
      ...new Set(
        user.scopeBindings
          .map((item) => item.teamId ?? item.team?.id ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const primarySectorId = user.servant?.mainMinistryId ?? ministryIds[0] ?? null;
    const primaryTeamId = user.servant?.team?.id ?? teamIds[0] ?? null;
    const primaryTeamName =
      user.servant?.team?.name ??
      user.scopeBindings.find((item) => item.team?.name)?.team?.name ??
      null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      scope: user.scope,
      scopeType: user.scope,
      ministryIds,
      teamIds,
      ministryId: primarySectorId,
      teamId: primaryTeamId,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      isActive: user.status === UserStatus.ACTIVE,
      phone: user.phone,
      servantId: user.servantId,
      servantName: user.servant?.name ?? null,
      sectorName,
      teamName: primaryTeamName ?? null,
      scopeLinks: user.scopeBindings.map((item) => ({
        ministryId: item.ministryId,
        sectorName: item.ministry?.name ?? null,
        teamId: item.teamId ?? item.team?.id ?? null,
        teamName: item.team?.name ?? null,
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
            statusView: user.servant.status === ServantStatus.ATIVO ? 'ACTIVE' : 'INACTIVE',
            trainingStatus: user.servant.trainingStatus,
            mainMinistryId: user.servant.mainMinistryId,
            teamId: user.servant.team?.id ?? null,
            teamName: user.servant.team?.name ?? null,
          }
        : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}



