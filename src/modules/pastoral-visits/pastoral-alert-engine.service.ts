import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  AlertStatus,
  AttendanceStatus,
  AuditAction,
  PastoralAlertSource,
  PastoralAlertSeverity,
  Prisma,
  ScheduleResponseStatus,
} from '@prisma/client';
import {
  attendanceJustifiedAbsenceStatuses,
  attendanceUnjustifiedAbsenceStatuses,
} from 'src/common/attendance/attendance-status.utils';
import { EventBusService } from 'src/common/events/event-bus.service';
import {
  PastoralAlertType,
  getPastoralAlertPolicy,
} from 'src/common/pastoral/pastoral-alert-policy';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type CreateAlertInput = {
  churchId: string;
  servantId: string;
  alertType: PastoralAlertType;
  sourceRefId?: string | null;
  dedupeKey: string;
  metadata?: Prisma.InputJsonValue;
  message?: string;
  actorUserId?: string | null;
};

@Injectable()
export class PastoralAlertEngineService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
  ) {}

  onModuleInit() {
    this.eventBus.on('ATTENDANCE_REGISTERED', async (event) => {
      const servantId = String(event.payload.servantId ?? '');
      const serviceId = String(event.payload.serviceId ?? '');
      const attendanceId = String(event.payload.attendanceId ?? '');
      const status = String(event.payload.status ?? '') as AttendanceStatus;
      if (!servantId || !serviceId || !attendanceId || !event.churchId) {
        return;
      }

      await this.evaluateAttendanceSignal({
        churchId: event.churchId,
        servantId,
        serviceId,
        attendanceId,
        status,
        actorUserId: event.actorUserId ?? null,
      });
    });

    this.eventBus.on('SLOT_DECLINED', async (event) => {
      let servantId = String(event.payload.servantId ?? '');
      const scheduleId = String(event.payload.scheduleId ?? '');
      const slotId = String(event.payload.slotId ?? '');
      let churchId = event.churchId ?? null;

      if ((!servantId || !churchId) && scheduleId) {
        const schedule = await this.prisma.schedule.findUnique({
          where: { id: scheduleId },
          select: { servantId: true, churchId: true },
        });
        servantId = servantId || String(schedule?.servantId ?? '');
        churchId = churchId || schedule?.churchId || null;
      }

      if (!servantId || !scheduleId || !slotId || !churchId) {
        return;
      }

      await this.evaluateScheduleSignal({
        churchId,
        servantId,
        scheduleId,
        slotId,
        responseStatus: ScheduleResponseStatus.DECLINED,
        actorUserId: event.actorUserId ?? null,
      });
    });
  }

  async evaluateAttendanceSignal(input: {
    churchId: string;
    servantId: string;
    serviceId: string;
    attendanceId: string;
    status: AttendanceStatus;
    actorUserId?: string | null;
  }) {
    if (input.status === AttendanceStatus.NO_SHOW) {
      return this.createAlertIfNeeded({
        churchId: input.churchId,
        servantId: input.servantId,
        alertType: 'NO_SHOW_IMMEDIATE',
        sourceRefId: input.serviceId,
        dedupeKey: `attendance:no_show:${input.churchId}:${input.servantId}:${input.serviceId}`,
        metadata: {
          attendanceId: input.attendanceId,
          serviceId: input.serviceId,
          status: input.status,
        },
        actorUserId: input.actorUserId ?? null,
      });
    }
    return { created: false, reason: 'status_not_configured' } as const;
  }

  async evaluateScheduleSignal(input: {
    churchId: string;
    servantId: string;
    scheduleId: string;
    slotId: string;
    responseStatus: ScheduleResponseStatus;
    actorUserId?: string | null;
  }) {
    if (input.responseStatus !== ScheduleResponseStatus.DECLINED) {
      return { created: false, reason: 'response_not_configured' } as const;
    }

    return this.createAlertIfNeeded({
      churchId: input.churchId,
      servantId: input.servantId,
      alertType: 'REPEATED_DECLINE',
      sourceRefId: input.slotId,
      dedupeKey: `schedule:decline:${input.churchId}:${input.servantId}:${input.slotId}`,
      metadata: {
        scheduleId: input.scheduleId,
        slotId: input.slotId,
        responseStatus: input.responseStatus,
      },
      actorUserId: input.actorUserId ?? null,
    });
  }

  async evaluateJourneySignal(input: {
    churchId: string;
    servantId: string;
    signalType: 'CONSTANCY_DROP' | 'RETURN_AFTER_GAP' | 'LOW_READINESS_SIGNAL';
    windowDays?: number;
    metadata?: Prisma.InputJsonValue;
    actorUserId?: string | null;
  }) {
    const bucket = new Date().toISOString().slice(0, 10);
    const windowDays = input.windowDays ?? 30;
    return this.createAlertIfNeeded({
      churchId: input.churchId,
      servantId: input.servantId,
      alertType: input.signalType,
      sourceRefId: null,
      dedupeKey: `journey:${input.signalType.toLowerCase()}:${input.churchId}:${input.servantId}:${windowDays}:${bucket}`,
      metadata: input.metadata,
      actorUserId: input.actorUserId ?? null,
    });
  }

  async createAlertIfNeeded(input: CreateAlertInput) {
    const policy = getPastoralAlertPolicy(input.alertType);

    const openDuplicate = await this.prisma.pastoralAlert.findFirst({
      where: {
        churchId: input.churchId,
        dedupeKey: input.dedupeKey,
        status: AlertStatus.OPEN,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (openDuplicate) {
      this.metrics.incrementCounter('pastoral.alerts.deduped', 1);
      return { created: false, reason: 'open_duplicate' } as const;
    }

    if (!policy.reopenWhenResolved) {
      const resolvedDuplicate = await this.prisma.pastoralAlert.findFirst({
        where: {
          churchId: input.churchId,
          dedupeKey: input.dedupeKey,
          status: AlertStatus.RESOLVED,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (resolvedDuplicate) {
        this.metrics.incrementCounter('pastoral.alerts.skipped_resolved_policy', 1);
        return { created: false, reason: 'resolved_policy_skip' } as const;
      }
    }

    const created = await this.prisma.pastoralAlert.create({
      data: {
        churchId: input.churchId,
        servantId: input.servantId,
        alertType: input.alertType,
        severity: policy.severity,
        source: policy.source,
        sourceRefId: input.sourceRefId ?? null,
        dedupeKey: input.dedupeKey,
        message: input.message ?? policy.defaultMessage,
        trigger: input.alertType,
        metadata: input.metadata,
        createdByUserId: input.actorUserId ?? null,
      },
    });

    this.metrics.incrementCounter('pastoral.alerts.created', 1);
    this.logService.event({
      level: 'info',
      module: 'pastoral-alert-engine',
      action: 'alert.created',
      message: 'Pastoral alert created',
      churchId: input.churchId,
      metadata: {
        servantId: input.servantId,
        alertType: input.alertType,
        severity: policy.severity,
        source: policy.source,
        dedupeKey: input.dedupeKey,
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralAlert',
      entityId: created.id,
      userId: input.actorUserId ?? undefined,
      metadata: {
        alertType: input.alertType,
        severity: policy.severity,
        source: policy.source,
        dedupeKey: input.dedupeKey,
      },
    });

    if (policy.createFollowUp) {
      await this.createAutomaticFollowUpIfPossible(created.id, input.churchId, input.servantId);
    }

    return { created: true, reason: 'created', alertId: created.id } as const;
  }

  private async createAutomaticFollowUpIfPossible(
    alertId: string,
    churchId: string,
    servantId: string,
  ) {
    const activeRecord = await this.prisma.pastoralVisit.findFirst({
      where: {
        churchId,
        servantId,
        deletedAt: null,
        status: { in: ['ABERTA', 'EM_ANDAMENTO'] },
      },
      orderBy: { openedAt: 'desc' },
      select: { id: true, createdByUserId: true },
    });

    if (!activeRecord) {
      return;
    }

    const exists = await this.prisma.pastoralFollowUp.findFirst({
      where: {
        churchId,
        pastoralVisitId: activeRecord.id,
        status: 'OPEN',
        notes: { contains: `AUTO_ALERT:${alertId}` },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (exists) {
      return;
    }

    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 3);

    await this.prisma.pastoralFollowUp.create({
      data: {
        churchId,
        pastoralVisitId: activeRecord.id,
        createdByUserId: activeRecord.createdByUserId,
        scheduledAt,
        notes: `AUTO_ALERT:${alertId} Follow-up automatico sugerido pelo motor pastoral.`,
      },
    });
    this.metrics.incrementCounter('pastoral.alerts.auto_followup_created', 1);
  }

  async runRecurringRules(input?: { churchId?: string | null; now?: Date }) {
    const now = input?.now ?? new Date();
    const churches = await this.prisma.church.findMany({
      where: input?.churchId ? { id: input.churchId } : { active: true },
      select: { id: true },
    });

    let analyzed = 0;
    let created = 0;
    let deduped = 0;
    let failed = 0;

    for (const church of churches) {
      const servants = await this.prisma.servant.findMany({
        where: { churchId: church.id, deletedAt: null },
        select: { id: true, churchId: true },
      });

      for (const servant of servants) {
        analyzed += 1;
        try {
          const result = await this.evaluateServantRecurringSignals(servant.churchId, servant.id, now);
          created += result.created;
          deduped += result.deduped;
        } catch (error) {
          failed += 1;
          this.logService.error(
            'Pastoral recurring evaluation failed',
            String(error),
            PastoralAlertEngineService.name,
            { churchId: church.id, servantId: servant.id },
          );
        }
      }
    }

    return { analyzed, created, deduped, failed };
  }

  private async evaluateServantRecurringSignals(churchId: string, servantId: string, now: Date) {
    let created = 0;
    let deduped = 0;

    const absencePolicy = getPastoralAlertPolicy('RECURRENT_ABSENCE');
    const latePolicy = getPastoralAlertPolicy('RECURRENT_LATE');
    const inactivityPolicy = getPastoralAlertPolicy('PROLONGED_INACTIVITY');
    const excusedPolicy = getPastoralAlertPolicy('EXCUSED_ABSENCE_PATTERN');
    const declinePolicy = getPastoralAlertPolicy('REPEATED_DECLINE');
    const noResponsePolicy = getPastoralAlertPolicy('NO_RESPONSE_TO_SCHEDULE');

    const absenceWindowStart = new Date(now);
    absenceWindowStart.setDate(absenceWindowStart.getDate() - (absencePolicy.windowDays ?? 30));

    const lateWindowStart = new Date(now);
    lateWindowStart.setDate(lateWindowStart.getDate() - (latePolicy.windowDays ?? 30));

    const inactivityWindowStart = new Date(now);
    inactivityWindowStart.setDate(inactivityWindowStart.getDate() - (inactivityPolicy.windowDays ?? 45));

    const [absenceCount, lateCount, excusedCount, lastAttendance, declinedCount, stalePendingSchedules, journeySnapshot] =
      await Promise.all([
        this.prisma.attendance.count({
          where: {
            churchId,
            servantId,
            deletedAt: null,
            status: { in: attendanceUnjustifiedAbsenceStatuses() },
            createdAt: { gte: absenceWindowStart },
          },
        }),
        this.prisma.attendance.count({
          where: {
            churchId,
            servantId,
            deletedAt: null,
            status: AttendanceStatus.LATE,
            createdAt: { gte: lateWindowStart },
          },
        }),
        this.prisma.attendance.count({
          where: {
            churchId,
            servantId,
            deletedAt: null,
            status: { in: attendanceJustifiedAbsenceStatuses() },
            createdAt: { gte: absenceWindowStart },
          },
        }),
        this.prisma.attendance.findFirst({
          where: { churchId, servantId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.schedule.count({
          where: {
            churchId,
            servantId,
            deletedAt: null,
            responseStatus: ScheduleResponseStatus.DECLINED,
            updatedAt: { gte: absenceWindowStart },
          },
        }),
        this.prisma.schedule.findMany({
          where: {
            churchId,
            servantId,
            deletedAt: null,
            responseStatus: ScheduleResponseStatus.PENDING,
            createdAt: { lte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
          },
          select: { id: true },
          take: 20,
        }),
        this.prisma.journeyIndicatorSnapshot.findUnique({
          where: { servantId_windowDays: { servantId, windowDays: 30 } },
          select: { constancyScore: true, readinessScore: true },
        }),
      ]);

    if (absenceCount >= (absencePolicy.threshold ?? 3)) {
      const bucket = now.toISOString().slice(0, 10);
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'RECURRENT_ABSENCE',
        dedupeKey: `attendance:recurrent_absence:${churchId}:${servantId}:${absencePolicy.windowDays}:${bucket}`,
        metadata: { windowDays: absencePolicy.windowDays, threshold: absencePolicy.threshold, absenceCount },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    if (lateCount >= (latePolicy.threshold ?? 3)) {
      const bucket = now.toISOString().slice(0, 10);
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'RECURRENT_LATE',
        dedupeKey: `attendance:recurrent_late:${churchId}:${servantId}:${latePolicy.windowDays}:${bucket}`,
        metadata: { windowDays: latePolicy.windowDays, threshold: latePolicy.threshold, lateCount },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    if (excusedCount >= (excusedPolicy.threshold ?? 4)) {
      const bucket = now.toISOString().slice(0, 10);
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'EXCUSED_ABSENCE_PATTERN',
        dedupeKey: `attendance:excused_pattern:${churchId}:${servantId}:${excusedPolicy.windowDays}:${bucket}`,
        metadata: { windowDays: excusedPolicy.windowDays, threshold: excusedPolicy.threshold, excusedCount },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    if (!lastAttendance || lastAttendance.createdAt < inactivityWindowStart) {
      const bucket = now.toISOString().slice(0, 10);
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'PROLONGED_INACTIVITY',
        dedupeKey: `attendance:inactivity:${churchId}:${servantId}:${inactivityPolicy.windowDays}:${bucket}`,
        metadata: {
          windowDays: inactivityPolicy.windowDays,
          lastAttendanceAt: lastAttendance?.createdAt?.toISOString?.() ?? null,
        },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    if (declinedCount >= (declinePolicy.threshold ?? 3)) {
      const bucket = now.toISOString().slice(0, 10);
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'REPEATED_DECLINE',
        dedupeKey: `schedule:repeated_decline:${churchId}:${servantId}:${declinePolicy.windowDays}:${bucket}`,
        metadata: { windowDays: declinePolicy.windowDays, threshold: declinePolicy.threshold, declinedCount },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    for (const schedule of stalePendingSchedules) {
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'NO_RESPONSE_TO_SCHEDULE',
        sourceRefId: schedule.id,
        dedupeKey: `schedule:no_response:${churchId}:${servantId}:${schedule.id}`,
        metadata: { scheduleId: schedule.id, thresholdHours: 48 },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    if (journeySnapshot && journeySnapshot.constancyScore <= 30) {
      const bucket = now.toISOString().slice(0, 10);
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'CONSTANCY_DROP',
        dedupeKey: `journey:constancy_drop:${churchId}:${servantId}:30:${bucket}`,
        metadata: {
          windowDays: 30,
          constancyScore: journeySnapshot.constancyScore,
        },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    if (journeySnapshot && journeySnapshot.readinessScore <= 25) {
      const bucket = now.toISOString().slice(0, 10);
      const r = await this.createAlertIfNeeded({
        churchId,
        servantId,
        alertType: 'LOW_READINESS_SIGNAL',
        dedupeKey: `journey:low_readiness:${churchId}:${servantId}:30:${bucket}`,
        metadata: {
          windowDays: 30,
          readinessScore: journeySnapshot.readinessScore,
        },
      });
      if (r.created) created += 1; else deduped += 1;
    }

    return { created, deduped };
  }

  resolveDuplicateStrategy(type: PastoralAlertType) {
    const policy = getPastoralAlertPolicy(type);
    return {
      dedupeStrategy: policy.dedupeStrategy,
      reopenWhenResolved: policy.reopenWhenResolved,
    };
  }

  mapSeverity(type: PastoralAlertType): PastoralAlertSeverity {
    return getPastoralAlertPolicy(type).severity;
  }

  mapSource(type: PastoralAlertType): PastoralAlertSource {
    return getPastoralAlertPolicy(type).source;
  }
}
