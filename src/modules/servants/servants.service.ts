import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ServantStatus,
  TrainingStatus,
  type Servant,
  type Sector,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CompleteTrainingDto } from './dto/complete-training.dto';
import { CreateServantDto, ServantActiveStatusDto } from './dto/create-servant.dto';
import { ListServantsQueryDto } from './dto/list-servants-query.dto';
import { UpdateServantStatusDto } from './dto/update-servant-status.dto';
import { UpdateServantDto } from './dto/update-servant.dto';

type ServantWithSectors = Servant & {
  mainSector: Sector | null;
  servantSectors: Array<{ sector: Sector }>;
};

@Injectable()
export class ServantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: ListServantsQueryDto) {
    const servants = await this.prisma.servant.findMany({
      where: {
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
      },
      include: {
        mainSector: true,
        servantSectors: {
          include: { sector: true },
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    return servants.map((servant) => this.toApiServant(servant));
  }

  async findOne(id: string) {
    const servant = await this.prisma.servant.findUniqueOrThrow({
      where: { id },
      include: {
        mainSector: true,
        servantSectors: {
          include: { sector: true },
        },
      },
    });

    return this.toApiServant(servant);
  }

  async create(dto: CreateServantDto, actorUserId?: string) {
    const sectorIds = await this.resolveAndValidateSectorIds(dto.sectorIds, dto.mainSectorId, true);

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
        include: {
          mainSector: true,
          servantSectors: { include: { sector: true } },
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'Servant',
      entityId: servant.id,
      userId: actorUserId,
      metadata: {
        sectorIds,
        trainingStatus: TrainingStatus.PENDING,
      },
    });

    return this.toApiServant(servant);
  }

  async update(id: string, dto: UpdateServantDto, actorUserId?: string) {
    const existing = await this.prisma.servant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Servant not found');
    }

    const resolvedSectorIds =
      dto.sectorIds !== undefined || dto.mainSectorId !== undefined
        ? await this.resolveAndValidateSectorIds(dto.sectorIds, dto.mainSectorId, true)
        : undefined;

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
        include: {
          mainSector: true,
          servantSectors: {
            include: { sector: true },
          },
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'Servant',
      entityId: id,
      userId: actorUserId,
      metadata: {
        ...dto,
        sectorIds: resolvedSectorIds,
      } as unknown as Record<string, unknown>,
    });

    return this.toApiServant(servant);
  }

  async updateStatus(id: string, dto: UpdateServantStatusDto, actorUserId?: string) {
    const existing = await this.prisma.servant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Servant not found');
    }

    const toStatus = this.mapDtoStatus(dto.status);
    if (existing.status === toStatus) {
      return this.findOne(id);
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
      userId: actorUserId,
      metadata: { from: existing.status, to: toStatus, reason: dto.reason },
    });

    return this.findOne(id);
  }

  async completeTraining(id: string, dto: CompleteTrainingDto, actorUserId?: string) {
    await this.ensureExists(id);

    const updated = await this.prisma.servant.update({
      where: { id },
      data: { trainingStatus: TrainingStatus.COMPLETED },
      include: {
        mainSector: true,
        servantSectors: { include: { sector: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'ServantTraining',
      entityId: id,
      userId: actorUserId,
      metadata: { trainingStatus: TrainingStatus.COMPLETED, notes: dto.notes },
    });

    return this.toApiServant(updated);
  }

  async history(id: string) {
    await this.ensureExists(id);

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
      include: {
        mainSector: true,
        servantSectors: { include: { sector: true } },
      },
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

  private toApiServant(servant: ServantWithSectors) {
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
}