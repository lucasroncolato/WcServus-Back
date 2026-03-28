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
}


