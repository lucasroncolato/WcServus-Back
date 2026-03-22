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
  ServantStatus,
  TrainingStatus,
  UserStatus,
  type Sector,
  type Servant,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { CompleteTrainingDto } from './dto/complete-training.dto';
import { CreateServantWithUserDto } from './dto/create-servant-with-user.dto';
import { CreateServantDto, ServantActiveStatusDto } from './dto/create-servant.dto';
import { LinkServantUserDto } from './dto/link-servant-user.dto';
import { ListServantsQueryDto } from './dto/list-servants-query.dto';
import { UpdateServantStatusDto } from './dto/update-servant-status.dto';
import { UpdateServantDto } from './dto/update-servant.dto';

type ServantWithRelations = Servant & {
  mainSector: Sector | null;
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
  ) {}

  private readonly servantInclude = {
    mainSector: true,
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
    const accessWhere = await this.getServantAccessWhere(actor);

    const queryWhere: Prisma.ServantWhereInput = {
      status: this.mapQueryStatus(query.status),
      trainingStatus: query.trainingStatus,
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

  async create(dto: CreateServantDto, actor: JwtPayload) {
    const sectorIds = await this.resolveAndValidateSectorIds(dto.sectorIds, dto.mainSectorId, true);
    await this.assertCanManageSectorSet(actor, sectorIds);

    const servant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.servant.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          gender: dto.gender,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          status: this.mapDtoStatus(dto.status ?? ServantActiveStatusDto.ACTIVE),
          trainingStatus: TrainingStatus.PENDING,
          aptitude: dto.aptitude,
          classGroup: dto.classGroup,
          mainSectorId: sectorIds[0],
          notes: dto.notes,
          joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        },
      });

      await tx.servantSector.createMany({
        data: sectorIds.map((sectorId) => ({ servantId: created.id, sectorId })),
      });

      await tx.servantStatusHistory.create({
        data: {
          servantId: created.id,
          toStatus: created.status,
          reason: 'Initial status on creation',
        },
      });

      return tx.servant.findUniqueOrThrow({
        where: { id: created.id },
        include: this.servantInclude,
      });
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'Servant',
      entityId: servant.id,
      userId: actor.sub,
      metadata: {
        sectorIds,
        trainingStatus: TrainingStatus.PENDING,
      },
    });

    return this.toApiServant(servant);
  }

  async createWithUser(dto: CreateServantWithUserDto, actor: JwtPayload) {
    const sectorIds = await this.resolveAndValidateSectorIds(dto.sectorIds, dto.mainSectorId, true);
    await this.assertCanManageSectorSet(actor, sectorIds);

    const email = dto.user.email.toLowerCase();
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingByEmail) {
      throw new ConflictException('Email already in use');
    }

    const targetRole = dto.user.role ?? Role.SERVO;
    this.assertCanAssignRole(actor.role, targetRole);

    const passwordHash = await bcrypt.hash(dto.user.password, 10);

    const servant = await this.prisma.$transaction(async (tx) => {
      const createdServant = await tx.servant.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          gender: dto.gender,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          status: this.mapDtoStatus(dto.status ?? ServantActiveStatusDto.ACTIVE),
          trainingStatus: TrainingStatus.PENDING,
          aptitude: dto.aptitude,
          classGroup: dto.classGroup,
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
          status: dto.user.status ?? UserStatus.ACTIVE,
          phone: dto.user.phone ?? createdServant.phone ?? null,
          servantId: createdServant.id,
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
        userRole: targetRole,
      },
    });

    return this.toApiServant(servant);
  }

  async linkUser(servantId: string, dto: LinkServantUserDto, actor: JwtPayload) {
    await this.assertCanManageServant(actor, servantId);

    if (dto.userId === null) {
      const linked = await this.prisma.user.findFirst({
        where: { servantId },
        select: { id: true },
      });

      if (linked) {
        await this.prisma.user.update({
          where: { id: linked.id },
          data: { servantId: null },
        });
      }
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

    return this.findOne(servantId, actor);
  }

  async update(id: string, dto: UpdateServantDto, actor: JwtPayload) {
    await this.assertCanManageServant(actor, id);

    const existing = await this.prisma.servant.findUnique({ where: { id } });
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

    const servant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.servant.update({
        where: { id },
        data: {
          name: dto.name,
          phone: dto.phone,
          gender: dto.gender,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          status: dto.status ? this.mapDtoStatus(dto.status) : undefined,
          trainingStatus: dto.trainingStatus,
          aptitude: dto.aptitude,
          classGroup: dto.classGroup,
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

      if (dto.status && this.mapDtoStatus(dto.status) !== existing.status) {
        await tx.servantStatusHistory.create({
          data: {
            servantId: id,
            fromStatus: existing.status,
            toStatus: this.mapDtoStatus(dto.status),
            reason: 'Updated in servant profile',
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
      } as unknown as Record<string, unknown>,
    });

    return this.toApiServant(servant);
  }

  async updateStatus(id: string, dto: UpdateServantStatusDto, actor: JwtPayload) {
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
    await this.ensureExists(id);

    const updated = await this.prisma.servant.update({
      where: { id },
      data: { trainingStatus: TrainingStatus.COMPLETED },
      include: this.servantInclude,
    });

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'ServantTraining',
      entityId: id,
      userId: actor.sub,
      metadata: { trainingStatus: TrainingStatus.COMPLETED, notes: dto.notes },
    });

    return this.toApiServant(updated);
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
      status: this.mapDbStatus(servant.status),
      sectorIds,
      sectorNames,
      sectorId: sectorIds[0] ?? null,
      sectorName: sectorNames[0] ?? null,
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
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
      return;
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
    if (
      actor.role === Role.SUPER_ADMIN ||
      actor.role === Role.ADMIN ||
      actor.role === Role.PASTOR
    ) {
      return;
    }

    if (actor.role !== Role.COORDENADOR && actor.role !== Role.LIDER) {
      throw new ForbiddenException('This profile cannot manage servants');
    }

    const allowedSectorIds = await this.resolveScopedSectorIds(actor);
    const hasInvalidSector = sectorIds.some((sectorId) => !allowedSectorIds.includes(sectorId));

    if (hasInvalidSector) {
      throw new ForbiddenException('You can only manage servants from your allowed sectors');
    }
  }

  private async buildScopedServantWhere(actor: JwtPayload, servantId: string) {
    const accessWhere = await this.getServantAccessWhere(actor);

    if (!accessWhere) {
      return { id: servantId } satisfies Prisma.ServantWhereInput;
    }

    return { AND: [{ id: servantId }, accessWhere] } satisfies Prisma.ServantWhereInput;
  }

  private async getServantAccessWhere(actor: JwtPayload): Promise<Prisma.ServantWhereInput | undefined> {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
      return undefined;
    }

    if (actor.role === Role.SERVO) {
      return actor.servantId ? { id: actor.servantId } : { id: '__no_access__' };
    }

    if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
      const sectorIds = await this.resolveScopedSectorIds(actor);
      if (sectorIds.length === 0) {
        return { id: '__no_access__' };
      }

      return {
        OR: [
          { mainSectorId: { in: sectorIds } },
          { servantSectors: { some: { sectorId: { in: sectorIds } } } },
        ],
      };
    }

    return { id: '__no_access__' };
  }

  private async resolveScopedSectorIds(actor: JwtPayload) {
    if (actor.role === Role.COORDENADOR) {
      const sectors = await this.prisma.sector.findMany({
        where: { coordinatorUserId: actor.sub },
        select: { id: true },
      });
      return sectors.map((sector) => sector.id);
    }

    if (actor.role === Role.LIDER) {
      if (!actor.servantId) {
        return [];
      }

      const actorServant = await this.prisma.servant.findUnique({
        where: { id: actor.servantId },
        select: {
          mainSectorId: true,
          servantSectors: {
            select: { sectorId: true },
          },
        },
      });

      if (!actorServant) {
        return [];
      }

      const ids = [
        ...(actorServant.mainSectorId ? [actorServant.mainSectorId] : []),
        ...actorServant.servantSectors.map((item) => item.sectorId),
      ];

      return [...new Set(ids)];
    }

    return [];
  }
}
