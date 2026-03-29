import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { LogService } from 'src/common/log/log.service';
import { AutomationEngineService } from './automation-engine.service';

@Injectable()
export class AutomationEngineScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly engine: AutomationEngineService,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
  ) {}

  onModuleInit() {
    const enabled = process.env.AUTOMATION_ENGINE_ENABLED !== 'false';
    if (!enabled) {
      return;
    }

    this.timer = setInterval(async () => {
      if (this.running) {
        this.metrics.recordJob('automation_engine_scan', 0, true, { skipped: true });
        return;
      }
      this.running = true;
      const startedAt = performance.now();
      try {
        const result = await this.engine.runTimeAndConditionRules();
        this.metrics.recordJob('automation_engine_scan', performance.now() - startedAt, true, {
          processedItems: result.executed,
        });
        this.logService.event({
          level: 'info',
          module: 'automation-engine',
          action: 'scan.completed',
          message: 'Automation engine scan completed',
          metadata: result,
        });
      } catch (error) {
        this.metrics.recordJob('automation_engine_scan', performance.now() - startedAt, false);
        this.logService.error('Automation engine scan failed', String(error), AutomationEngineScheduler.name);
      } finally {
        this.running = false;
      }
    }, 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
