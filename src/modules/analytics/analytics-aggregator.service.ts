import { Injectable } from '@nestjs/common';
import { MinistryTaskOccurrenceStatus, TrainingStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AnalyticsAggregatorService {
  constructor(private readonly prisma: PrismaService) {}

  async churchSummary(churchId: string, startDate: Date, endDate: Date) {
    const previousEnd = new Date(startDate.getTime() - 1);

    const [
      servantsNow,
      servantsBefore,
      presenceCounts,
      absences,
      taskStatuses,
      ministryLoads,
      ministryAbsences,
      tracks,
      trainingsPending,
    ] = await Promise.all([
      this.prisma.servant.count({ where: { churchId, createdAt: { lte: endDate }, deletedAt: null } }),
      this.prisma.servant.count({ where: { churchId, createdAt: { lte: previousEnd }, deletedAt: null } }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { churchId, createdAt: { gte: startDate, lte: endDate } },
        _count: { _all: true },
      }),
      this.prisma.attendance.count({
        where: {
          churchId,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['FALTA', 'FALTA_JUSTIFICADA'] },
        },
      }),
      this.prisma.ministryTaskOccurrence.groupBy({
        by: ['status'],
        where: { churchId, scheduledFor: { gte: startDate, lte: endDate }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.ministryTaskOccurrence.groupBy({
        by: ['ministryId'],
        where: { churchId, scheduledFor: { gte: startDate, lte: endDate }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.attendance.groupBy({
        by: ['servantId'],
        where: {
          churchId,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['FALTA', 'FALTA_JUSTIFICADA'] },
        },
        _count: { _all: true },
      }),
      this.prisma.servantGrowthProgress.groupBy({
        by: ['completed'],
        where: { churchId, updatedAt: { gte: startDate, lte: endDate } },
        _count: { _all: true },
      }),
      this.prisma.servant.count({ where: { churchId, trainingStatus: TrainingStatus.PENDING, deletedAt: null } }),
    ]);

    const totalAttendance = presenceCounts.reduce((acc, item) => acc + item._count._all, 0);
    const present = presenceCounts.find((item) => item.status === 'PRESENTE')?._count._all ?? 0;

    return {
      growth: {
        currentServants: servantsNow,
        previousServants: servantsBefore,
        delta: servantsNow - servantsBefore,
      },
      retention: {
        retainedApprox: servantsBefore > 0 ? Number(((Math.min(servantsNow, servantsBefore) / servantsBefore) * 100).toFixed(2)) : 0,
      },
      attendance: {
        averagePresenceRate: totalAttendance > 0 ? Number(((present / totalAttendance) * 100).toFixed(2)) : 0,
        absences,
      },
      tasks: {
        completed:
          taskStatuses.find((item) => item.status === MinistryTaskOccurrenceStatus.COMPLETED)?._count._all ?? 0,
        overdue:
          taskStatuses.find((item) => item.status === MinistryTaskOccurrenceStatus.OVERDUE)?._count._all ?? 0,
      },
      ministries: {
        byLoad: ministryLoads,
        byAbsence: ministryAbsences,
      },
      tracks: {
        inProgress: tracks.find((item) => item.completed === false)?._count._all ?? 0,
        completed: tracks.find((item) => item.completed === true)?._count._all ?? 0,
      },
      trainingsPending,
      operationalLoad: {
        tasksTotal: ministryLoads.reduce((acc, item) => acc + item._count._all, 0),
        absences,
      },
    };
  }
}
