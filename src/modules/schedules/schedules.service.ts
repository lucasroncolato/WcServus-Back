import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditAction, ScheduleStatus, ServantStatus, TrainingStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GenerateMonthScheduleDto } from './dto/generate-month-schedule.dto';
import { GenerateYearScheduleDto } from './dto/generate-year-schedule.dto';
import { ListSchedulesQueryDto } from './dto/list-schedules-query.dto';
import { SwapScheduleDto } from './dto/swap-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(query: ListSchedulesQueryDto) {
    return this.prisma.schedule.findMany({
      where: {
        serviceId: query.serviceId,
        sectorId: query.sectorId,
        servantId: query.servantId,
      },
      include: {
        service: true,
        servant: true,
        sector: true,
        assignedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateScheduleDto, actorUserId: string) {
    await this.validateScheduleInput(dto.serviceId, dto.sectorId, dto.servantId);
    await this.ensureNoConflict(dto.serviceId, dto.servantId, dto.sectorId);

    const schedule = await this.prisma.schedule.create({
      data: {
        serviceId: dto.serviceId,
        sectorId: dto.sectorId,
        servantId: dto.servantId,
        classGroup: dto.classGroup,
        assignedByUserId: actorUserId,
      },
      include: {
        service: true,
        servant: true,
        sector: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'Schedule',
      entityId: schedule.id,
      userId: actorUserId,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return schedule;
  }

  async generateMonth(dto: GenerateMonthScheduleDto, actorUserId: string) {
    const start = new Date(Date.UTC(dto.year, dto.month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(dto.year, dto.month, 0, 23, 59, 59));

    return this.generateBetween(start, end, dto.sectorIds, dto.classGroup, actorUserId);
  }

  async generateYear(dto: GenerateYearScheduleDto, actorUserId: string) {
    const start = new Date(Date.UTC(dto.year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(dto.year, 11, 31, 23, 59, 59));

    return this.generateBetween(start, end, dto.sectorIds, dto.classGroup, actorUserId);
  }

  async swap(dto: SwapScheduleDto, actorUserId: string) {
    if (dto.fromScheduleId === dto.toScheduleId) {
      throw new BadRequestException('Schedules must be different for swap');
    }

    const [from, to] = await Promise.all([
      this.prisma.schedule.findUnique({ where: { id: dto.fromScheduleId }, include: { service: true } }),
      this.prisma.schedule.findUnique({ where: { id: dto.toScheduleId }, include: { service: true } }),
    ]);

    if (!from || !to) {
      throw new NotFoundException('One or more schedules were not found');
    }

    if (from.serviceId !== to.serviceId) {
      throw new BadRequestException('Swap must happen inside the same worship service');
    }

    await this.ensureServantEligibleForSector(to.servantId, from.sectorId);
    await this.ensureServantEligibleForSector(from.servantId, to.sectorId);

    const hasConflictFrom = await this.prisma.schedule.findFirst({
      where: {
        serviceId: from.serviceId,
        sectorId: from.sectorId,
        servantId: to.servantId,
        NOT: { id: from.id },
      },
      select: { id: true },
    });

    const hasConflictTo = await this.prisma.schedule.findFirst({
      where: {
        serviceId: to.serviceId,
        sectorId: to.sectorId,
        servantId: from.servantId,
        NOT: { id: to.id },
      },
      select: { id: true },
    });

    if (hasConflictFrom || hasConflictTo) {
      throw new BadRequestException('Swap creates a sector conflict');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id: from.id },
        data: { servantId: to.servantId, status: ScheduleStatus.SWAPPED },
      });

      await tx.schedule.update({
        where: { id: to.id },
        data: { servantId: from.servantId, status: ScheduleStatus.SWAPPED },
      });

      await tx.scheduleSwapHistory.create({
        data: {
          fromScheduleId: from.id,
          toScheduleId: to.id,
          reason: dto.reason,
          swappedByUserId: actorUserId,
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.SCHEDULE_SWAP,
      entity: 'ScheduleSwap',
      entityId: from.id,
      userId: actorUserId,
      metadata: {
        fromScheduleId: from.id,
        toScheduleId: to.id,
        reason: dto.reason,
      },
    });

    return { message: 'Swap completed successfully' };
  }

  async update(id: string, dto: UpdateScheduleDto, actorUserId: string) {
    const existing = await this.prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    if (!dto.servantId && dto.classGroup === undefined) {
      throw new BadRequestException('Nothing to update in schedule');
    }

    if (dto.servantId) {
      await this.ensureServantEligibleForSector(dto.servantId, existing.sectorId);

      const conflict = await this.prisma.schedule.findFirst({
        where: {
          serviceId: existing.serviceId,
          servantId: dto.servantId,
          NOT: { id },
        },
        select: { id: true },
      });

      if (conflict) {
        throw new BadRequestException('Servant is already assigned to this worship service');
      }
    }

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: {
        servantId: dto.servantId,
        classGroup: dto.classGroup,
        status: dto.servantId ? ScheduleStatus.SWAPPED : undefined,
      },
      include: {
        service: true,
        servant: true,
        sector: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'Schedule',
      entityId: id,
      userId: actorUserId,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return updated;
  }

  swapHistory(limit = 100) {
    return this.prisma.scheduleSwapHistory.findMany({
      include: {
        swappedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        fromSchedule: {
          include: { servant: true, sector: true, service: true },
        },
        toSchedule: {
          include: { servant: true, sector: true, service: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async generateBetween(
    start: Date,
    end: Date,
    sectorIds: string[] | undefined,
    classGroup: string | undefined,
    actorUserId: string,
  ) {
    const services = await this.prisma.worshipService.findMany({
      where: {
        serviceDate: { gte: start, lte: end },
      },
      orderBy: { serviceDate: 'asc' },
    });

    if (services.length === 0) {
      return { created: 0, skipped: 0, reason: 'No worship services in period' };
    }

    const sectors = await this.prisma.sector.findMany({
      where: { id: sectorIds ? { in: sectorIds } : undefined },
      orderBy: { name: 'asc' },
    });

    const sectorServants = await this.prisma.servant.findMany({
      where: {
        status: ServantStatus.ATIVO,
        trainingStatus: TrainingStatus.COMPLETED,
        servantSectors: { some: { sectorId: { in: sectors.map((s) => s.id) } } },
        classGroup: classGroup ?? undefined,
      },
      include: {
        servantSectors: {
          select: { sectorId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const poolBySector = new Map<string, typeof sectorServants>();
    for (const sector of sectors) {
      poolBySector.set(
        sector.id,
        sectorServants.filter((servant) =>
          servant.servantSectors.some((servantSector) => servantSector.sectorId === sector.id),
        ),
      );
    }

    const historicalStart = new Date(start);
    historicalStart.setDate(historicalStart.getDate() - 45);

    const historySchedules = await this.prisma.schedule.findMany({
      where: {
        service: { serviceDate: { gte: historicalStart, lte: end } },
      },
      include: { service: true },
      orderBy: { createdAt: 'asc' },
    });

    const usage = new Map<string, { count: number; lastAssignedAt: Date | null }>();
    for (const schedule of historySchedules) {
      const current = usage.get(schedule.servantId) ?? { count: 0, lastAssignedAt: null };
      current.count += 1;
      if (!current.lastAssignedAt || schedule.service.serviceDate > current.lastAssignedAt) {
        current.lastAssignedAt = schedule.service.serviceDate;
      }
      usage.set(schedule.servantId, current);
    }

    let created = 0;
    let skipped = 0;

    for (const service of services) {
      const assignedInService = new Set(
        (
          await this.prisma.schedule.findMany({
            where: { serviceId: service.id },
            select: { servantId: true },
          })
        ).map((s) => s.servantId),
      );

      for (const sector of sectors) {
        const exists = await this.prisma.schedule.findFirst({
          where: { serviceId: service.id, sectorId: sector.id, classGroup: classGroup ?? undefined },
          select: { id: true },
        });

        if (exists) {
          skipped += 1;
          continue;
        }

        const pool = poolBySector.get(sector.id) ?? [];
        const available = pool.filter((servant) => !assignedInService.has(servant.id));

        if (available.length === 0) {
          skipped += 1;
          continue;
        }

        available.sort((a, b) => {
          const usageA = usage.get(a.id) ?? { count: 0, lastAssignedAt: null };
          const usageB = usage.get(b.id) ?? { count: 0, lastAssignedAt: null };

          const restA = usageA.lastAssignedAt
            ? (service.serviceDate.getTime() - usageA.lastAssignedAt.getTime()) / (1000 * 60 * 60 * 24)
            : 999;
          const restB = usageB.lastAssignedAt
            ? (service.serviceDate.getTime() - usageB.lastAssignedAt.getTime()) / (1000 * 60 * 60 * 24)
            : 999;

          if (restA !== restB) {
            return restB - restA;
          }

          if (usageA.count !== usageB.count) {
            return usageA.count - usageB.count;
          }

          return a.name.localeCompare(b.name);
        });

        const selected = available[0];

        await this.prisma.schedule.create({
          data: {
            serviceId: service.id,
            sectorId: sector.id,
            servantId: selected.id,
            classGroup,
            assignedByUserId: actorUserId,
          },
        });

        const currentUsage = usage.get(selected.id) ?? { count: 0, lastAssignedAt: null };
        currentUsage.count += 1;
        currentUsage.lastAssignedAt = service.serviceDate;
        usage.set(selected.id, currentUsage);
        assignedInService.add(selected.id);
        created += 1;
      }
    }

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ScheduleGeneration',
      entityId: `${start.toISOString()}_${end.toISOString()}`,
      userId: actorUserId,
      metadata: { created, skipped, classGroup, sectorIds },
    });

    return { created, skipped, services: services.length, sectors: sectors.length };
  }

  private async validateScheduleInput(serviceId: string, sectorId: string, servantId: string) {
    const [service, sector] = await Promise.all([
      this.prisma.worshipService.findUnique({ where: { id: serviceId }, select: { id: true } }),
      this.prisma.sector.findUnique({ where: { id: sectorId }, select: { id: true } }),
    ]);

    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    if (!sector) {
      throw new NotFoundException('Sector not found');
    }

    await this.ensureServantEligibleForSector(servantId, sectorId);
  }

  private async ensureNoConflict(serviceId: string, servantId: string, sectorId: string) {
    const serviceConflict = await this.prisma.schedule.findFirst({
      where: { serviceId, servantId },
      select: { id: true },
    });

    if (serviceConflict) {
      throw new BadRequestException('Servant is already assigned to this worship service');
    }

    const sectorConflict = await this.prisma.schedule.findFirst({
      where: { serviceId, sectorId, servantId },
      select: { id: true },
    });

    if (sectorConflict) {
      throw new BadRequestException('Servant is already assigned in this sector for the service');
    }
  }

  private async ensureServantEligibleForSector(servantId: string, sectorId: string) {
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: {
        id: true,
        status: true,
        trainingStatus: true,
        mainSectorId: true,
        servantSectors: {
          where: { sectorId },
          select: { id: true },
        },
      },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    if (servant.status !== ServantStatus.ATIVO) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo em treinamento ou inativo nao pode ser escalado.',
        details: {
          servantId: servant.id,
          status: servant.status,
          trainingStatus: servant.trainingStatus,
        },
      });
    }

    if (servant.trainingStatus !== TrainingStatus.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo em treinamento ou inativo nao pode ser escalado.',
        details: {
          servantId: servant.id,
          status: servant.status,
          trainingStatus: servant.trainingStatus,
        },
      });
    }

    const belongsToSector =
      servant.mainSectorId === sectorId || servant.servantSectors.length > 0;

    if (!belongsToSector) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo em treinamento ou inativo nao pode ser escalado.',
        details: {
          servantId: servant.id,
          status: servant.status,
          trainingStatus: servant.trainingStatus,
          sectorId,
          reason: 'SERVANT_NOT_IN_SECTOR',
        },
      });
    }
  }
}
