import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { SchedulerLockService } from 'src/common/scheduler-lock/scheduler-lock.service';
import { JourneyReconcileService } from './journey-reconcile.service';

@Injectable()
export class JourneyReconcileScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly reconcileService: JourneyReconcileService,
    private readonly logService: LogService,
    private readonly metricsService: AppMetricsService,
    private readonly schedulerLock: SchedulerLockService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logService.log('Journey reconcile scheduler disabled by env', JourneyReconcileScheduler.name);
      return;
    }

    const intervalMs = this.resolveIntervalMs();
    this.timer = setInterval(() => void this.executeDaily(), intervalMs);
    void this.executeDaily();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runNow() {
    return this.executeDaily();
  }

  status() {
    return {
      enabled: this.isEnabled(),
      intervalMs: this.resolveIntervalMs(),
      running: this.running,
    };
  }

  isEnabled() {
    return process.env.JOURNEY_RECONCILE_ENABLED !== 'false';
  }

  private resolveIntervalMs() {
    const configured = Number(process.env.JOURNEY_RECONCILE_INTERVAL_MS);
    if (Number.isFinite(configured) && configured >= 60_000) {
      return configured;
    }
    return 24 * 60 * 60 * 1000;
  }

  private resolveTimeoutMs() {
    const configured = Number(process.env.JOURNEY_RECONCILE_TIMEOUT_MS);
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

  private async executeDaily() {
    const jobName = 'journey_reconcile_daily';
    this.metricsService.incrementCounter('scheduler_run_total', 1);
    this.metricsService.incrementCounter('scheduler_run_total.journey_reconcile_daily', 1);

    const lock = await this.schedulerLock.withLock(jobName, async () => {
      if (this.running) {
        this.metricsService.recordJob(jobName, 0, true, { skipped: true });
        this.logService.event({
          level: 'warn',
          module: 'journey-reconcile',
          action: 'daily.skipped_overlap',
          message: 'Journey daily reconcile skipped due to overlap',
          status: 'skip',
        });
        return;
      }

      this.running = true;
      const startedAt = performance.now();
      try {
        await this.withTimeout(this.reconcileService.reconcileDaily(), this.resolveTimeoutMs(), jobName);
        const durationMs = performance.now() - startedAt;
        this.metricsService.recordJob(jobName, durationMs, true);
        this.metricsService.incrementCounter('scheduler_duration_ms', Math.round(durationMs));
        this.metricsService.incrementCounter('scheduler_duration_ms.journey_reconcile_daily', Math.round(durationMs));
        this.metricsService.setGauge(`scheduler_last_run_timestamp.${jobName}`, Date.now());
        this.logService.event({
          level: 'info',
          module: 'journey-reconcile',
          action: 'daily.completed',
          status: 'success',
          message: 'Journey daily reconcile completed',
          durationMs,
        });
      } catch (error) {
        const durationMs = performance.now() - startedAt;
        this.metricsService.recordJob(jobName, durationMs, false);
        this.metricsService.incrementCounter('scheduler_run_failed_total', 1);
        this.metricsService.incrementCounter('scheduler_run_failed_total.journey_reconcile_daily', 1);
        this.logService.error(
          'Journey daily reconcile failed',
          String(error),
          JourneyReconcileScheduler.name,
        );
      } finally {
        this.running = false;
      }
    });

    if (!lock.acquired) {
      this.metricsService.incrementCounter('scheduler_lock_failed_total', 1);
      this.metricsService.incrementCounter('scheduler_lock_failed_total.journey_reconcile_daily', 1);
    }
  }
}
