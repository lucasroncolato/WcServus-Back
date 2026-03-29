import { Injectable } from '@nestjs/common';
import {
  AlertStatus,
  AttendanceStatus,
  MinistryTaskOccurrenceStatus,
  PastoralVisitStatus,
  ScheduleSlotStatus,
  ServantStatus,
  TrainingStatus,
  UserStatus,
  WorshipServiceStatus,
} from '@prisma/client';
import { AppCacheService } from 'src/common/cache/cache.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import {
  getAttendanceAccessWhere,
  getPastoralVisitAccessWhere,
  getMinistryAccessWhere,
  getServantAccessWhere,
} from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AppCacheService,
    private readonly metricsService: AppMetricsService,
  ) {}

  async summary(actor: JwtPayload) {
    const cacheKey = `dashboard-summary:${actor.sub}`;
    return this.cacheService.getOrSet(cacheKey, async () => {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
      const [servantScope, attendanceScope, pastoralScope, sectorScope] = await Promise.all([
        getServantAccessWhere(this.prisma, actor),
        getAttendanceAccessWhere(this.prisma, actor),
        getPastoralVisitAccessWhere(this.prisma, actor),
        getMinistryAccessWhere(this.prisma, actor),
      ]);

      const [
        totalServosAtivos,
        faltasDoMes,
        visitasPendentes,
        totalAttendances,
        presentes,
        resumoSetor,
        alertasPastorais,
      ] = await Promise.all([
        this.prisma.servant.count({
          where: {
            status: ServantStatus.ATIVO,
            ...(servantScope ? { AND: [servantScope] } : {}),
          },
        }),
        this.prisma.attendance.count({
          where: {
            status: { in: [AttendanceStatus.FALTA, AttendanceStatus.FALTA_JUSTIFICADA] },
            service: {
              serviceDate: { gte: monthStart, lte: monthEnd },
            },
            ...(attendanceScope ? { AND: [attendanceScope] } : {}),
          },
        }),
        this.prisma.pastoralVisit.count({
          where: {
            status: { in: [PastoralVisitStatus.ABERTA, PastoralVisitStatus.EM_ANDAMENTO] },
            ...(pastoralScope ? { AND: [pastoralScope] } : {}),
          },
        }),
        this.prisma.attendance.count({
          where: {
            service: {
              serviceDate: { gte: monthStart, lte: monthEnd },
            },
            ...(attendanceScope ? { AND: [attendanceScope] } : {}),
          },
        }),
        this.prisma.attendance.count({
          where: {
            status: AttendanceStatus.PRESENTE,
            service: {
              serviceDate: { gte: monthStart, lte: monthEnd },
            },
            ...(attendanceScope ? { AND: [attendanceScope] } : {}),
          },
        }),
        this.prisma.ministry.findMany({
          where: sectorScope,
          select: {
            id: true,
            name: true,
            _count: {
              select: { servants: true, schedules: true },
            },
          },
        }),
        this.prisma.pastoralAlert.findMany({
          where: {
            status: AlertStatus.OPEN,
            ...(servantScope ? { servant: servantScope } : {}),
          },
          select: {
            id: true,
            trigger: true,
            message: true,
            createdAt: true,
            servant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      const assiduidadeGeral = totalAttendances === 0 ? 0 : (presentes / totalAttendances) * 100;

      return {
        totalServosAtivos,
        faltasDoMes,
        visitasPastoraisPendentes: visitasPendentes,
        assiduidadeGeral: Number(assiduidadeGeral.toFixed(2)),
        resumoPorSetor: resumoSetor.map((item) => ({
          id: item.id,
          name: item.name,
          servants: item._count.servants,
          schedules: item._count.schedules,
        })),
        alertasPastorais: alertasPastorais.map((alerta) => ({
          id: alerta.id,
          trigger: alerta.trigger,
          message: alerta.message,
          servant: { id: alerta.servant.id, name: alerta.servant.name },
          createdAt: alerta.createdAt,
        })),
      };
    }, 20_000);
  }

  async alerts(actor: JwtPayload) {
    const servantScope = await getServantAccessWhere(this.prisma, actor);

    return this.prisma.pastoralAlert.findMany({
      where: {
        status: AlertStatus.OPEN,
        ...(servantScope ? { servant: servantScope } : {}),
      },
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async operations(actor: JwtPayload) {
    const cacheKey = `dashboard-operations:${actor.sub}`;
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const churchFilter = actor.churchId ? { churchId: actor.churchId } : {};
        const [openTasks, overdueTasks, incompleteServices, pendingTrainings, stalledTracks, activeUsers] =
          await Promise.all([
            this.prisma.ministryTaskOccurrence.count({
              where: {
                ...churchFilter,
                deletedAt: null,
                status: {
                  in: [
                    MinistryTaskOccurrenceStatus.PENDING,
                    MinistryTaskOccurrenceStatus.ASSIGNED,
                    MinistryTaskOccurrenceStatus.IN_PROGRESS,
                    MinistryTaskOccurrenceStatus.OVERDUE,
                  ],
                },
              },
            }),
            this.prisma.ministryTaskOccurrence.count({
              where: {
                ...churchFilter,
                deletedAt: null,
                status: MinistryTaskOccurrenceStatus.OVERDUE,
              },
            }),
            this.prisma.worshipService.count({
              where: {
                ...churchFilter,
                deletedAt: null,
                status: { in: [WorshipServiceStatus.PLANEJADO, WorshipServiceStatus.CONFIRMADO] },
                scheduleSlots: { some: { status: ScheduleSlotStatus.OPEN } },
              },
            }),
            this.prisma.servant.count({
              where: {
                ...churchFilter,
                deletedAt: null,
                trainingStatus: TrainingStatus.PENDING,
              },
            }),
            this.prisma.servantGrowthProgress.count({
              where: {
                ...churchFilter,
                completed: false,
                updatedAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              },
            }),
            this.prisma.user.count({
              where: {
                ...churchFilter,
                status: UserStatus.ACTIVE,
              },
            }),
          ]);

        const metrics = this.metricsService.getSnapshot();

        return {
          activeUsers,
          openTasks,
          overdueTasks,
          incompleteServices,
          pendingTrainings,
          stalledTracks,
          cache: metrics.cache,
          jobs: metrics.jobs,
          routes: metrics.routes,
          db: metrics.db,
          system: metrics.system,
        };
      },
      20_000,
    );
  }
}


