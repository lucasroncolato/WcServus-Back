import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma, Role } from '@prisma/client';
import {
  assertMinistryAccess,
  assertServantAccess,
  getScheduleAccessWhere,
  getServantAccessWhere,
} from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreatePastoralWeeklyFollowUpDto } from './dto/create-pastoral-weekly-follow-up.dto';
import { ListPastoralWeeklyFollowUpsQueryDto } from './dto/list-pastoral-weekly-follow-ups-query.dto';
import { ListPendingPastoralWeeklyFollowUpsQueryDto } from './dto/list-pending-pastoral-weekly-follow-ups-query.dto';

function toUtcDayStart(input: string | Date) {
  const value = new Date(input);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0));
}

function toUtcDayEnd(input: Date) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 23, 59, 59));
}

function toUtcWeekRange(weekStartDate?: string | Date) {
  const start = weekStartDate ? toUtcDayStart(weekStartDate) : toUtcDayStart(new Date());
  const end = toUtcDayEnd(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000));
  return { start, end };
}

@Injectable()
export class PastoralWeeklyFollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: ListPastoralWeeklyFollowUpsQueryDto, actor: JwtPayload) {
    if (query.ministryId) {
      await assertMinistryAccess(this.prisma, actor, query.ministryId);
    }

    const servantScope = await getServantAccessWhere(this.prisma, actor);
    const queryWhere: Prisma.PastoralWeeklyFollowUpWhereInput = {
      servantId: query.servantId,
      ministryId: query.ministryId,
      scheduleId: query.scheduleId,
      responsibleUserId: query.responsibleUserId,
      weekStartDate:
        query.weekStartDateFrom || query.weekStartDateTo
          ? {
              gte: query.weekStartDateFrom ? toUtcDayStart(query.weekStartDateFrom) : undefined,
              lte: query.weekStartDateTo ? toUtcDayEnd(toUtcDayStart(query.weekStartDateTo)) : undefined,
            }
          : undefined,
    };

    const where: Prisma.PastoralWeeklyFollowUpWhereInput = servantScope
      ? {
          AND: [
            queryWhere,
            {
              servant: servantScope,
            },
          ],
        }
      : queryWhere;

