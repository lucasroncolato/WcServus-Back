import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { SchedulerLockService } from 'src/common/scheduler-lock/scheduler-lock.service';
import { AnalyticsSnapshotService } from './analytics-snapshot.service';

@Injectable()
export class AnalyticsSnapshotScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly snapshots: AnalyticsSnapshotService,
    private readonly logService: LogService,
    private readonly metrics: AppMetricsService,
    private readonly schedulerLock: SchedulerLockService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logService.log('Analytics snapshot scheduler disabled by env', AnalyticsSnapshotScheduler.name);
      return;
    }

    const intervalMs = this.resolveIntervalMs();
    this.timer = setInterval(() => void this.executeCycle(), intervalMs);
    void this.executeCycle();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runNow(churchId?: string) {
    return this.executeCycle(churchId);
  }

  status() {
    return {
      enabled: this.isEnabled(),
      intervalMs: this.resolveIntervalMs(),
      running: this.running,
    };
  }

  isEnabled() {
    return process.env.ANALYTICS_SNAPSHOT_ENABLED !== 'false';
  }

  resolveIntervalMs() {
    return this.snapshots.resolveIntervalMs();
  }

  private resolveTimeoutMs() {
    const raw = Number(process.env.ANALYTICS_SNAPSHOT_TIMEOUT_MS ?? 15 * 60 * 1000);
    if (!Number.isFinite(raw) || raw < 60_000) {
      return 15 * 60 * 1000;
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

  private async executeCycle(churchId?: string) {
    const jobName = 'analytics_snapshot_materialization';
    this.metrics.incrementCounter('scheduler_run_total', 1);
    this.metrics.incrementCounter('scheduler_run_total.analytics_snapshot_materialization', 1);

    const lock = await this.schedulerLock.withLock(
      jobName,
      async () => {
        if (this.running) {
          this.metrics.recordJob(jobName, 0, true, { skipped: true });
          this.logService.event({
            level: 'warn',
            module: 'analytics',
            action: 'snapshot.scheduler.skipped_overlap',
            message: 'Analytics snapshot cycle skipped due to overlap',
            status: 'skip',
          });
          return { refreshed: 0, failed: 0, skipped: true };
        }

        this.running = true;
        const started = performance.now();

        try {
          const result = await this.withTimeout(
            this.snapshots.refreshAllSnapshots({ churchId }),
            this.resolveTimeoutMs(),
            jobName,
          );
          const durationMs = performance.now() - started;
          this.metrics.recordJob(jobName, durationMs, result.failed === 0, {
            processedItems: result.refreshed + result.failed,
          });
          this.metrics.incrementCounter('scheduler_duration_ms', Math.round(durationMs));
          this.metrics.incrementCounter('scheduler_duration_ms.analytics_snapshot_materialization', Math.round(durationMs));
          this.metrics.setGauge(`scheduler_last_run_timestamp.${jobName}`, Date.now());
          this.logService.event({
            level: 'info',
            module: 'analytics',
            action: 'snapshot.scheduler.completed',
            message: 'Analytics snapshot cycle completed',
            status: result.failed === 0 ? 'success' : 'error',
            durationMs,
            metadata: result,
          });
          return { ...result, skipped: false };
        } catch (error) {
          const durationMs = performance.now() - started;
          this.metrics.recordJob(jobName, durationMs, false);
          this.metrics.incrementCounter('analytics_snapshot_refresh_failed_total', 1);
          this.metrics.incrementCounter('analytics_snapshot_failed_total', 1);
          this.metrics.incrementCounter('scheduler_run_failed_total', 1);
          this.metrics.incrementCounter('scheduler_run_failed_total.analytics_snapshot_materialization', 1);
          this.logService.error('Analytics snapshot cycle failed', String(error), AnalyticsSnapshotScheduler.name);
          return { refreshed: 0, failed: 1, skipped: false };
        } finally {
          this.running = false;
        }
      },
      { scope: churchId ?? 'global' },
    );

    if (!lock.acquired) {
      this.metrics.incrementCounter('scheduler_lock_failed_total', 1);
      this.metrics.incrementCounter('scheduler_lock_failed_total.analytics_snapshot_materialization', 1);
      return { refreshed: 0, failed: 0, skipped: true };
    }

    return lock.result ?? { refreshed: 0, failed: 0, skipped: true };
  }
}
