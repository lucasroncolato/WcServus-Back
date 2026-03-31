import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AutomationsSchedulerService } from './automations-scheduler.service';

@Injectable()
export class AutomationsSchedulerRunner implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly scheduler: AutomationsSchedulerService,
    private readonly logService: LogService,
  ) {}

  onModuleInit() {
    if (!this.scheduler.isEnabled()) {
      this.logService.event({
        level: 'info',
        module: 'automations',
        action: 'scheduler.disabled',
        message: 'Automations scheduler disabled by env',
      });
      return;
    }

    this.timer = setInterval(() => {
      this.scheduler.runOnce().catch((error) => {
        this.logService.event({
          level: 'error',
          module: 'automations',
          action: 'scheduler.cycle_failed',
          message: 'Automations scheduler cycle failed',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      });
    }, this.scheduler.resolveIntervalMs());
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
