import { Injectable } from '@nestjs/common';
import { AttendanceStatus, PastoralVisitStatus, Prisma } from '@prisma/client';
import { getServantAccessWhere } from 'src/common/auth/access-scope';
import { AppCacheService } from 'src/common/cache/cache.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PeriodQueryDto } from './dto/period-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AppCacheService,
  ) {}

  async servantsActivityReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);
    const cacheKey = this.cacheKey('servants-activity', actor, period);

    return this.cacheService.getOrSet(cacheKey, async () => {
      const [scheduleGrouped, attendanceGrouped] = await Promise.all([
        this.prisma.schedule.groupBy({
          by: ['servantId'],
          where: {
            service: { serviceDate: period },
            servant: servantWhere ?? undefined,
          },
          _count: { _all: true },
        }),
        this.prisma.attendance.groupBy({
          by: ['servantId', 'status'],
          where: {
            service: { serviceDate: period },
            servant: servantWhere ?? undefined,
          },
          _count: { _all: true },
        }),
      ]);

      const servantIds = [...new Set(scheduleGrouped.map((item) => item.servantId))];
      const servants = servantIds.length
        ? await this.prisma.servant.findMany({
            where: { id: { in: servantIds } },
            select: {
              id: true,
              name: true,
              mainMinistry: { select: { name: true } },
            },
          })
        : [];
      const servantById = new Map(servants.map((item) => [item.id, item]));

      const attendanceMap = new Map<string, { presences: number; absences: number }>();
      for (const item of attendanceGrouped) {
        const current = attendanceMap.get(item.servantId) ?? { presences: 0, absences: 0 };
        if (item.status === AttendanceStatus.PRESENTE) {
          current.presences += item._count._all;
        } else {
          current.absences += item._count._all;
        }
        attendanceMap.set(item.servantId, current);
      }

      const rows = scheduleGrouped.map((item) => {
        const servant = servantById.get(item.servantId);
        const attendance = attendanceMap.get(item.servantId) ?? { presences: 0, absences: 0 };
        return {
          servantId: item.servantId,
          servantName: servant?.name ?? 'Servo',
          ministryName: servant?.mainMinistry?.name ?? null,
          assigned: item._count._all,
          absences: attendance.absences,
          presences: attendance.presences,
        };
      });

      return {
        mostAssigned: [...rows].sort((a, b) => b.assigned - a.assigned).slice(0, 20),
        mostAbsences: [...rows].sort((a, b) => b.absences - a.absences).slice(0, 20),
        ministryLoadByServant: [...rows].sort((a, b) => b.assigned - a.assigned),
      };
    }, 30_000);
  }

  async attendanceReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);
    const cacheKey = this.cacheKey('attendance', actor, period);

    return this.cacheService.getOrSet(cacheKey, async () => {
      const [services, attendanceGrouped] = await Promise.all([
        this.prisma.worshipService.findMany({
          where: {
            serviceDate: period,
          },
          select: {
            id: true,
            title: true,
            serviceDate: true,
          },
          orderBy: { serviceDate: 'asc' },
          take: 500,
        }),
        this.prisma.attendance.groupBy({
          by: ['serviceId', 'status'],
          where: {
            service: { serviceDate: period },
            servant: servantWhere ?? undefined,
          },
          _count: { _all: true },
        }),
      ]);

      const groupedByService = new Map<string, { presentes: number; faltas: number; total: number }>();
      for (const item of attendanceGrouped) {
        const current = groupedByService.get(item.serviceId) ?? { presentes: 0, faltas: 0, total: 0 };
        if (item.status === AttendanceStatus.PRESENTE) {
          current.presentes += item._count._all;
        } else {
          current.faltas += item._count._all;
        }
        current.total += item._count._all;
        groupedByService.set(item.serviceId, current);
      }

      return services.map((service) => {
        const stats = groupedByService.get(service.id) ?? { presentes: 0, faltas: 0, total: 0 };
        return {
          serviceId: service.id,
          title: service.title,
          date: service.serviceDate,
          totalRegistros: stats.total,
          presentes: stats.presentes,
          faltas: stats.faltas,
          assiduidade: stats.total === 0 ? 0 : Number(((stats.presentes / stats.total) * 100).toFixed(2)),
        };
      });
    }, 30_000);
  }

  async absencesReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const absences = await this.prisma.attendance.findMany({
      where: {
        status: { in: [AttendanceStatus.FALTA, AttendanceStatus.FALTA_JUSTIFICADA] },
        service: { serviceDate: period },
        servant: servantWhere ?? undefined,
      },
      include: {
        servant: {
          include: { mainMinistry: true },
        },
      },
    });

    const byServant = new Map<string, { servantId: string; name: string; ministry: string | null; faltas: number }>();
    const bySector = new Map<string, { ministryId: string | null; ministry: string; faltas: number }>();

    for (const attendance of absences) {
      const servantKey = attendance.servantId;
      const sectorName = attendance.servant.mainMinistry?.name ?? 'Sem setor';
      const ministryId = attendance.servant.mainMinistry?.id ?? null;

      const servantCounter =
        byServant.get(servantKey) ??
        {
          servantId: attendance.servantId,
          name: attendance.servant.name,
          ministry: sectorName,
          faltas: 0,
        };
      servantCounter.faltas += 1;
      byServant.set(servantKey, servantCounter);

      const sectorCounter =
        bySector.get(sectorName) ??
        {
          ministryId,
          ministry: sectorName,
          faltas: 0,
        };
      sectorCounter.faltas += 1;
      bySector.set(sectorName, sectorCounter);
    }

    return {
      totalFaltas: absences.length,
      porServo: [...byServant.values()].sort((a, b) => b.faltas - a.faltas),
      porSetor: [...bySector.values()].sort((a, b) => b.faltas - a.faltas),
    };
  }

  async pastoralVisitsReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const visits = await this.prisma.pastoralVisit.findMany({
      where: {
        openedAt: period,
        servant: servantWhere ?? undefined,
      },
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    return {
      total: visits.length,
      abertas: visits.filter((v) => v.status === PastoralVisitStatus.ABERTA).length,
      emAndamento: visits.filter((v) => v.status === PastoralVisitStatus.EM_ANDAMENTO).length,
      resolvidas: visits.filter((v) => v.status === PastoralVisitStatus.RESOLVIDA).length,
      registros: visits,
    };
  }

  async talentsReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const talents = await this.prisma.talent.findMany({
      where: {
        createdAt: period,
        servant: servantWhere ?? undefined,
      },
      include: { servant: true },
      orderBy: { createdAt: 'desc' },
    });

    const byStage = talents.reduce<Record<string, number>>((acc, talent) => {
      acc[talent.stage] = (acc[talent.stage] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: talents.length,
      porEtapa: byStage,
      aprovados: talents.filter((t) => t.stage === 'APROVADO').length,
      registros: talents,
    };
  }

  async ministryLoadReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);
    const cacheKey = this.cacheKey('ministry-load', actor, period);
    return this.cacheService.getOrSet(cacheKey, async () => {
      const [groupedByMinistry, groupedDistinctServant] = await Promise.all([
        this.prisma.schedule.groupBy({
          by: ['ministryId'],
          where: {
            service: { serviceDate: period },
            servant: servantWhere ?? undefined,
          },
          _count: { _all: true },
        }),
        this.prisma.schedule.groupBy({
          by: ['ministryId', 'servantId'],
          where: {
            service: { serviceDate: period },
            servant: servantWhere ?? undefined,
          },
        }),
      ]);

      const ministries = await this.prisma.ministry.findMany({
        where: { id: { in: groupedByMinistry.map((item) => item.ministryId) } },
        select: { id: true, name: true },
      });
      const ministryById = new Map(ministries.map((item) => [item.id, item.name]));
      const distinctServantsByMinistry = groupedDistinctServant.reduce<Record<string, number>>((acc, item) => {
        acc[item.ministryId] = (acc[item.ministryId] ?? 0) + 1;
        return acc;
      }, {});

      return groupedByMinistry.map((item) => ({
        ministryId: item.ministryId,
        ministryName: ministryById.get(item.ministryId) ?? 'Ministerio',
        totalAssignments: item._count._all,
        uniqueServants: distinctServantsByMinistry[item.ministryId] ?? 0,
        fillRateEstimate: item._count._all === 0 ? 0 : 100,
      }));
    }, 30_000);
  }

  async trainingPendingReport(query: PeriodQueryDto, actor: JwtPayload) {
    const servantWhere = await this.getScopedServantFilter(actor);
    const pendings = await this.prisma.servantMinistry.findMany({
      where: {
        trainingStatus: 'PENDING',
        servant: servantWhere ?? undefined,
      },
      include: {
        servant: { select: { id: true, name: true } },
        ministry: { select: { id: true, name: true } },
      },
      orderBy: [{ ministry: { name: 'asc' } }, { servant: { name: 'asc' } }],
    });

    return {
      totalPending: pendings.length,
      records: pendings.map((item) => ({
        servantId: item.servantId,
        servantName: item.servant.name,
        ministryId: item.ministryId,
        ministryName: item.ministry.name,
      })),
    };
  }

  async pastoralPendenciesReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);
    const visits = await this.pastoralVisitsReport(query, actor);
    const alerts = await this.prisma.pastoralAlert.findMany({
      where: {
        createdAt: period,
        status: 'OPEN',
        ...(servantWhere ? { servant: servantWhere } : {}),
      },
      include: { servant: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      visits,
      openAlerts: alerts.length,
      alerts: alerts.map((item) => ({
        id: item.id,
        servantId: item.servantId,
        servantName: item.servant.name,
        trigger: item.trigger,
        message: item.message,
        createdAt: item.createdAt,
      })),
    };
  }

  async schedulesPeriodReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);
    const schedules = await this.prisma.schedule.findMany({
      where: {
        service: { serviceDate: period },
        servant: servantWhere ?? undefined,
      },
      include: {
        service: { select: { id: true, title: true, serviceDate: true } },
        ministry: { select: { id: true, name: true } },
        servant: { select: { id: true, name: true } },
      },
      orderBy: [{ service: { serviceDate: 'asc' } }],
    });

    return {
      totalSchedules: schedules.length,
      swaps: schedules.filter((item) => item.status === 'SWAPPED').length,
      byPeriod: schedules,
    };
  }

  async ministryTasksSummaryReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const where = await this.getScopedMinistryTaskWhere(actor, period);
    const [total, completed, overdue, unassigned, pendingReallocation] = await Promise.all([
      this.prisma.ministryTaskOccurrence.count({ where }),
      this.prisma.ministryTaskOccurrence.count({
        where: { ...where, status: 'COMPLETED' },
      }),
      this.prisma.ministryTaskOccurrence.count({
        where: {
          ...where,
          dueAt: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      this.prisma.ministryTaskOccurrence.count({ where: { ...where, assignedServantId: null } }),
      this.prisma.ministryTaskOccurrence.count({
        where: { ...where, reallocationStatus: 'PENDING_REALLOCATION' },
      }),
    ]);
    return { total, completed, overdue, unassigned, pendingReallocation };
  }

  async ministryTasksByServantReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const where = await this.getScopedMinistryTaskWhere(actor, period);
    const cacheKey = this.cacheKey('ministry-tasks-by-servant', actor, period);
    return this.cacheService.getOrSet(cacheKey, async () => {
      const [totals, completedTotals] = await Promise.all([
        this.prisma.ministryTaskOccurrence.groupBy({
          by: ['assignedServantId'],
          where: {
            ...where,
            assignedServantId: { not: null },
          },
          _count: { _all: true },
          _avg: { progressPercent: true },
        }),
        this.prisma.ministryTaskOccurrence.groupBy({
          by: ['assignedServantId'],
          where: {
            ...where,
            assignedServantId: { not: null },
            status: 'COMPLETED',
          },
          _count: { _all: true },
        }),
      ]);

      const servantIds = totals.map((item) => item.assignedServantId).filter((item): item is string => Boolean(item));
      const servants = servantIds.length
        ? await this.prisma.servant.findMany({
            where: { id: { in: servantIds } },
            select: { id: true, name: true },
          })
        : [];
      const servantNameById = new Map(servants.map((item) => [item.id, item.name]));
      const completedByServant = new Map(
        completedTotals
          .filter((item) => Boolean(item.assignedServantId))
          .map((item) => [item.assignedServantId!, item._count._all]),
      );

      return totals
        .filter((item) => Boolean(item.assignedServantId))
        .map((item) => ({
          servantId: item.assignedServantId!,
          servantName: servantNameById.get(item.assignedServantId!) ?? 'Servo',
          total: item._count._all,
          completed: completedByServant.get(item.assignedServantId!) ?? 0,
          averageProgress: Number((item._avg.progressPercent ?? 0).toFixed(2)),
        }))
        .sort((a, b) => b.total - a.total);
    }, 30_000);
  }

  async ministryTasksByMinistryReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const where = await this.getScopedMinistryTaskWhere(actor, period);
    const grouped = await this.prisma.ministryTaskOccurrence.groupBy({
      by: ['ministryId', 'status'],
      where,
      _count: { _all: true },
    });
    const ministries = await this.prisma.ministry.findMany({
      where: { id: { in: [...new Set(grouped.map((item) => item.ministryId))] } },
      select: { id: true, name: true },
    });
    const ministryNameById = new Map(ministries.map((m) => [m.id, m.name]));
    return grouped.map((item) => ({
      ministryId: item.ministryId,
      ministryName: ministryNameById.get(item.ministryId) ?? 'Ministerio',
      status: item.status,
      total: item._count._all,
    }));
  }

  async ministryTasksByServiceReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const where = await this.getScopedMinistryTaskWhere(actor, period);
    const rows = await this.prisma.ministryTaskOccurrence.groupBy({
      by: ['serviceId'],
      where: { ...where, serviceId: { not: null } },
      _count: { _all: true },
    });
    const services = await this.prisma.worshipService.findMany({
      where: { id: { in: rows.map((item) => item.serviceId!).filter(Boolean) } },
      select: { id: true, title: true, serviceDate: true },
    });
    const serviceById = new Map(services.map((s) => [s.id, s]));
    return rows.map((item) => ({
      serviceId: item.serviceId,
      serviceTitle: item.serviceId ? serviceById.get(item.serviceId)?.title ?? 'Culto' : 'Sem culto',
      serviceDate: item.serviceId ? serviceById.get(item.serviceId)?.serviceDate ?? null : null,
      total: item._count._all,
    }));
  }

  async ministryTasksOverdueReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const where = await this.getScopedMinistryTaskWhere(actor, period);
    return this.prisma.ministryTaskOccurrence.findMany({
      where: {
        ...where,
        dueAt: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        ministry: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        service: { select: { id: true, title: true, serviceDate: true } },
        assignedServant: { select: { id: true, name: true } },
      },
      orderBy: [{ dueAt: 'asc' }],
      take: 200,
    });
  }

  private resolvePeriod(query: PeriodQueryDto) {
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    return {
      gte: query.startDate ? new Date(query.startDate) : defaultStart,
      lte: query.endDate ? new Date(query.endDate) : defaultEnd,
    };
  }

  private async getScopedServantFilter(actor: JwtPayload): Promise<Prisma.ServantWhereInput | undefined> {
    return getServantAccessWhere(this.prisma, actor);
  }

  private async getScopedMinistryTaskWhere(actor: JwtPayload, period: { gte: Date; lte: Date }): Promise<Prisma.MinistryTaskOccurrenceWhereInput> {
    const servantWhere = await this.getScopedServantFilter(actor);
    return {
      deletedAt: null,
      ...(actor.churchId ? { churchId: actor.churchId } : {}),
      scheduledFor: period,
      ...(servantWhere ? { assignedServant: servantWhere } : {}),
    };
  }

  private cacheKey(name: string, actor: JwtPayload, period: { gte: Date; lte: Date }) {
    return `reports:${name}:${actor.sub}:${period.gte.toISOString()}:${period.lte.toISOString()}`;
  }
}


