import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  Role,
  ServantApprovalStatus,
  ServantStatus,
  TrainingStatus,
  UserScope,
  UserStatus,
  type Sector,
  type Servant,
  type Team,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getServantAccessWhere, resolveScopedSectorIds } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { CompleteTrainingDto } from './dto/complete-training.dto';
import { CreateServantAccessDto } from './dto/create-servant-access.dto';
import { CreateServantWithUserDto } from './dto/create-servant-with-user.dto';
import { CreateServantDto, ServantActiveStatusDto } from './dto/create-servant.dto';
import { LinkServantUserDto } from './dto/link-servant-user.dto';
import { ListServantsQueryDto } from './dto/list-servants-query.dto';
import { UpdateServantStatusDto } from './dto/update-servant-status.dto';
import { UpdateServantDto } from './dto/update-servant.dto';
import { ServantApprovalActionDto, UpdateServantApprovalDto } from './dto/update-servant-approval.dto';

type ServantWithRelations = Servant & {
  mainSector: Sector | null;
  team: Team | null;
  servantSectors: Array<{ sector: Sector }>;
  userAccount: {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: UserStatus;
  } | null;
};

@Injectable()
export class ServantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private readonly servantInclude = {
    mainSector: true,
    team: true,
    servantSectors: {
      include: { sector: true },
    },
    userAccount: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    },
  } as const;

  async findAll(query: ListServantsQueryDto, actor: JwtPayload) {
    const accessWhere = await getServantAccessWhere(this.prisma, actor);

    const queryWhere: Prisma.ServantWhereInput = {
      status: this.mapQueryStatus(query.status),
      trainingStatus: query.trainingStatus,
      approvalStatus: query.approvalStatus,
      teamId: query.teamId,
      OR: query.sectorId
        ? [{ mainSectorId: query.sectorId }, { servantSectors: { some: { sectorId: query.sectorId } } }]
        : undefined,
      name: query.search
        ? {
            contains: query.search,
            mode: 'insensitive',
          }
        : undefined,
    };

    const where: Prisma.ServantWhereInput =
      accessWhere !== undefined ? { AND: [queryWhere, accessWhere] } : queryWhere;

    const servants = await this.prisma.servant.findMany({
      where,
      include: this.servantInclude,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    return servants.map((servant) => this.toApiServant(servant));
  }

  async findOne(id: string, actor: JwtPayload) {
    const where = await this.buildScopedServantWhere(actor, id);
    const servant = await this.prisma.servant.findFirst({
      where,
      include: this.servantInclude,
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    return this.toApiServant(servant);
  }

  async findEligible(userId: string | undefined, actor: JwtPayload) {
    if (userId) {
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!userExists) {
        throw new NotFoundException('User not found');
      }
    }

    const accessWhere = await getServantAccessWhere(this.prisma, actor);
    const queryWhere: Prisma.ServantWhereInput = {
      OR: [{ userAccount: null }, ...(userId ? [{ userAccount: { is: { id: userId } } }] : [])],
    };
    const where: Prisma.ServantWhereInput =
      accessWhere !== undefined ? { AND: [queryWhere, accessWhere] } : queryWhere;

    const servants = await this.prisma.servant.findMany({
      where,
      include: this.servantInclude,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: 200,
    });

    return {
      data: servants.map((servant) => this.toApiServant(servant)),
    };
  }

  async create(dto: CreateServantDto, actor: JwtPayload) {
    void dto;
    void actor;
    throw new BadRequestException(
      'Use POST /servants/with-user. Every new servant must be created with a linked user account.',
    );
  }

  async createWithUser(dto: CreateServantWithUserDto, actor: JwtPayload) {
    if (
      actor.role !== Role.SUPER_ADMIN &&
      actor.role !== Role.ADMIN &&
      actor.role !== Role.COORDENADOR
    ) {
      throw new ForbiddenException('You do not have permission to create servants');
    }

    const isCoordinatorRequest = actor.role === Role.COORDENADOR;
    const sectorIds = isCoordinatorRequest
      ? await this.resolveCoordinatorCreationSectorIds(actor, dto.sectorIds, dto.mainSectorId)
      : await this.resolveAndValidateSectorIds(dto.sectorIds, dto.mainSectorId, true);
    await this.assertCanManageSectorSet(actor, sectorIds);
    const teamId = await this.resolveAndValidateTeamId(dto.teamId, sectorIds);

    const email = dto.user.email.toLowerCase();
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingByEmail) {
      throw new ConflictException('Email already in use');
    }

    if (dto.user.role && dto.user.role !== Role.SERVO) {
      throw new BadRequestException('Every new servant user account must use role SERVO');
    }

    const targetRole = Role.SERVO;

    const passwordHash = await bcrypt.hash(dto.user.password, 10);

    const servant = await this.prisma.$transaction(async (tx) => {
      const createdServant = await tx.servant.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          gender: dto.gender,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          status: isCoordinatorRequest
            ? ServantStatus.RECRUTAMENTO
            : this.mapDtoStatus(dto.status ?? ServantActiveStatusDto.ACTIVE),
          trainingStatus: TrainingStatus.PENDING,
          approvalStatus: isCoordinatorRequest
            ? ServantApprovalStatus.PENDING
            : ServantApprovalStatus.APPROVED,
          approvalRequestedByUserId: isCoordinatorRequest ? actor.sub : null,
          approvedByUserId: isCoordinatorRequest ? null : actor.sub,
          approvalUpdatedAt: new Date(),
          approvalNotes: isCoordinatorRequest
            ? 'Solicitacao criada por coordenador. Pendente de aprovacao administrativa.'
            : 'Aprovado na criacao por perfil administrativo.',
          aptitude: dto.aptitude,
          teamId,
          mainSectorId: sectorIds[0],
          notes: dto.notes,
          joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        },
      });

      await tx.servantSector.createMany({
        data: sectorIds.map((sectorId) => ({ servantId: createdServant.id, sectorId })),
      });

      await tx.servantStatusHistory.create({
        data: {
          servantId: createdServant.id,
          toStatus: createdServant.status,
          reason: 'Initial status on creation',
        },
      });

      await tx.user.create({
        data: {
          name: dto.user.name ?? createdServant.name,
          email,
          passwordHash,
          role: targetRole,
          scope: UserScope.SELF,
          status: isCoordinatorRequest ? UserStatus.INACTIVE : dto.user.status ?? UserStatus.ACTIVE,
          phone: dto.user.phone ?? createdServant.phone ?? null,
          servantId: createdServant.id,
          mustChangePassword: true,
        },
      });

      return tx.servant.findUniqueOrThrow({
        where: { id: createdServant.id },
        include: this.servantInclude,
      });
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ServantWithUser',
      entityId: servant.id,
      userId: actor.sub,
      metadata: {
        sectorIds,
        teamId,
        userRole: targetRole,
        approvalStatus: isCoordinatorRequest ? ServantApprovalStatus.PENDING : ServantApprovalStatus.APPROVED,
      },
    });

    return this.toApiServant(servant);
  }

  async linkUser(servantId: string, dto: LinkServantUserDto, actor: JwtPayload) {
    await this.assertCanManageServant(actor, servantId);

    if (dto.userId === null) {
      throw new BadRequestException(
        'A servant cannot be unlinked from user access. Link another user instead.',
      );
    } else if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, servantId: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.servantId && user.servantId !== servantId) {
        throw new ConflictException('User is already linked to another servant');
      }

      const currentLink = await this.prisma.user.findFirst({
        where: {
          servantId,
          NOT: { id: dto.userId },
        },
        select: { id: true },
      });

      if (currentLink) {
        throw new ConflictException('Servant is already linked to another user');
      }

      await this.prisma.user.update({
        where: { id: dto.userId },
        data: { servantId },
      });
    }

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'ServantUserLink',
      entityId: servantId,
      userId: actor.sub,
      metadata: { userId: dto.userId ?? null },
    });

    if (dto.userId) {
      await this.notificationsService.create({
        userId: dto.userId,
        type: 'SERVANT_LINKED',
        title: 'Conta vinculada ao cadastro ministerial',
        message: 'Seu usuario foi vinculado ao seu cadastro de servo.',
        link: `/servants/${servantId}`,
        metadata: { servantId },
      });
    }

    return this.findOne(servantId, actor);
  }

  async createUserAccess(servantId: string, dto: CreateServantAccessDto, actor: JwtPayload) {
    await this.assertCanManageServant(actor, servantId);

    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: {
        id: true,
        name: true,
        phone: true,
        team: { select: { id: true, name: true } },
        userAccount: {
          select: { id: true },
        },
      },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    if (servant.userAccount) {
      throw new ConflictException('Servant already has a linked user account');
    }

    const email = dto.email.toLowerCase();
    const duplicated = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (duplicated) {
      throw new ConflictException('Email already in use');
    }

    if (dto.role && dto.role !== Role.SERVO) {
      throw new BadRequestException('Servant access role must be SERVO');
    }

    if (dto.scope && dto.scope !== UserScope.SELF) {
      throw new BadRequestException('Servant access scope must be SELF');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name ?? servant.name,
        email,
        passwordHash,
        role: Role.SERVO,
        scope: UserScope.SELF,
        status: dto.status ?? UserStatus.ACTIVE,
        phone: servant.phone ?? null,
        servantId,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        scope: true,
        servantId: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ServantUserAccess',
      entityId: servantId,
      userId: actor.sub,
      metadata: {
        targetUserId: user.id,
        servantId,
        role: user.role,
        scope: user.scope,
      },
    });

    await this.notificationsService.create({
      userId: user.id,
      type: 'USER_ACCESS_CREATED',
      title: 'Seu acesso foi criado',
      message: 'Um administrador criou seu acesso ao sistema. Troque a senha no primeiro login.',
      link: '/auth/me',
      metadata: { servantId, mustChangePassword: true },
    });

    return {
      message: 'User access created from servant successfully',
      data: user,
    };
  }

  async update(id: string, dto: UpdateServantDto, actor: JwtPayload) {
    if (actor.role === Role.COORDENADOR) {
      throw new ForbiddenException(
        'COORDENADOR cannot edit servant profile fields. Use training completion endpoint only.',
      );
    }

    await this.assertCanManageServant(actor, id);

    const existing = await this.prisma.servant.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        teamId: true,
        mainSectorId: true,
        servantSectors: {
          select: {
            sectorId: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Servant not found');
    }

    const resolvedSectorIds =
      dto.sectorIds !== undefined || dto.mainSectorId !== undefined
        ? await this.resolveAndValidateSectorIds(dto.sectorIds, dto.mainSectorId, true)
        : undefined;

    if (resolvedSectorIds) {
      await this.assertCanManageSectorSet(actor, resolvedSectorIds);
    }

    const fallbackSectorIds =
      resolvedSectorIds ??
      [
        ...(existing.mainSectorId ? [existing.mainSectorId] : []),
        ...existing.servantSectors.map((item) => item.sectorId),
      ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
    const resolvedTeamId =
      dto.teamId !== undefined || resolvedSectorIds !== undefined
        ? await this.resolveAndValidateTeamId(dto.teamId, fallbackSectorIds)
        : undefined;

    const explicitStatus = dto.status ? this.mapDtoStatus(dto.status) : undefined;
    const implicitStatusFromTraining =
      !explicitStatus &&
      dto.trainingStatus === TrainingStatus.COMPLETED &&
      this.shouldPromoteToActiveOnTrainingCompletion(existing.status)
        ? ServantStatus.ATIVO
        : undefined;
    const nextStatus = explicitStatus ?? implicitStatusFromTraining;

    const servant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.servant.update({
        where: { id },
        data: {
          name: dto.name,
          phone: dto.phone,
          gender: dto.gender,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          status: nextStatus,
          trainingStatus: dto.trainingStatus,
          aptitude: dto.aptitude,
          teamId: resolvedTeamId,
          mainSectorId: resolvedSectorIds ? resolvedSectorIds[0] : undefined,
          notes: dto.notes,
          joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        },
      });

      if (resolvedSectorIds) {
        await tx.servantSector.deleteMany({ where: { servantId: id } });
        await tx.servantSector.createMany({
          data: resolvedSectorIds.map((sectorId) => ({ servantId: id, sectorId })),
        });
      }

      if (nextStatus && nextStatus !== existing.status) {
        await tx.servantStatusHistory.create({
          data: {
            servantId: id,
            fromStatus: existing.status,
            toStatus: nextStatus,
            reason: dto.status
              ? 'Updated in servant profile'
              : 'Auto-promoted after training completion',
          },
        });
      }

      return tx.servant.findUniqueOrThrow({
        where: { id: updated.id },
        include: this.servantInclude,
      });
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'Servant',
      entityId: id,
      userId: actor.sub,
      metadata: {
        ...dto,
        sectorIds: resolvedSectorIds,
        teamId: resolvedTeamId,
      } as unknown as Record<string, unknown>,
    });

    return this.toApiServant(servant);
  }

  async updateStatus(id: string, dto: UpdateServantStatusDto, actor: JwtPayload) {
    if (actor.role === Role.COORDENADOR) {
      throw new ForbiddenException('COORDENADOR cannot update servant active status');
    }

    await this.assertCanManageServant(actor, id);

    const existing = await this.prisma.servant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Servant not found');
    }

    const toStatus = this.mapDtoStatus(dto.status);
    if (existing.status === toStatus) {
      return this.findOne(id, actor);
    }

    await this.prisma.$transaction([
      this.prisma.servant.update({
        where: { id },
        data: { status: toStatus },
      }),
      this.prisma.servantStatusHistory.create({
        data: {
          servantId: id,
          fromStatus: existing.status,
          toStatus,
          reason: dto.reason,
        },
      }),
    ]);

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'Servant',
      entityId: id,
      userId: actor.sub,
      metadata: { from: existing.status, to: toStatus, reason: dto.reason },
    });

    return this.findOne(id, actor);
  }

  async completeTraining(id: string, dto: CompleteTrainingDto, actor: JwtPayload) {
    await this.assertCanManageServant(actor, id);

    const existing = await this.prisma.servant.findUnique({
      where: { id },
      select: { id: true, status: true, trainingStatus: true, approvalStatus: true },
    });
    if (!existing) {
      throw new NotFoundException('Servant not found');
    }
    if (existing.approvalStatus !== ServantApprovalStatus.APPROVED) {
      throw new ForbiddenException('Only approved servants can complete training');
    }

    const promoteToActive = this.shouldPromoteToActiveOnTrainingCompletion(existing.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.servant.update({
        where: { id },
        data: {
          trainingStatus: TrainingStatus.COMPLETED,
          status: promoteToActive ? ServantStatus.ATIVO : undefined,
        },
        include: this.servantInclude,
      });

      if (promoteToActive) {
        await tx.servantStatusHistory.create({
          data: {
            servantId: id,
            fromStatus: existing.status,
            toStatus: ServantStatus.ATIVO,
            reason: 'Auto-promoted after training completion',
          },
        });
      }

      return next;
    });

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'ServantTraining',
      entityId: id,
      userId: actor.sub,
      metadata: {
        fromTrainingStatus: existing.trainingStatus,
        toTrainingStatus: TrainingStatus.COMPLETED,
        fromStatus: existing.status,
        toStatus: promoteToActive ? ServantStatus.ATIVO : existing.status,
        notes: dto.notes,
      },
    });

    await this.notificationsService.notifyServantLinkedUser(id, {
      type: 'TRAINING_COMPLETED',
      title: 'Treinamento concluido',
      message: 'Seu status de treinamento foi atualizado para concluido.',
      link: `/servants/${id}`,
      metadata: { servantId: id },
    });

    return this.toApiServant(updated);
  }

  async updateApproval(id: string, dto: UpdateServantApprovalDto, actor: JwtPayload) {
    const servant = await this.prisma.servant.findUnique({
      where: { id },
      select: {
        id: true,
        approvalStatus: true,
        userAccount: {
          select: { id: true },
        },
      },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    const nextStatus =
      dto.action === ServantApprovalActionDto.APPROVE
        ? ServantApprovalStatus.APPROVED
        : ServantApprovalStatus.REJECTED;

    await this.prisma.$transaction(async (tx) => {
      await tx.servant.update({
        where: { id },
        data: {
          approvalStatus: nextStatus,
          approvedByUserId: dto.action === ServantApprovalActionDto.APPROVE ? actor.sub : null,
          approvalUpdatedAt: new Date(),
          approvalNotes: dto.reason ?? null,
        },
      });

      if (servant.userAccount?.id) {
        await tx.user.update({
          where: { id: servant.userAccount.id },
          data: {
            status:
              dto.action === ServantApprovalActionDto.APPROVE
                ? UserStatus.ACTIVE
                : UserStatus.INACTIVE,
          },
        });
      }
    });

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'ServantApproval',
      entityId: id,
      userId: actor.sub,
      metadata: {
        fromApprovalStatus: servant.approvalStatus,
        toApprovalStatus: nextStatus,
        reason: dto.reason,
      },
    });

    return this.findOne(id, actor);
  }

  async history(id: string, actor: JwtPayload) {
    await this.findOne(id, actor);

    const [statusHistory, attendanceHistory, scheduleHistory] = await Promise.all([
      this.prisma.servantStatusHistory.findMany({
        where: { servantId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.attendance.findMany({
        where: { servantId: id },
        include: { service: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.schedule.findMany({
        where: { servantId: id },
        include: { service: true, sector: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return { statusHistory, attendanceHistory, scheduleHistory };
  }

  async listActiveServantsBySector(sectorId: string) {
    const servants = await this.prisma.servant.findMany({
      where: {
        status: ServantStatus.ATIVO,
        trainingStatus: TrainingStatus.COMPLETED,
        OR: [{ mainSectorId: sectorId }, { servantSectors: { some: { sectorId } } }],
      },
      include: this.servantInclude,
      orderBy: { name: 'asc' },
    });

    return servants.map((servant) => this.toApiServant(servant));
  }

  private mapQueryStatus(status?: ServantActiveStatusDto) {
    if (!status) {
      return undefined;
    }

    if (status === ServantActiveStatusDto.ACTIVE) {
      return ServantStatus.ATIVO;
    }

    return { not: ServantStatus.ATIVO };
  }

  private mapDtoStatus(status: ServantActiveStatusDto) {
    return status === ServantActiveStatusDto.ACTIVE ? ServantStatus.ATIVO : ServantStatus.INATIVO;
  }

  private mapDbStatus(status: ServantStatus): ServantActiveStatusDto {
    return status === ServantStatus.ATIVO
      ? ServantActiveStatusDto.ACTIVE
      : ServantActiveStatusDto.INACTIVE;
  }

  private shouldPromoteToActiveOnTrainingCompletion(status: ServantStatus) {
    return status === ServantStatus.RECRUTAMENTO || status === ServantStatus.RECICLAGEM;
  }

  private toApiServant(servant: ServantWithRelations) {
    const sectorsMap = new Map<string, string>();

    for (const relation of servant.servantSectors) {
      sectorsMap.set(relation.sector.id, relation.sector.name);
    }

    if (servant.mainSector) {
      sectorsMap.set(servant.mainSector.id, servant.mainSector.name);
    }

    const sectorIds = [...sectorsMap.keys()];
    const sectorNames = [...sectorsMap.values()];

    return {
      ...servant,
      statusRaw: servant.status,
      status: this.mapDbStatus(servant.status),
      statusView: this.mapDbStatus(servant.status),
      linkedUserId: servant.userAccount?.id ?? null,
      linkedUserName: servant.userAccount?.name ?? null,
      linkedUserEmail: servant.userAccount?.email ?? null,
      linkedUserStatus: servant.userAccount?.status ?? null,
      sectorIds,
      sectorNames,
      sectorId: sectorIds[0] ?? null,
      sectorName: sectorNames[0] ?? null,
      teamId: servant.team?.id ?? servant.teamId ?? null,
      teamName: servant.team?.name ?? null,
      teamIds: servant.team?.id ? [servant.team.id] : servant.teamId ? [servant.teamId] : [],
    };
  }

  private async resolveAndValidateSectorIds(
    sectorIds: string[] | undefined,
    mainSectorId: string | undefined,
    requireAtLeastOne: boolean,
  ) {
    const merged = [...new Set([...(sectorIds ?? []), ...(mainSectorId ? [mainSectorId] : [])])];

    if (requireAtLeastOne && merged.length === 0) {
      throw new BadRequestException({
        code: 'SERVANT_SECTOR_REQUIRED',
        message: 'At least one sector must be informed',
      });
    }

    if (merged.length === 0) {
      return merged;
    }

    const sectors = await this.prisma.sector.findMany({
      where: { id: { in: merged } },
      select: { id: true },
    });

    if (sectors.length !== merged.length) {
      throw new BadRequestException({
        code: 'SERVANT_SECTOR_INVALID',
        message: 'One or more informed sectors were not found',
      });
    }

    return merged;
  }

  private async resolveCoordinatorCreationSectorIds(
    actor: JwtPayload,
    requestedSectorIds?: string[],
    requestedMainSectorId?: string,
  ) {
    const allowedSectorIds = await resolveScopedSectorIds(this.prisma, actor);
    if (!allowedSectorIds.length) {
      throw new ForbiddenException('Coordinator has no sector scope configured');
    }

    const requested = [...new Set([...(requestedSectorIds ?? []), ...(requestedMainSectorId ? [requestedMainSectorId] : [])])];
    if (!requested.length) {
      return [allowedSectorIds[0]];
    }

    const outOfScope = requested.some((sectorId) => !allowedSectorIds.includes(sectorId));
    if (outOfScope) {
      throw new ForbiddenException('You can only request servant creation inside your own sector scope');
    }

    return [requested[0]];
  }

  private async resolveAndValidateTeamId(
    teamId: string | undefined,
    sectorIds: string[],
  ) {
    if (!teamId) {
      return null;
    }

    if (teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, sectorId: true },
      });

      if (!team) {
        throw new BadRequestException({
          code: 'SERVANT_TEAM_INVALID',
          message: 'Team not found',
        });
      }

      if (!sectorIds.includes(team.sectorId)) {
        throw new BadRequestException({
          code: 'SERVANT_TEAM_INVALID',
          message: 'Team must belong to one of servant sectors',
        });
      }

      return team.id;
    }

    return null;
  }

  private async ensureExists(id: string) {
    const servant = await this.prisma.servant.findUnique({ where: { id }, select: { id: true } });
    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
  }

  private assertCanAssignRole(actorRole: Role, targetRole: Role) {
    if (actorRole === Role.SUPER_ADMIN) {
      return;
    }

    if (actorRole === Role.ADMIN) {
      if (targetRole === Role.SUPER_ADMIN) {
        throw new ForbiddenException('ADMIN cannot assign SUPER_ADMIN role');
      }
      return;
    }

    if (actorRole === Role.COORDENADOR) {
      if (targetRole !== Role.LIDER && targetRole !== Role.SERVO) {
        throw new ForbiddenException('COORDENADOR can only create LIDER or SERVO users');
      }
      return;
    }

    throw new ForbiddenException('Role is not allowed to create user accounts');
  }

  private async assertCanManageServant(actor: JwtPayload, servantId: string) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) {
      return;
    }

    if (actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('You do not have permission to manage this servant');
    }

    const where = await this.buildScopedServantWhere(actor, servantId);
    const servant = await this.prisma.servant.findFirst({
      where,
      select: { id: true },
    });

    if (!servant) {
      throw new ForbiddenException('You do not have permission to manage this servant');
    }
  }

  private async assertCanManageSectorSet(actor: JwtPayload, sectorIds: string[]) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) {
      return;
    }

    if (actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('This profile cannot manage servants');
    }

    const allowedSectorIds = await resolveScopedSectorIds(this.prisma, actor);
    const hasInvalidSector = sectorIds.some((sectorId) => !allowedSectorIds.includes(sectorId));

    if (hasInvalidSector) {
      throw new ForbiddenException('You can only manage servants from your allowed sectors');
    }
  }

  private async buildScopedServantWhere(actor: JwtPayload, servantId: string) {
    const accessWhere = await getServantAccessWhere(this.prisma, actor);

    if (!accessWhere) {
      return { id: servantId } satisfies Prisma.ServantWhereInput;
    }

    return { AND: [{ id: servantId }, accessWhere] } satisfies Prisma.ServantWhereInput;
  }

}
