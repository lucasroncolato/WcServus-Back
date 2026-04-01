import { Injectable } from '@nestjs/common';
import { AutomationRule, AutomationTriggerType } from '@prisma/client';
import { attendanceAbsenceStatuses } from 'src/common/attendance/attendance-status.utils';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { SchedulerLockService } from 'src/common/scheduler-lock/scheduler-lock.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AutomationsEngineService } from './automations-engine.service';
import { AutomationCheckpointService } from './automation-checkpoint.service';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class AutomationsSchedulerService {
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AutomationsEngineService,
    private readonly checkpoint: AutomationCheckpointService,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
    private readonly schedulerLock: SchedulerLockService,
  ) {}

  async runOnce(input?: { churchId?: string; triggerKey?: string }) {
    this.metrics.incrementCounter('scheduler_run_total', 1);
    this.metrics.incrementCounter('scheduler_run_total.automations_scheduler', 1);
    const lock = await this.schedulerLock.withLock(
      'automations_scheduler',
      () => this.runOnceWithInProcessGuard(input),
      { scope: input?.churchId ?? 'global' },
    );

    if (!lock.acquired) {
      this.metrics.incrementCounter('scheduler_lock_failed_total', 1);
      this.metrics.incrementCounter('scheduler_lock_failed_total.automations_scheduler', 1);
      return {
        overlapSkipped: true,
        reason: 'distributed_lock',
      };
    }

    return lock.result ?? { overlapSkipped: true, reason: 'distributed_lock' };
  }

  private async runOnceWithInProcessGuard(input?: { churchId?: string; triggerKey?: string }) {
    if (this.running) {
      this.metrics.incrementCounter('automation_scheduler_overlap_skipped_total', 1);
      this.logService.event({
        level: 'warn',
        module: 'automations',
        action: 'scheduler.skipped_overlap',
        status: 'skip',
        message: 'Automation scheduler cycle skipped due to overlap',
      });
      return {
        overlapSkipped: true,
        reason: 'overlap',
      };
    }

    this.running = true;
    const startedAt = Date.now();
    const summary = {
      scanned: 0,
      executed: 0,
      skipped: 0,
      failed: 0,
      triggerBreakdown: {} as Record<string, number>,
    };

    const schedulerName = 'automations_scheduler';
    await this.checkpoint.markStarted(schedulerName, {
      churchId: input?.churchId,
      details: {
        triggerKey: input?.triggerKey ?? null,
      },
    });

    try {
      const where = {
        enabled: true,
        deletedAt: null,
        triggerType: {
          in: [AutomationTriggerType.TIME, AutomationTriggerType.THRESHOLD],
        },
        ...(input?.churchId ? { churchId: input.churchId } : {}),
        ...(input?.triggerKey ? { triggerKey: input.triggerKey } : {}),
      };

      const rules = await this.prisma.automationRule.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });

      summary.scanned = rules.length;

      for (const rule of rules) {
        try {
          const results =
            rule.triggerType === AutomationTriggerType.TIME
              ? await this.withTimeout(this.handleTimeRule(rule), this.resolveTimeoutMs(), `rule:${rule.id}`)
              : await this.withTimeout(this.handleThresholdRule(rule), this.resolveTimeoutMs(), `rule:${rule.id}`);

          summary.triggerBreakdown[rule.triggerKey] =
            (summary.triggerBreakdown[rule.triggerKey] ?? 0) + results.executed;
          summary.executed += results.executed;
          summary.skipped += results.skipped;
          summary.failed += results.failed;
        } catch (error) {
          summary.failed += 1;
          this.logService.event({
            level: 'error',
            module: 'automations',
            action: 'scheduler.rule_failed',
            message: 'Automation scheduler rule failed',
            churchId: rule.churchId,
            metadata: {
              ruleId: rule.id,
              triggerKey: rule.triggerKey,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      const durationMs = Date.now() - startedAt;
      await this.checkpoint.markSuccess(schedulerName, {
        churchId: input?.churchId,
        details: {
          ...summary,
          durationMs,
        },
      });

      this.metrics.recordJob('automations_scheduler_run', durationMs, true, {
        processedItems: summary.executed,
      });
      this.metrics.incrementCounter('scheduler_duration_ms', Math.round(durationMs));
      this.metrics.incrementCounter('scheduler_duration_ms.automations_scheduler', Math.round(durationMs));
      this.metrics.incrementCounter('automation_scheduler_executed_total', summary.executed);
      this.metrics.setGauge(`scheduler_last_run_timestamp.${schedulerName}`, Date.now());

      this.logService.event({
        level: 'info',
        module: 'automations',
        action: 'scheduler.completed',
        status: 'success',
        message: 'Automation scheduler cycle completed',
        durationMs,
        metadata: summary,
      });

      return {
        ...summary,
        durationMs,
        overlapSkipped: false,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      await this.checkpoint.markFailure(schedulerName, error, {
        churchId: input?.churchId,
        details: {
          ...summary,
          durationMs,
        },
      });

      this.metrics.recordJob('automations_scheduler_run', durationMs, false, {
        processedItems: summary.executed,
      });
      this.metrics.incrementCounter('automation_scheduler_failed_total', 1);
      this.metrics.incrementCounter('scheduler_run_failed_total', 1);
      this.metrics.incrementCounter('scheduler_run_failed_total.automations_scheduler', 1);

      throw error;
    } finally {
      this.running = false;
    }
  }

  status() {
    return {
      enabled: process.env.AUTOMATION_SCHEDULER_ENABLED !== 'false',
      intervalMs: this.resolveIntervalMs(),
      running: this.running,
    };
  }

  isEnabled() {
    return process.env.AUTOMATION_SCHEDULER_ENABLED !== 'false';
  }

  resolveIntervalMs() {
    const raw = Number(process.env.AUTOMATION_SCHEDULER_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
    if (!Number.isFinite(raw) || raw < 60_000) {
      return DEFAULT_INTERVAL_MS;
    }
    return raw;
  }

  private resolveTimeoutMs() {
    const raw = Number(process.env.AUTOMATION_SCHEDULER_TIMEOUT_MS ?? 10 * 60 * 1000);
    if (!Number.isFinite(raw) || raw < 60_000) {
      return 10 * 60 * 1000;
    }
    return raw;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeout: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
          timeout.unref?.();
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private async handleTimeRule(rule: AutomationRule) {
    const shouldRun = this.shouldRunTimeRule(rule);
    if (!shouldRun) {
      return { executed: 0, skipped: 1, failed: 0 };
    }

    const result = await this.engine.executeRule(rule, {
      churchId: rule.churchId,
      payload: {
        churchId: rule.churchId,
        triggerKey: rule.triggerKey,
      },
      triggerType: AutomationTriggerType.TIME,
      windowBucket: this.resolveTimeBucket(rule.triggerKey),
    });

    return {
      executed: result.status === 'SUCCESS' || result.status === 'PARTIAL_SUCCESS' ? 1 : 0,
      skipped: result.status === 'SKIPPED' ? 1 : 0,
      failed: result.status === 'FAILED' ? 1 : 0,
    };
  }

  private async handleThresholdRule(rule: AutomationRule) {
    const triggerKey = rule.triggerKey;

    if (triggerKey === 'threshold.absence_count') {
      return this.executeServantThreshold(rule, {
        statuses: attendanceAbsenceStatuses(),
        defaultThreshold: 3,
        defaultWindowDays: 30,
        metricKey: 'absenceCount',
      });
    }

    if (triggerKey === 'threshold.no_show_count') {
      return this.executeServantThreshold(rule, {
        statuses: ['NO_SHOW'],
        defaultThreshold: 1,
        defaultWindowDays: 30,
        metricKey: 'noShowCount',
      });
    }

    if (triggerKey === 'threshold.decline_count') {
      const threshold = Number(this.readTriggerConfig(rule, 'threshold', 3));
      const windowDays = Number(this.readTriggerConfig(rule, 'windowDays', 30));
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      const slots = await this.prisma.scheduleSlot.findMany({
        where: {
          churchId: rule.churchId,
          deletedAt: null,
          assignedServantId: { not: null } as any,
          confirmationStatus: 'DECLINED' as any,
          updatedAt: { gte: since },
        },
        select: {
          id: true,
          assignedServantId: true,
        },
      });
      const normalized = slots.map((item) => ({
        id: item.id,
        servantId: (item as unknown as { assignedServantId?: string | null }).assignedServantId ?? null,
      }));

      return this.dispatchThresholdByCounter(rule, normalized, threshold, windowDays, 'declineCount');
    }

    if (triggerKey === 'threshold.followup_pending_count') {
      const threshold = Number(this.readTriggerConfig(rule, 'threshold', 3));
      const windowDays = Number(this.readTriggerConfig(rule, 'windowDays', 30));
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      const followUps = await this.prisma.pastoralFollowUp.findMany({
        where: {
          churchId: rule.churchId,
          completedAt: null,
          deletedAt: null,
          createdAt: { gte: since },
        },
        select: {
          id: true,
          pastoralVisit: {
            select: {
              servantId: true,
            },
          },
        },
      });

      const normalized = followUps
        .filter((item) => item.pastoralVisit?.servantId)
        .map((item) => ({ id: item.id, servantId: item.pastoralVisit?.servantId ?? null }));

      return this.dispatchThresholdByCounter(rule, normalized, threshold, windowDays, 'followUpPendingCount');
    }

    return { executed: 0, skipped: 1, failed: 0 };
  }

  private async executeServantThreshold(
    rule: AutomationRule,
    input: {
      statuses: string[];
      defaultThreshold: number;
      defaultWindowDays: number;
      metricKey: string;
    },
  ) {
    const threshold = Number(this.readTriggerConfig(rule, 'threshold', input.defaultThreshold));
    const windowDays = Number(this.readTriggerConfig(rule, 'windowDays', input.defaultWindowDays));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        churchId: rule.churchId,
        createdAt: { gte: since },
        status: { in: input.statuses as any },
      },
      select: {
        id: true,
        servantId: true,
      },
    });

    return this.dispatchThresholdByCounter(rule, attendances, threshold, windowDays, input.metricKey);
  }

  private async dispatchThresholdByCounter(
    rule: AutomationRule,
    rows: Array<{ id: string; servantId: string | null }>,
    threshold: number,
    windowDays: number,
    metricKey: string,
  ) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.servantId) continue;
      counts.set(row.servantId, (counts.get(row.servantId) ?? 0) + 1);
    }

    let executed = 0;
    let skipped = 0;
    let failed = 0;

    for (const [servantId, count] of counts) {
      if (count < threshold) {
        continue;
      }

      const result = await this.engine.executeRule(rule, {
        churchId: rule.churchId,
        payload: {
          servantId,
          [metricKey]: count,
          windowDays,
          threshold,
        },
        triggerType: AutomationTriggerType.THRESHOLD,
        sourceRefId: servantId,
        windowBucket: `${windowDays}d:${new Date().toISOString().slice(0, 10)}`,
      });

      if (result.status === 'SUCCESS' || result.status === 'PARTIAL_SUCCESS') executed += 1;
      else if (result.status === 'SKIPPED') skipped += 1;
      else failed += 1;
    }

    return { executed, skipped, failed };
  }

  private shouldRunTimeRule(rule: AutomationRule) {
    const now = Date.now();
    const last = rule.lastRunAt?.getTime();
    if (!last) {
      return true;
    }

    if (rule.triggerKey === 'daily') {
      return now - last >= 24 * 60 * 60 * 1000;
    }

    if (rule.triggerKey === 'weekly') {
      return now - last >= 7 * 24 * 60 * 60 * 1000;
    }

    if (rule.triggerKey === 'every_n_hours') {
      const everyHours = Number(this.readTriggerConfig(rule, 'everyHours', 6));
      return now - last >= Math.max(1, everyHours) * 60 * 60 * 1000;
    }

    if (rule.triggerKey === 'before_service_start' || rule.triggerKey === 'after_service_end') {
      const everyHours = Number(this.readTriggerConfig(rule, 'everyHours', 6));
      return now - last >= Math.max(1, everyHours) * 60 * 60 * 1000;
    }

    return now - last >= 6 * 60 * 60 * 1000;
  }

  private resolveTimeBucket(triggerKey: string) {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const hourKey = now.toISOString().slice(0, 13);

    if (triggerKey === 'daily') return `${triggerKey}:${dayKey}`;
    if (triggerKey === 'weekly') {
      const week = Math.ceil(
        ((now.getTime() - new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).getTime()) / 86_400_000 + 1) / 7,
      );
      return `${triggerKey}:${now.getUTCFullYear()}-W${week}`;
    }

    return `${triggerKey}:${hourKey}`;
  }

  private readTriggerConfig(rule: AutomationRule, key: string, fallback: number) {
    const cfg = (rule.triggerConfig as Record<string, unknown> | null) ?? null;
    const raw = cfg?.[key];
    const number = typeof raw === 'number' ? raw : Number(raw ?? fallback);
    return Number.isFinite(number) ? number : fallback;
  }
}
