import { Injectable } from '@nestjs/common';
import { AttendanceStatus, PastoralVisitStatus, Prisma } from '@prisma/client';
import { getServantAccessWhere } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PeriodQueryDto } from './dto/period-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async servantsActivityReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const [schedules, attendances] = await Promise.all([
      this.prisma.schedule.findMany({
        where: {
          service: { serviceDate: period },
          servant: servantWhere ?? undefined,
        },
        include: {
          servant: {
            include: { mainMinistry: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.attendance.findMany({
        where: {
          service: { serviceDate: period },
          servant: servantWhere ?? undefined,
        },
        select: { servantId: true, status: true },
      }),
    ]);

    const byServant = new Map<string, { servantId: string; servantName: string; ministryName: string | null; assigned: number; absences: number; presences: number }>();
    for (const schedule of schedules) {
      const item =
        byServant.get(schedule.servantId) ??
        {
          servantId: schedule.servantId,
          servantName: schedule.servant.name,
          ministryName: schedule.servant.mainMinistry?.name ?? null,
          assigned: 0,
          absences: 0,
          presences: 0,
        };
      item.assigned += 1;
      byServant.set(schedule.servantId, item);
    }
    for (const attendance of attendances) {
      const item = byServant.get(attendance.servantId);
      if (!item) {
        continue;
      }
      if (attendance.status === AttendanceStatus.PRESENTE) {
        item.presences += 1;
      } else {
        item.absences += 1;
      }
    }

    const rows = [...byServant.values()];
    return {
      mostAssigned: [...rows].sort((a, b) => b.assigned - a.assigned).slice(0, 20),
      mostAbsences: [...rows].sort((a, b) => b.absences - a.absences).slice(0, 20),
      ministryLoadByServant: [...rows].sort((a, b) => b.assigned - a.assigned),
    };
  }

  async attendanceReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const services = await this.prisma.worshipService.findMany({
      where: {
        serviceDate: period,
      },
      include: {
        attendances: {
          where: servantWhere ? { servant: servantWhere } : undefined,
          include: {
            servant: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { serviceDate: 'asc' },
    });

    return services.map((service) => {
      const presentes = service.attendances.filter((a) => a.status === AttendanceStatus.PRESENTE).length;
      const faltas = service.attendances.filter((a) => a.status !== AttendanceStatus.PRESENTE).length;

      return {
        serviceId: service.id,
        title: service.title,
        date: service.serviceDate,
        totalRegistros: service.attendances.length,
        presentes,
        faltas,
        assiduidade: service.attendances.length === 0 ? 0 : Number(((presentes / service.attendances.length) * 100).toFixed(2)),
      };
    });
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
    const schedules = await this.prisma.schedule.findMany({
      where: {
        service: { serviceDate: period },
        servant: servantWhere ?? undefined,
      },
      include: {
        ministry: { select: { id: true, name: true } },
        servant: { select: { id: true, name: true } },
      },
    });

    const byMinistry = new Map<string, { ministryId: string; ministryName: string; totalAssignments: number; uniqueServants: Set<string> }>();
    for (const schedule of schedules) {
      const item =
        byMinistry.get(schedule.ministryId) ??
        {
          ministryId: schedule.ministryId,
          ministryName: schedule.ministry.name,
          totalAssignments: 0,
          uniqueServants: new Set<string>(),
        };
      item.totalAssignments += 1;
      item.uniqueServants.add(schedule.servantId);
      byMinistry.set(schedule.ministryId, item);
    }

    return [...byMinistry.values()].map((item) => ({
      ministryId: item.ministryId,
      ministryName: item.ministryName,
      totalAssignments: item.totalAssignments,
      uniqueServants: item.uniqueServants.size,
      fillRateEstimate: item.totalAssignments === 0 ? 0 : 100,
    }));
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
    const rows = await this.prisma.ministryTaskOccurrence.findMany({
      where,
      select: {
        id: true,
        status: true,
        assignedServantId: true,
        assignedServant: { select: { id: true, name: true } },
        progressPercent: true,
      },
    });
    const grouped = new Map<string, { servantId: string; servantName: string; total: number; completed: number; averageProgress: number }>();
    for (const item of rows) {
      if (!item.assignedServantId || !item.assignedServant) continue;
      const current = grouped.get(item.assignedServantId) ?? {
        servantId: item.assignedServantId,
        servantName: item.assignedServant.name,
        total: 0,
        completed: 0,
        averageProgress: 0,
      };
      current.total += 1;
      current.completed += item.status === 'COMPLETED' ? 1 : 0;
      current.averageProgress += item.progressPercent;
      grouped.set(item.assignedServantId, current);
    }
    return [...grouped.values()]
      .map((item) => ({ ...item, averageProgress: item.total ? Number((item.averageProgress / item.total).toFixed(2)) : 0 }))
      .sort((a, b) => b.total - a.total);
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
}


