import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { JourneyReconcileService } from './journey-reconcile.service';

@Injectable()
export class JourneyReconcileScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly reconcileService: JourneyReconcileService,
    private readonly logService: LogService,
    private readonly metricsService: AppMetricsService,
  ) {}

  onModuleInit() {
    const enabled = process.env.JOURNEY_RECONCILE_ENABLED !== 'false';
    if (!enabled) {
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

  private resolveIntervalMs() {
    const configured = Number(process.env.JOURNEY_RECONCILE_INTERVAL_MS);
    if (Number.isFinite(configured) && configured >= 60_000) {
      return configured;
    }
    return 24 * 60 * 60 * 1000;
  }

  private async executeDaily() {
    const jobName = 'journey_reconcile_daily';
    if (this.running) {
      this.metricsService.recordJob(jobName, 0, true, { skipped: true });
      this.logService.event({
        level: 'warn',
        module: 'journey-reconcile',
        action: 'daily.skipped_overlap',
        message: 'Journey daily reconcile skipped due to overlap',
      });
      return;
    }

    this.running = true;
    try {
      await this.reconcileService.reconcileDaily();
    } catch (error) {
      this.logService.error(
        'Journey daily reconcile failed',
        String(error),
        JourneyReconcileScheduler.name,
      );
    } finally {
      this.running = false;
    }
  }
}