    const rows = await this.prisma.pastoralWeeklyFollowUp.findMany({
      where,
      include: {
        servant: {
          select: { id: true, name: true, mainMinistryId: true, teamId: true },
        },
        ministry: {
          select: { id: true, name: true },
        },
        schedule: {
          include: {
            service: {
              select: { id: true, title: true, serviceDate: true },
            },
          },
        },
        responsible: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: [{ weekStartDate: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toFollowUpView(row));
  }

  async create(dto: CreatePastoralWeeklyFollowUpDto, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, dto.servantId);

    const weekStartDate = toUtcDayStart(dto.weekStartDate);
    const weekEndDate = toUtcDayEnd(new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000));
    const scheduleScope = await getScheduleAccessWhere(this.prisma, actor);

    const scheduleBaseWhere: Prisma.ScheduleWhereInput = {
      servantId: dto.servantId,
      service: {
        serviceDate: {
          gte: weekStartDate,
          lte: weekEndDate,
        },
      },
      id: dto.scheduleId,
    };

    const schedule = await this.prisma.schedule.findFirst({
      where: scheduleScope ? { AND: [scheduleBaseWhere, scheduleScope] } : scheduleBaseWhere,
      select: { id: true, ministryId: true, serviceId: true },
    });

    if (!schedule) {
      throw new ForbiddenException(
        'Pastoral weekly follow-up can only be registered for servants scheduled in the selected week and scope',
      );
    }

    if (actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, schedule.ministryId);
    }

    const record = await this.prisma.pastoralWeeklyFollowUp.upsert({
      where: {
        servantId_ministryId_weekStartDate: {
          servantId: dto.servantId,
          ministryId: schedule.ministryId,
          weekStartDate,
        },
      },
      update: {
        scheduleId: schedule.id,
        contactedAt: dto.contactedAt ? new Date(dto.contactedAt) : new Date(),
        notes: dto.notes,
        responsibleUserId: actor.sub,
      },
      create: {
        servantId: dto.servantId,
        ministryId: schedule.ministryId,
        scheduleId: schedule.id,
        weekStartDate,
        contactedAt: dto.contactedAt ? new Date(dto.contactedAt) : new Date(),
        notes: dto.notes,
        responsibleUserId: actor.sub,
      },
      include: {
        servant: {
          select: { id: true, name: true },
        },
        ministry: {
          select: { id: true, name: true },
        },
        schedule: {
          include: {
            service: {
              select: { id: true, title: true, serviceDate: true },
            },
          },
        },
        responsible: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'PastoralWeeklyFollowUp',
      entityId: record.id,
      userId: actor.sub,
      metadata: {
        servantId: dto.servantId,
        weekStartDate: weekStartDate.toISOString(),
        ministryId: schedule.ministryId,
        scheduleId: schedule.id,
      },
    });

    return this.toFollowUpView(record);
  }

  async listPendingByWeek(query: ListPendingPastoralWeeklyFollowUpsQueryDto, actor: JwtPayload) {
    const { start: weekStartDate, end: weekEndDate } = toUtcWeekRange(query.weekStartDate);
    const scheduleScope = await getScheduleAccessWhere(this.prisma, actor);

    const schedules = await this.prisma.schedule.findMany({
      where: scheduleScope
        ? {
            AND: [
              {
                service: {
                  serviceDate: {
                    gte: weekStartDate,
                    lte: weekEndDate,
                  },
                },
              },
              scheduleScope,
            ],
          }
        : {
            service: {
              serviceDate: {
                gte: weekStartDate,
                lte: weekEndDate,
              },
            },
          },
      select: {
        id: true,
        servantId: true,
        ministryId: true,
        serviceId: true,
        service: {
          select: {
            id: true,
            title: true,
            serviceDate: true,
          },
        },
        ministry: {
          select: {
            id: true,
            name: true,
          },
        },
        servant: {
          select: {
            id: true,
            name: true,
            mainMinistryId: true,
            teamId: true,
          },
        },
      },
      orderBy: [{ service: { serviceDate: 'asc' } }, { id: 'asc' }],
    });

    const uniqueSlots = new Map<string, (typeof schedules)[number]>();
    for (const schedule of schedules) {
      if (actor.role === Role.COORDENADOR) {
        await assertMinistryAccess(this.prisma, actor, schedule.ministryId);
      }
      const slotKey = `${schedule.servantId}:${schedule.ministryId}`;
      if (!uniqueSlots.has(slotKey)) {
        uniqueSlots.set(slotKey, schedule);
      }
    }

    const servantMinistryPairs = [...uniqueSlots.values()];
    if (!servantMinistryPairs.length) {
      return {
        weekStartDate,
        weekEndDate,
        summary: {
          total: 0,
          pending: 0,
          completed: 0,
        },
        items: [],
      };
    }

    const followUps = await this.prisma.pastoralWeeklyFollowUp.findMany({
      where: {
        weekStartDate,
        OR: servantMinistryPairs.map((pair) => ({
          servantId: pair.servantId,
          ministryId: pair.ministryId,
        })),
      },
      include: {
        responsible: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    const followUpMap = new Map<string, (typeof followUps)[number]>(
      followUps.map((item) => [`${item.servantId}:${item.ministryId}`, item]),
    );

    const items = servantMinistryPairs.map((slot) => {
      const key = `${slot.servantId}:${slot.ministryId}`;
      const followUp = followUpMap.get(key);

      return {
        servantId: slot.servant.id,
        servantName: slot.servant.name,
        ministryId: slot.ministry.id,
        sectorName: slot.ministry.name,
        weekStartDate,
        weekEndDate,
        scheduleId: slot.id,
        worshipServiceId: slot.service.id,
        worshipServiceTitle: slot.service.title,
        worshipServiceDate: slot.service.serviceDate,
        status: followUp ? 'REALIZADO' : 'PENDENTE',
        type: 'PASTORAL',
        contactedAt: followUp?.contactedAt ?? null,
        notes: followUp?.notes ?? null,
        responsible: followUp?.responsible ?? null,
      };
    });

    return {
      weekStartDate,
      weekEndDate,
      summary: {
        total: items.length,
        pending: items.filter((item) => item.status === 'PENDENTE').length,
        completed: items.filter((item) => item.status === 'REALIZADO').length,
      },
      items,
    };
  }

  private toFollowUpView(
    row: {
      id: string;
      servantId: string;
      ministryId: string;
      scheduleId: string | null;
      weekStartDate: Date;
      contactedAt: Date;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      responsibleUserId: string;
      servant?: { id: string; name: string } | null;
      ministry?: { id: string; name: string } | null;
      schedule?: unknown;
      responsible?: { id: string; name: string; role: Role } | null;
    },
  ) {
    return {
      ...row,
      type: 'PASTORAL',
      status: 'REALIZADO',
      lastContactAt: row.contactedAt,
    };
  }
}



