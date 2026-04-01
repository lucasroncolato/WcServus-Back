import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { SchedulerLockService } from 'src/common/scheduler-lock/scheduler-lock.service';
import { PastoralAlertEngineService } from './pastoral-alert-engine.service';

@Injectable()
export class PastoralAlertSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly engine: PastoralAlertEngineService,
    private readonly logService: LogService,
    private readonly metricsService: AppMetricsService,
    private readonly schedulerLock: SchedulerLockService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logService.log('Pastoral alert scheduler disabled by env', PastoralAlertSchedulerService.name);
      return;
    }

    const intervalMs = this.resolveIntervalMs();
    this.timer = setInterval(() => void this.executeRecurring(), intervalMs);
    void this.executeRecurring();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runNow(churchId?: string) {
    return this.executeRecurring(churchId);
  }

  status() {
    return {
      enabled: this.isEnabled(),
      intervalMs: this.resolveIntervalMs(),
      running: this.running,
    };
  }

  isEnabled() {
    const schedulerEnabled = process.env.PASTORAL_ALERT_SCHEDULER_ENABLED;
    if (schedulerEnabled !== undefined) {
      return schedulerEnabled !== 'false';
    }
    return process.env.PASTORAL_ALERT_ENGINE_ENABLED !== 'false';
  }

  private resolveIntervalMs() {
    const configured = Number(
      process.env.PASTORAL_ALERT_SCHEDULER_INTERVAL_MS ?? process.env.PASTORAL_ALERT_ENGINE_INTERVAL_MS,
    );
    if (Number.isFinite(configured) && configured >= 60_000) {
      return configured;
    }
    return 24 * 60 * 60 * 1000;
  }

  private resolveTimeoutMs() {
    const configured = Number(
      process.env.PASTORAL_ALERT_SCHEDULER_TIMEOUT_MS ?? process.env.PASTORAL_ALERT_ENGINE_TIMEOUT_MS,
    );
    if (Number.isFinite(configured) && configured >= 60_000) {
      return configured;
    }
    return 10 * 60 * 1000;
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

  private async executeRecurring(churchId?: string) {
    const jobName = 'pastoral_alert_engine_recurring';
    this.metricsService.incrementCounter('scheduler_run_total', 1);
    this.metricsService.incrementCounter('scheduler_run_total.pastoral_alert_engine_recurring', 1);

    const lock = await this.schedulerLock.withLock(
      jobName,
      async () => {
        if (this.running) {
          this.metricsService.recordJob(jobName, 0, true, { skipped: true });
          this.logService.event({
            level: 'warn',
            module: 'pastoral-alert-engine',
            action: 'scheduler.skipped_overlap',
            message: 'Pastoral alert recurring job skipped due to overlap',
            status: 'skip',
          });
          return { analyzed: 0, created: 0, deduped: 0, failed: 0, skipped: true };
        }

        this.running = true;
        const startedAt = performance.now();

        try {
          const result = await this.withTimeout(
            this.engine.runRecurringRules({ churchId }),
            this.resolveTimeoutMs(),
            jobName,
          );
          const durationMs = performance.now() - startedAt;
          this.metricsService.recordJob(jobName, durationMs, true, {
            processedItems: result.analyzed,
          });
          this.metricsService.incrementCounter('scheduler_duration_ms', Math.round(durationMs));
          this.metricsService.incrementCounter('scheduler_duration_ms.pastoral_alert_engine_recurring', Math.round(durationMs));
          this.metricsService.incrementCounter('pastoral.alerts.scheduler.created', result.created);
          this.metricsService.incrementCounter('pastoral.alerts.scheduler.deduped', result.deduped);
          this.metricsService.incrementCounter('pastoral.alerts.scheduler.failed_items', result.failed);
          this.metricsService.setGauge(`scheduler_last_run_timestamp.${jobName}`, Date.now());

          this.logService.event({
            level: 'info',
            module: 'pastoral-alert-engine',
            action: 'scheduler.completed',
            message: 'Pastoral alert recurring job completed',
            status: 'success',
            durationMs,
            metadata: result,
          });

          return { ...result, skipped: false };
        } catch (error) {
          const durationMs = performance.now() - startedAt;
          this.metricsService.recordJob(jobName, durationMs, false);
          this.metricsService.incrementCounter('pastoral.alerts.scheduler.failures', 1);
          this.metricsService.incrementCounter('scheduler_run_failed_total', 1);
          this.metricsService.incrementCounter('scheduler_run_failed_total.pastoral_alert_engine_recurring', 1);
          this.logService.error(
            'Pastoral alert recurring job failed',
            String(error),
            PastoralAlertSchedulerService.name,
          );
          return { analyzed: 0, created: 0, deduped: 0, failed: 1, skipped: false };
        } finally {
          this.running = false;
        }
      },
      { scope: churchId ?? 'global' },
    );

    if (!lock.acquired) {
      this.metricsService.incrementCounter('scheduler_lock_failed_total', 1);
      this.metricsService.incrementCounter('scheduler_lock_failed_total.pastoral_alert_engine_recurring', 1);
      return { analyzed: 0, created: 0, deduped: 0, failed: 0, skipped: true };
    }

    return lock.result ?? { analyzed: 0, created: 0, deduped: 0, failed: 0, skipped: true };
  }
}
