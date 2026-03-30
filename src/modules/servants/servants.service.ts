import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  Aptitude,
  Gender,
  Prisma,
  Role,
  ServantApprovalStatus,
  ServantStatus,
  TrainingStatus,
  UserScope,
  UserStatus,
  type Ministry,
  type Servant,
  type Team,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getServantAccessWhere, resolveScopedSectorIds } from 'src/common/auth/access-scope';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { EventBusService } from 'src/common/events/event-bus.service';
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
  mainMinistry: Ministry | null;
  team: Team | null;
  servantMinistries: Array<{
    ministryId: string;
    trainingStatus: TrainingStatus;
    trainingCompletedAt: Date | null;
    trainingReviewedByUserId: string | null;
    trainingNotes: string | null;
    ministry: Ministry;
  }>;
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
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventBus: EventBusService = {
      emit: async () => undefined,
    } as unknown as EventBusService,
    private readonly tenantIntegrity: TenantIntegrityService = {
      assertSameChurch: () => undefined,
      assertActorChurch: () => '',
      assertLinkIntegrity: () => undefined,
    } as unknown as TenantIntegrityService,
  ) {}

  private readonly servantInclude = {
    mainMinistry: true,
    team: true,
    servantMinistries: {
      include: {
        ministry: true,
      },
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
    const ministryId = query.ministryId ?? query.ministryId;

    const queryWhere: Prisma.ServantWhereInput = {
      status: this.mapQueryStatus(query.status),
      trainingStatus: query.trainingStatus,
      approvalStatus: query.approvalStatus,
      teamId: query.teamId,
      OR: ministryId
        ? [{ mainMinistryId: ministryId }, { servantMinistries: { some: { ministryId } } }]
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

  async getCreateFormMetadata(actor: JwtPayload) {
    const allowedSectorIds =
      actor.role === Role.COORDENADOR
        ? await resolveScopedSectorIds(this.prisma, actor)
        : undefined;

    const whereSectors: Prisma.MinistryWhereInput | undefined = allowedSectorIds
      ? { id: { in: allowedSectorIds } }
      : undefined;

    const ministries = await this.prisma.ministry.findMany({
      where: whereSectors,
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    const teams = await this.prisma.team.findMany({
      where: allowedSectorIds ? { ministryId: { in: allowedSectorIds } } : undefined,
      select: {
        id: true,
        name: true,
        ministryId: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    return {
      contractVersion: '2026-03-26',
      summary: {
        required: ['name', 'user.email'],
        optional: [
          'phone',
          'gender',
          'birthDate',
          'aptitude',
          'ministryIds',
          'mainMinistryId',
          'teamId',
          'notes',
          'joinedAt',
          'user.name',
          'user.phone',
        ],
      },
      sections: [
        {
          key: 'basic',
          title: 'Dados basicos',
          fields: ['name', 'phone', 'gender', 'birthDate', 'aptitude'],
        },
        {
          key: 'ministry',
          title: 'Ministerio e equipe',
          fields: ['mainMinistryId', 'ministryIds', 'teamId'],
        },
        {
          key: 'account',
          title: 'Conta de acesso',
          fields: ['user.email', 'user.name', 'user.phone'],
        },
      ],
      options: {
        genders: Object.values(Gender),
        aptitudes: Object.values(Aptitude),
        ministries: ministries.map((ministry) => ({
          id: ministry.id,
          ministryId: ministry.id,
          name: ministry.name,
          ministryName: ministry.name,
        })),
        teams,
      },
      defaults: {
        ministryIds: actor.role === Role.COORDENADOR && ministries[0] ? [ministries[0].id] : [],
        user: {
          role: Role.SERVO,
        },
      },
      payloadTemplate: {
        name: '',
        phone: null,
        gender: null,
        birthDate: null,
        aptitude: null,
        mainMinistryId: null,
        ministryIds: [],
        teamId: null,
        notes: null,
        joinedAt: null,
        user: {
          email: '',
          name: null,
          phone: null,
          role: Role.SERVO,
        },
      },
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
    const ministryIds = isCoordinatorRequest
      ? await this.resolveCoordinatorCreationSectorIds(actor, dto.ministryIds, dto.mainMinistryId)
      : await this.resolveAndValidateSectorIds(
          actor,
          dto.ministryIds ?? dto.ministryIds,
          dto.mainMinistryId ?? dto.mainMinistryId,
          true,
        );
    await this.assertCanManageSectorSet(actor, ministryIds);
    const teamId = await this.resolveAndValidateTeamId(actor, dto.teamId, ministryIds);

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

    const initialPassword = this.configService.get<string>(
      'ONBOARDING_DEFAULT_PASSWORD',
      'Servus@123',
    );
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    let servant: ServantWithRelations;
    try {
      servant = await this.prisma.$transaction(async (tx) => {
        const actorChurchId = this.tenantIntegrity.assertActorChurch(actor);
        const createdServant = await tx.servant.create({
          data: {
            churchId: actorChurchId,
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
            mainMinistryId: ministryIds[0],
            notes: dto.notes,
            joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
          },
        });

        await tx.servantMinistry.createMany({
          data: ministryIds.map((ministryId) => ({ servantId: createdServant.id, ministryId })),
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
            churchId: actorChurchId,
            mustChangePassword: true,
          },
        });

        return tx.servant.findUniqueOrThrow({
          where: { id: createdServant.id },
          include: this.servantInclude,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(',')
          : String(error.meta?.target ?? '');
        if (target.includes('email')) {
          throw new ConflictException('Email already in use');
        }
        if (target.includes('servantId')) {
          throw new ConflictException('Servant is already linked to another user');
        }
      }
      throw error;
    }

    await this.auditService.log({
      action: AuditAction.CREATE_SERVANT,
      entity: 'ServantWithUser',
      entityId: servant.id,
      userId: actor.sub,
      metadata: {
        ministryIds,
        teamId,
        userRole: targetRole,
        approvalStatus: isCoordinatorRequest ? ServantApprovalStatus.PENDING : ServantApprovalStatus.APPROVED,
      },
    });

    await this.eventBus.emit({
      name: 'SERVANT_CREATED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: (servant as unknown as { churchId?: string | null }).churchId ?? null,
      payload: {
        servantId: servant.id,
        ministryIds,
        teamId,
      },
    });

    return {
      message: 'Servant and user created successfully',
      data: this.toApiServant(servant),
    };
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
        select: { id: true, servantId: true, churchId: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }
      this.tenantIntegrity.assertSameChurch(
        this.tenantIntegrity.assertActorChurch(actor),
        user.churchId,
        'User',
      );

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
        churchId: true,
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
    this.tenantIntegrity.assertSameChurch(
      this.tenantIntegrity.assertActorChurch(actor),
      servant.churchId,
      'Servant',
    );

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
        churchId: this.tenantIntegrity.assertActorChurch(actor),
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
        mainMinistryId: true,
        servantMinistries: {
          select: {
            ministryId: true,
            trainingStatus: true,
            trainingCompletedAt: true,
            trainingReviewedByUserId: true,
            trainingNotes: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Servant not found');
    }

    const resolvedSectorIds =
      dto.ministryIds !== undefined ||
      dto.mainMinistryId !== undefined ||
      dto.ministryIds !== undefined ||
      dto.mainMinistryId !== undefined
        ? await this.resolveAndValidateSectorIds(
            actor,
            dto.ministryIds ?? dto.ministryIds,
            dto.mainMinistryId ?? dto.mainMinistryId,
            true,
          )
        : undefined;

    if (resolvedSectorIds) {
      await this.assertCanManageSectorSet(actor, resolvedSectorIds);
    }

    const fallbackSectorIds =
      resolvedSectorIds ??
      [
        ...(existing.mainMinistryId ? [existing.mainMinistryId] : []),
        ...existing.servantMinistries.map((item) => item.ministryId),
      ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
    const resolvedTeamId =
      dto.teamId !== undefined || resolvedSectorIds !== undefined
        ? await this.resolveAndValidateTeamId(actor, dto.teamId, fallbackSectorIds)
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
          mainMinistryId: resolvedSectorIds ? resolvedSectorIds[0] : undefined,
          notes: dto.notes,
          joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        },
      });

      if (resolvedSectorIds) {
        const existingSectorIds = new Set(existing.servantMinistries.map((item) => item.ministryId));
        const nextSectorIds = new Set(resolvedSectorIds);

        await tx.servantMinistry.deleteMany({
          where: {
            servantId: id,
            ministryId: { notIn: resolvedSectorIds },
          },
        });

        const newSectorIds = resolvedSectorIds.filter((ministryId) => !existingSectorIds.has(ministryId));
        await tx.servantMinistry.createMany({
          data: newSectorIds.map((ministryId) => ({ servantId: id, ministryId })),
          skipDuplicates: true,
        });

        // Mantem treinamento por ministerio nos vinculos ja existentes.
        for (const relation of existing.servantMinistries) {
          if (!nextSectorIds.has(relation.ministryId)) {
            continue;
          }
          await tx.servantMinistry.update({
            where: {
              servantId_ministryId: {
                servantId: id,
                ministryId: relation.ministryId,
              },
            },
            data: {
              trainingStatus: relation.trainingStatus,
              trainingCompletedAt: relation.trainingCompletedAt,
              trainingReviewedByUserId: relation.trainingReviewedByUserId,
              trainingNotes: relation.trainingNotes,
            },
          });
        }
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
      action: AuditAction.UPDATE_SERVANT,
      entity: 'Servant',
      entityId: id,
      userId: actor.sub,
      metadata: {
        ...dto,
        ministryIds: resolvedSectorIds,
        teamId: resolvedTeamId,
      } as unknown as Record<string, unknown>,
    });

    await this.eventBus.emit({
      name: 'SERVANT_UPDATED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: (servant as unknown as { churchId?: string | null }).churchId ?? null,
      payload: {
        servantId: id,
      },
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
      select: {
        id: true,
        status: true,
        trainingStatus: true,
        approvalStatus: true,
        mainMinistryId: true,
        servantMinistries: {
          select: {
            id: true,
            ministryId: true,
            trainingStatus: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Servant not found');
    }
    if (existing.approvalStatus !== ServantApprovalStatus.APPROVED) {
      throw new ForbiddenException('Only approved servants can complete training');
    }

    const availableSectorIds = existing.servantMinistries.map((item) => item.ministryId);
    const targetMinistryId =
      dto.ministryId ??
      (availableSectorIds.length === 1 ? availableSectorIds[0] : null) ??
      (existing.mainMinistryId && availableSectorIds.includes(existing.mainMinistryId)
        ? existing.mainMinistryId
        : null);

    if (!targetMinistryId) {
      throw new BadRequestException(
        'ministryId is required when servant has more than one ministry.',
      );
    }

    if (!availableSectorIds.includes(targetMinistryId)) {
      throw new BadRequestException('Servant is not linked to informed ministry.');
    }

    const promoteToActive = this.shouldPromoteToActiveOnTrainingCompletion(existing.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.servantMinistry.update({
        where: {
          servantId_ministryId: {
            servantId: id,
            ministryId: targetMinistryId,
          },
        },
        data: {
          trainingStatus: TrainingStatus.COMPLETED,
          trainingCompletedAt: new Date(),
          trainingReviewedByUserId: actor.sub,
          trainingNotes: dto.notes ?? null,
        },
      });

      const updatedServantSectors = await tx.servantMinistry.findMany({
        where: { servantId: id },
        select: { trainingStatus: true },
      });
      const allMinistriesCompleted =
        updatedServantSectors.length > 0 &&
        updatedServantSectors.every((entry) => entry.trainingStatus === TrainingStatus.COMPLETED);

      const next = await tx.servant.update({
        where: { id },
        data: {
          trainingStatus: allMinistriesCompleted ? TrainingStatus.COMPLETED : TrainingStatus.PENDING,
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
      action: AuditAction.TRAINING_CHANGE,
      entity: 'ServantTraining',
      entityId: id,
      userId: actor.sub,
      metadata: {
        ministryId: targetMinistryId,
        fromTrainingStatus: existing.trainingStatus,
        toTrainingStatus: updated.trainingStatus,
        fromStatus: existing.status,
        toStatus: promoteToActive ? ServantStatus.ATIVO : existing.status,
        notes: dto.notes,
      },
    });

    await this.eventBus.emit({
      name: 'TRAINING_COMPLETED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: (updated as unknown as { churchId?: string | null }).churchId ?? null,
      payload: {
        servantId: id,
        ministryId: targetMinistryId,
        trainingStatus: updated.trainingStatus,
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
        include: { service: true, ministry: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return { statusHistory, attendanceHistory, scheduleHistory };
  }

  async listActiveServantsBySector(ministryId: string) {
    const servants = await this.prisma.servant.findMany({
      where: {
        status: ServantStatus.ATIVO,
        AND: [
          {
            OR: [{ mainMinistryId: ministryId }, { servantMinistries: { some: { ministryId } } }],
          },
          {
            OR: [
              {
                servantMinistries: {
                  some: {
                    ministryId,
                    trainingStatus: TrainingStatus.COMPLETED,
                  },
                },
              },
              {
                mainMinistryId: ministryId,
                trainingStatus: TrainingStatus.COMPLETED,
                servantMinistries: {
                  none: {
                    ministryId,
                  },
                },
              },
            ],
          },
        ],
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

    for (const relation of servant.servantMinistries) {
      sectorsMap.set(relation.ministry.id, relation.ministry.name);
    }

    if (servant.mainMinistry) {
      sectorsMap.set(servant.mainMinistry.id, servant.mainMinistry.name);
    }

    const ministryIds = [...sectorsMap.keys()];
    const sectorNames = [...sectorsMap.values()];
    const ministryTraining = servant.servantMinistries.map((relation) => ({
      ministryId: relation.ministryId,
      trainingStatus: relation.trainingStatus,
      trainingCompletedAt: relation.trainingCompletedAt,
      trainingReviewedByUserId: relation.trainingReviewedByUserId,
      trainingNotes: relation.trainingNotes,
    }));

    return {
      ...servant,
      statusRaw: servant.status,
      status: this.mapDbStatus(servant.status),
      statusView: this.mapDbStatus(servant.status),
      linkedUserId: servant.userAccount?.id ?? null,
      linkedUserName: servant.userAccount?.name ?? null,
      linkedUserEmail: servant.userAccount?.email ?? null,
      linkedUserStatus: servant.userAccount?.status ?? null,
      ministryIds,
      sectorNames,
      ministryTraining,
      ministryTrainings: ministryTraining,
      trainingByMinistry: ministryTraining,
      ministryNames: sectorNames,
      ministryId: ministryIds[0] ?? null,
      ministryName: sectorNames[0] ?? null,
      sectorName: sectorNames[0] ?? null,
      teamId: servant.team?.id ?? servant.teamId ?? null,
      teamName: servant.team?.name ?? null,
      teamIds: servant.team?.id ? [servant.team.id] : servant.teamId ? [servant.teamId] : [],
    };
  }

  private async resolveAndValidateSectorIds(
    actor: JwtPayload,
    ministryIds: string[] | undefined,
    mainMinistryId: string | undefined,
    requireAtLeastOne: boolean,
  ) {
    const merged = [...new Set([...(ministryIds ?? []), ...(mainMinistryId ? [mainMinistryId] : [])])];

    if (requireAtLeastOne && merged.length === 0) {
      throw new BadRequestException({
        code: 'SERVANT_SECTOR_REQUIRED',
        message: 'At least one ministry must be informed',
      });
    }

    if (merged.length === 0) {
      return merged;
    }

    const ministries = await this.prisma.ministry.findMany({
      where: { id: { in: merged } },
      select: { id: true, churchId: true },
    });

    if (ministries.length !== merged.length) {
      throw new BadRequestException({
        code: 'SERVANT_SECTOR_INVALID',
        message: 'One or more informed ministries were not found',
      });
    }
    const actorChurchId = this.tenantIntegrity.assertActorChurch(actor);
    ministries.forEach((ministry) =>
      this.tenantIntegrity.assertSameChurch(actorChurchId, ministry.churchId, 'Ministry'),
    );

    return merged;
  }

  private async resolveCoordinatorCreationSectorIds(
    actor: JwtPayload,
    requestedSectorIds?: string[],
    requestedMainSectorId?: string,
  ) {
    const allowedSectorIds = await resolveScopedSectorIds(this.prisma, actor);
    if (!allowedSectorIds.length) {
      throw new ForbiddenException('Coordinator has no ministry scope configured');
    }

    const requested = [...new Set([...(requestedSectorIds ?? []), ...(requestedMainSectorId ? [requestedMainSectorId] : [])])];
    if (!requested.length) {
      return [allowedSectorIds[0]];
    }

    const outOfScope = requested.some((ministryId) => !allowedSectorIds.includes(ministryId));
    if (outOfScope) {
      throw new ForbiddenException('You can only request servant creation inside your own ministry scope');
    }

    return [requested[0]];
  }

  private async resolveAndValidateTeamId(
    actor: JwtPayload,
    teamId: string | undefined,
    ministryIds: string[],
  ) {
    if (!teamId) {
      return null;
    }

    if (teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, ministryId: true, churchId: true },
      });

      if (!team) {
        throw new BadRequestException({
          code: 'SERVANT_TEAM_INVALID',
          message: 'Team not found',
        });
      }
      this.tenantIntegrity.assertSameChurch(
        this.tenantIntegrity.assertActorChurch(actor),
        team.churchId,
        'Team',
      );

      if (!ministryIds.includes(team.ministryId)) {
        throw new BadRequestException({
          code: 'SERVANT_TEAM_INVALID',
          message: 'Team must belong to one of servant ministries',
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
      if (targetRole !== Role.SERVO) {
        throw new ForbiddenException('COORDENADOR can only create SERVO users');
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

  private async assertCanManageSectorSet(actor: JwtPayload, ministryIds: string[]) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) {
      return;
    }

    if (actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('This profile cannot manage servants');
    }

    const allowedSectorIds = await resolveScopedSectorIds(this.prisma, actor);
    const hasInvalidSector = ministryIds.some((ministryId) => !allowedSectorIds.includes(ministryId));

    if (hasInvalidSector) {
      throw new ForbiddenException('You can only manage servants from your allowed ministries');
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




