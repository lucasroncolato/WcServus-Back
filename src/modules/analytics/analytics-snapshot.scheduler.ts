import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { AnalyticsSnapshotService } from './analytics-snapshot.service';

@Injectable()
export class AnalyticsSnapshotScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly snapshots: AnalyticsSnapshotService,
    private readonly logService: LogService,
    private readonly metrics: AppMetricsService,
  ) {}

  onModuleInit() {
    const enabled = process.env.ANALYTICS_SNAPSHOT_ENABLED !== 'false';
    if (!enabled) {
      this.logService.log('Analytics snapshot scheduler disabled by env', AnalyticsSnapshotScheduler.name);
      return;
    }

    const intervalMs = this.snapshots.resolveIntervalMs();
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

  private async executeCycle(churchId?: string) {
    const jobName = 'analytics_snapshot_materialization';
    if (this.running) {
      this.metrics.recordJob(jobName, 0, true, { skipped: true });
      this.logService.event({
        level: 'warn',
        module: 'analytics',
        action: 'snapshot.scheduler.skipped_overlap',
        message: 'Analytics snapshot cycle skipped due to overlap',
      });
      return { refreshed: 0, failed: 0, skipped: true };
    }

    this.running = true;
    const started = performance.now();

    try {
      const result = await this.snapshots.refreshAllSnapshots({ churchId });
      const durationMs = performance.now() - started;
      this.metrics.recordJob(jobName, durationMs, result.failed === 0, {
        processedItems: result.refreshed + result.failed,
      });
      this.logService.event({
        level: 'info',
        module: 'analytics',
        action: 'snapshot.scheduler.completed',
        message: 'Analytics snapshot cycle completed',
        durationMs,
        metadata: result,
      });
      return { ...result, skipped: false };
    } catch (error) {
      const durationMs = performance.now() - started;
      this.metrics.recordJob(jobName, durationMs, false);
      this.metrics.incrementCounter('analytics_snapshot_refresh_failed_total', 1);
      this.logService.error('Analytics snapshot cycle failed', String(error), AnalyticsSnapshotScheduler.name);
      return { refreshed: 0, failed: 1, skipped: false };
    } finally {
      this.running = false;
    }
  }
}
