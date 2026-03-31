import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PastoralAlertEngineService } from './pastoral-alert-engine.service';

@Injectable()
export class PastoralAlertSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly engine: PastoralAlertEngineService,
    private readonly logService: LogService,
    private readonly metricsService: AppMetricsService,
  ) {}

  onModuleInit() {
    const enabled = process.env.PASTORAL_ALERT_ENGINE_ENABLED !== 'false';
    if (!enabled) {
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

  private resolveIntervalMs() {
    const configured = Number(process.env.PASTORAL_ALERT_ENGINE_INTERVAL_MS);
    if (Number.isFinite(configured) && configured >= 60_000) {
      return configured;
    }
    return 24 * 60 * 60 * 1000;
  }

  private async executeRecurring(churchId?: string) {
    const jobName = 'pastoral_alert_engine_recurring';
    if (this.running) {
      this.metricsService.recordJob(jobName, 0, true, { skipped: true });
      this.logService.event({
        level: 'warn',
        module: 'pastoral-alert-engine',
        action: 'scheduler.skipped_overlap',
        message: 'Pastoral alert recurring job skipped due to overlap',
      });
      return { analyzed: 0, created: 0, deduped: 0, failed: 0, skipped: true };
    }

    this.running = true;
    const startedAt = performance.now();

    try {
      const result = await this.engine.runRecurringRules({ churchId });
      const durationMs = performance.now() - startedAt;
      this.metricsService.recordJob(jobName, durationMs, true, {
        processedItems: result.analyzed,
      });
      this.metricsService.incrementCounter('pastoral.alerts.scheduler.created', result.created);
      this.metricsService.incrementCounter('pastoral.alerts.scheduler.deduped', result.deduped);
      this.metricsService.incrementCounter('pastoral.alerts.scheduler.failed_items', result.failed);

      this.logService.event({
        level: 'info',
        module: 'pastoral-alert-engine',
        action: 'scheduler.completed',
        message: 'Pastoral alert recurring job completed',
        durationMs,
        metadata: result,
      });

      return { ...result, skipped: false };
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      this.metricsService.recordJob(jobName, durationMs, false);
      this.metricsService.incrementCounter('pastoral.alerts.scheduler.failures', 1);
      this.logService.error(
        'Pastoral alert recurring job failed',
        String(error),
        PastoralAlertSchedulerService.name,
      );
      return { analyzed: 0, created: 0, deduped: 0, failed: 1, skipped: false };
    } finally {
      this.running = false;
    }
  }
}
