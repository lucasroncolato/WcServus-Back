import { Injectable } from '@nestjs/common';
import {
  AlertStatus,
  AttendanceStatus,
  ScheduleResponseStatus,
  ScheduleSlotStatus,
} from '@prisma/client';
import {
  allAttendanceStatuses,
  isAbsenceAttendanceStatus,
  isPositiveAttendanceStatus,
  shouldIncludeInAnalytics,
} from 'src/common/attendance/attendance-status.utils';
import { PrismaService } from 'src/prisma/prisma.service';

type BaseEnvelope = {
  view: 'church' | 'ministry' | 'team' | 'servant' | 'timeline';
  window: string;
  period: { startDate: string; endDate: string };
  summary: Record<string, unknown>;
  breakdowns: Record<string, unknown>;
  meta: {
    generatedAt: string;
    cached?: boolean;
    insufficientData: boolean;
    dataQualityWarnings: string[];
  };
};

@Injectable()
export class AnalyticsAggregatorService {
  constructor(private readonly prisma: PrismaService) {}

  private buildEnvelope(input: Omit<BaseEnvelope, 'meta'> & { warnings?: string[] }): BaseEnvelope {
    return {
      ...input,
      meta: {
        generatedAt: new Date().toISOString(),
        insufficientData:
          Object.values(input.summary ?? {}).every((value) => typeof value === 'number' && value === 0) &&
          Object.keys(input.breakdowns ?? {}).length === 0,
        dataQualityWarnings: input.warnings ?? [],
      },
    };
  }

  private getAttendanceRatesFromGroups(groups: Array<{ status: AttendanceStatus; _count: { _all: number } }>) {
    const countable = groups
      .filter((item) => shouldIncludeInAnalytics(item.status))
      .reduce((acc, item) => acc + item._count._all, 0);
    const present = groups
      .filter((item) => isPositiveAttendanceStatus(item.status))
      .reduce((acc, item) => acc + item._count._all, 0);
    const absent = groups
      .filter((item) => isAbsenceAttendanceStatus(item.status))
      .reduce((acc, item) => acc + item._count._all, 0);
    const noShow = groups
      .filter((item) => item.status === AttendanceStatus.NO_SHOW)
      .reduce((acc, item) => acc + item._count._all, 0);

    return {
      countableTotal: countable,
      presentTotal: present,
      absentTotal: absent,
      noShowTotal: noShow,
      presentRate: countable > 0 ? Number(((present / countable) * 100).toFixed(2)) : 0,
      absenceRate: countable > 0 ? Number(((absent / countable) * 100).toFixed(2)) : 0,
      noShowRate: countable > 0 ? Number(((noShow / countable) * 100).toFixed(2)) : 0,
    };
  }

  async churchSummary(churchId: string, startDate: Date, endDate: Date, window: string) {
    const [servicesTotal, slotsTotal, slotsFilled, slotsPending, attendanceByStatus, scheduleResponses, pastoral, avgJourney] =
      await Promise.all([
        this.prisma.worshipService.count({
          where: { churchId, serviceDate: { gte: startDate, lte: endDate }, deletedAt: null },
        }),
        this.prisma.scheduleSlot.count({
          where: { churchId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
        }),
        this.prisma.scheduleSlot.count({
          where: {
            churchId,
            createdAt: { gte: startDate, lte: endDate },
            deletedAt: null,
            status: { in: [ScheduleSlotStatus.FILLED, ScheduleSlotStatus.CONFIRMED, ScheduleSlotStatus.REPLACED] },
          },
        }),
        this.prisma.scheduleSlot.count({
          where: {
            churchId,
            createdAt: { gte: startDate, lte: endDate },
            deletedAt: null,
            status: { in: [ScheduleSlotStatus.EMPTY, ScheduleSlotStatus.SUBSTITUTE_PENDING] },
          },
        }),
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: { churchId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.schedule.groupBy({
          by: ['responseStatus'],
          where: { churchId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
          _count: { _all: true },
        }),
        Promise.all([
          this.prisma.pastoralAlert.count({ where: { churchId, status: AlertStatus.OPEN, deletedAt: null } }),
          this.prisma.pastoralAlert.count({
            where: { churchId, status: AlertStatus.OPEN, severity: 'HIGH', deletedAt: null },
          }),
          this.prisma.pastoralFollowUp.count({ where: { churchId, status: 'OPEN', deletedAt: null } }),
        ]),
        this.prisma.journeyIndicatorSnapshot.aggregate({
          where: { churchId, windowDays: 30 },
          _avg: { constancyScore: true, readinessScore: true, punctualityScore: true, engagementScore: true },
        }),
      ]);

    const rates = this.getAttendanceRatesFromGroups(
      attendanceByStatus as Array<{ status: AttendanceStatus; _count: { _all: number } }>,
    );
    const responseTotal = scheduleResponses.reduce((acc, item) => acc + item._count._all, 0);
    const acceptedTotal =
      scheduleResponses.find((item) => item.responseStatus === ScheduleResponseStatus.CONFIRMED)?._count._all ?? 0;
    const declinedTotal =
      scheduleResponses.find((item) => item.responseStatus === ScheduleResponseStatus.DECLINED)?._count._all ?? 0;
    const pendingTotal =
      scheduleResponses.find((item) => item.responseStatus === ScheduleResponseStatus.PENDING)?._count._all ?? 0;

    return this.buildEnvelope({
      view: 'church',
      window,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      summary: {
        servicesTotal,
        slotsTotal,
        slotFillRate: slotsTotal > 0 ? Number(((slotsFilled / slotsTotal) * 100).toFixed(2)) : 0,
        slotsPending,
        attendancePresentRate: rates.presentRate,
        attendanceNoShowRate: rates.noShowRate,
        scheduleConfirmationRate:
          responseTotal > 0 ? Number(((acceptedTotal / responseTotal) * 100).toFixed(2)) : 0,
        scheduleDeclineRate:
          responseTotal > 0 ? Number(((declinedTotal / responseTotal) * 100).toFixed(2)) : 0,
        responsePendingTotal: pendingTotal,
        pastoralOpenAlerts: pastoral[0],
        pastoralHighAlerts: pastoral[1],
        pastoralPendingFollowUps: pastoral[2],
        avgConstancyScore: Number(avgJourney._avg.constancyScore ?? 0),
        avgReadinessScore: Number(avgJourney._avg.readinessScore ?? 0),
      },
      breakdowns: {
        attendanceByStatus,
        scheduleResponses,
      },
      warnings: this.buildAttendanceWarnings(attendanceByStatus),
    });
  }

  async churchTrends(
    churchId: string,
    startDate: Date,
    endDate: Date,
    window: string,
    groupBy: 'day' | 'week' | 'month',
  ) {
    const attendances = await this.prisma.attendance.findMany({
      where: { churchId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const keyByDate = (date: Date) => {
      if (groupBy === 'day') return date.toISOString().slice(0, 10);
      if (groupBy === 'week') {
        const d = new Date(date);
        const weekday = d.getUTCDay();
        d.setUTCDate(d.getUTCDate() - weekday);
        return d.toISOString().slice(0, 10);
      }
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    };

    const bucketMap = new Map<string, { total: number; present: number; noShow: number }>();
    for (const item of attendances) {
      const bucket = keyByDate(item.createdAt);
      const current = bucketMap.get(bucket) ?? { total: 0, present: 0, noShow: 0 };
      if (shouldIncludeInAnalytics(item.status)) {
        current.total += 1;
      }
      if (isPositiveAttendanceStatus(item.status)) {
        current.present += 1;
      }
      if (item.status === AttendanceStatus.NO_SHOW) {
        current.noShow += 1;
      }
      bucketMap.set(bucket, current);
    }

    const series = [...bucketMap.entries()].map(([bucket, values]) => ({
      bucket,
      attendancePresentRate:
        values.total > 0 ? Number(((values.present / values.total) * 100).toFixed(2)) : 0,
      noShowRate: values.total > 0 ? Number(((values.noShow / values.total) * 100).toFixed(2)) : 0,
      countableTotal: values.total,
    }));

    return this.buildEnvelope({
      view: 'church',
      window,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      summary: {
        buckets: series.length,
      },
      breakdowns: {
        groupBy,
        series,
      },
    });
  }

  async churchPastoralSummary(churchId: string, startDate: Date, endDate: Date, window: string) {
    const [openAlerts, severity, openCases, pendingFollowUps, resolvedCases] = await Promise.all([
      this.prisma.pastoralAlert.count({
        where: { churchId, status: AlertStatus.OPEN, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
      }),
      this.prisma.pastoralAlert.groupBy({
        by: ['severity'],
        where: { churchId, status: AlertStatus.OPEN, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.pastoralVisit.count({
        where: { churchId, status: { in: ['ABERTA', 'EM_ANDAMENTO'] }, openedAt: { gte: startDate, lte: endDate }, deletedAt: null },
      }),
      this.prisma.pastoralFollowUp.count({
        where: { churchId, status: 'OPEN', scheduledAt: { gte: startDate, lte: endDate }, deletedAt: null },
      }),
      this.prisma.pastoralVisit.findMany({
        where: {
          churchId,
          status: 'RESOLVIDA',
          resolvedAt: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        select: { openedAt: true, resolvedAt: true },
      }),
    ]);

    const avgResolutionDays =
      resolvedCases.length > 0
        ? Number(
            (
              resolvedCases.reduce((acc, item) => {
                const resolvedAt = item.resolvedAt ?? item.openedAt;
                return acc + (resolvedAt.getTime() - item.openedAt.getTime()) / (1000 * 60 * 60 * 24);
              }, 0) / resolvedCases.length
            ).toFixed(2),
          )
        : 0;

    return this.buildEnvelope({
      view: 'church',
      window,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      summary: {
        openAlerts,
        openCases,
        pendingFollowUps,
        avgResolutionDays,
      },
      breakdowns: {
        severity,
      },
    });
  }

  async ministrySummary(churchId: string, ministryId: string, startDate: Date, endDate: Date, window: string) {
    const [servantIdsRaw, attendanceByStatus, slotsTotal, slotsFilled, schedules, trainingPending, openPastoralAlerts] =
      await Promise.all([
        this.prisma.servant.findMany({
          where: {
            churchId,
            deletedAt: null,
            OR: [
              { mainMinistryId: ministryId },
              { servantMinistries: { some: { ministryId } } },
            ],
          },
          select: { id: true },
        }),
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: {
            churchId,
            createdAt: { gte: startDate, lte: endDate },
            deletedAt: null,
            servant: {
              OR: [
                { mainMinistryId: ministryId },
                { servantMinistries: { some: { ministryId } } },
              ],
            },
          },
          _count: { _all: true },
        }),
        this.prisma.scheduleSlot.count({
          where: { churchId, ministryId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
        }),
        this.prisma.scheduleSlot.count({
          where: {
            churchId,
            ministryId,
            createdAt: { gte: startDate, lte: endDate },
            deletedAt: null,
            status: { in: [ScheduleSlotStatus.FILLED, ScheduleSlotStatus.CONFIRMED, ScheduleSlotStatus.REPLACED] },
          },
        }),
        this.prisma.schedule.groupBy({
          by: ['responseStatus'],
          where: { churchId, ministryId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.servantMinistry.count({
          where: { ministryId, servant: { churchId, deletedAt: null }, trainingStatus: 'PENDING' },
        }),
        this.prisma.pastoralAlert.count({
          where: {
            churchId,
            status: AlertStatus.OPEN,
            deletedAt: null,
            servant: {
              OR: [{ mainMinistryId: ministryId }, { servantMinistries: { some: { ministryId } } }],
            },
          },
        }),
      ]);

    const servantIds = servantIdsRaw.map((item) => item.id);
    const rates = this.getAttendanceRatesFromGroups(
      attendanceByStatus as Array<{ status: AttendanceStatus; _count: { _all: number } }>,
    );
    const responseTotal = schedules.reduce((acc, item) => acc + item._count._all, 0);
    const acceptedTotal =
      schedules.find((item) => item.responseStatus === ScheduleResponseStatus.CONFIRMED)?._count._all ?? 0;

    return this.buildEnvelope({
      view: 'ministry',
      window,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      summary: {
        servants: servantIds.length,
        slotFillRate: slotsTotal > 0 ? Number(((slotsFilled / slotsTotal) * 100).toFixed(2)) : 0,
        attendancePresentRate: rates.presentRate,
        noShowRate: rates.noShowRate,
        scheduleConfirmationRate:
          responseTotal > 0 ? Number(((acceptedTotal / responseTotal) * 100).toFixed(2)) : 0,
        trainingPending,
        pastoralOpenAlerts: openPastoralAlerts,
      },
      breakdowns: {
        attendanceByStatus,
        scheduleResponses: schedules,
      },
      warnings: this.buildAttendanceWarnings(attendanceByStatus),
    });
  }

  async teamSummary(churchId: string, teamId: string, startDate: Date, endDate: Date, window: string) {
    const members = await this.prisma.servant.findMany({
      where: { churchId, teamId, deletedAt: null },
      select: { id: true },
    });
    const memberIds = members.map((item) => item.id);

    const [attendanceByStatus, scheduleResponses, avgJourney] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          churchId,
          servantId: { in: memberIds.length ? memberIds : ['__none__'] },
          createdAt: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        _count: { _all: true },
      }),
      this.prisma.schedule.groupBy({
        by: ['responseStatus'],
        where: {
          churchId,
          servantId: { in: memberIds.length ? memberIds : ['__none__'] },
          createdAt: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        _count: { _all: true },
      }),
      this.prisma.journeyIndicatorSnapshot.aggregate({
        where: { churchId, servantId: { in: memberIds.length ? memberIds : ['__none__'] }, windowDays: 30 },
        _avg: { constancyScore: true, engagementScore: true, responsivenessScore: true },
      }),
    ]);

    const rates = this.getAttendanceRatesFromGroups(
      attendanceByStatus as Array<{ status: AttendanceStatus; _count: { _all: number } }>,
    );
    return this.buildEnvelope({
      view: 'team',
      window,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      summary: {
        members: memberIds.length,
        attendancePresentRate: rates.presentRate,
        noShowRate: rates.noShowRate,
        avgConstancyScore: Number(avgJourney._avg.constancyScore ?? 0),
        avgEngagementScore: Number(avgJourney._avg.engagementScore ?? 0),
        avgResponsivenessScore: Number(avgJourney._avg.responsivenessScore ?? 0),
      },
      breakdowns: {
        attendanceByStatus,
        scheduleResponses,
      },
      warnings: this.buildAttendanceWarnings(attendanceByStatus),
    });
  }

  async servantOperationalSummary(
    churchId: string,
    servantId: string,
    startDate: Date,
    endDate: Date,
    window: string,
  ) {
    const [attendanceByStatus, schedules, journeySnapshot, pastoralOpenAlerts, pastoralOpenCases, trainings] =
      await Promise.all([
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: { churchId, servantId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.schedule.groupBy({
          by: ['responseStatus'],
          where: { churchId, servantId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.journeyIndicatorSnapshot.findUnique({
          where: { servantId_windowDays: { servantId, windowDays: 30 } },
          select: {
            constancyScore: true,
            readinessScore: true,
            responsivenessScore: true,
            punctualityScore: true,
            engagementScore: true,
            continuityScore: true,
            formationScore: true,
          },
        }),
        this.prisma.pastoralAlert.count({
          where: { churchId, servantId, status: AlertStatus.OPEN, deletedAt: null },
        }),
        this.prisma.pastoralVisit.count({
          where: { churchId, servantId, status: { in: ['ABERTA', 'EM_ANDAMENTO'] }, deletedAt: null },
        }),
        this.prisma.servantMinistry.findMany({
          where: { servantId },
          select: { ministryId: true, trainingStatus: true },
        }),
      ]);

    const rates = this.getAttendanceRatesFromGroups(
      attendanceByStatus as Array<{ status: AttendanceStatus; _count: { _all: number } }>,
    );
    const responseTotal = schedules.reduce((acc, item) => acc + item._count._all, 0);
    const confirmed =
      schedules.find((item) => item.responseStatus === ScheduleResponseStatus.CONFIRMED)?._count._all ?? 0;
    const declined =
      schedules.find((item) => item.responseStatus === ScheduleResponseStatus.DECLINED)?._count._all ?? 0;

    return this.buildEnvelope({
      view: 'servant',
      window,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      summary: {
        attendancePresentRate: rates.presentRate,
        attendanceNoShowRate: rates.noShowRate,
        scheduleConfirmationRate:
          responseTotal > 0 ? Number(((confirmed / responseTotal) * 100).toFixed(2)) : 0,
        scheduleDeclineRate:
          responseTotal > 0 ? Number(((declined / responseTotal) * 100).toFixed(2)) : 0,
        pastoralOpenAlerts,
        pastoralOpenCases,
        trainingPending: trainings.filter((item) => item.trainingStatus === 'PENDING').length,
        readinessScore: Number(journeySnapshot?.readinessScore ?? 0),
        constancyScore: Number(journeySnapshot?.constancyScore ?? 0),
      },
      breakdowns: {
        attendanceByStatus,
        scheduleResponses: schedules,
      },
      warnings: this.buildAttendanceWarnings(attendanceByStatus),
    });
  }

  async timelineSummary(churchId: string, startDate: Date, endDate: Date, window: string) {
    const totals = await this.prisma.timelineEntry.groupBy({
      by: ['type'],
      where: { churchId, occurredAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
    });

    return this.buildEnvelope({
      view: 'timeline',
      window,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      summary: {
        eventsTotal: totals.reduce((acc, item) => acc + item._count._all, 0),
      },
      breakdowns: {
        totals,
      },
    });
  }

  private buildAttendanceWarnings(
    attendanceByStatus: Array<{ status: AttendanceStatus; _count: { _all: number } }>,
  ) {
    const warnings: string[] = [];
    const unknownCount =
      attendanceByStatus.find((item) => item.status === AttendanceStatus.UNKNOWN)?._count._all ?? 0;
    const cancelledCount =
      attendanceByStatus.find((item) => item.status === AttendanceStatus.CANCELLED_SERVICE)?._count._all ?? 0;
    if (unknownCount > 0) {
      warnings.push(`UNKNOWN(${unknownCount}) não entra no denominador principal.`);
    }
    if (cancelledCount > 0) {
      warnings.push(`CANCELLED_SERVICE(${cancelledCount}) não entra no denominador principal.`);
    }
    const unknownStatuses = attendanceByStatus
      .map((item) => item.status)
      .filter((status) => !allAttendanceStatuses().includes(status));
    if (unknownStatuses.length > 0) {
      warnings.push('Foram encontrados status de presença não mapeados na policy.');
    }
    return warnings;
  }
}
