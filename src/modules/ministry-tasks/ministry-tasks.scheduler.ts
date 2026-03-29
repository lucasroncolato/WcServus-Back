import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { MinistryTasksService } from './ministry-tasks.service';

@Injectable()
export class MinistryTasksScheduler implements OnModuleInit, OnModuleDestroy {
  private recurrenceTimer: NodeJS.Timeout | null = null;
  private overdueTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ministryTasksService: MinistryTasksService,
    private readonly logService: LogService,
  ) {}

  onModuleInit() {
    const enabled = process.env.MINISTRY_TASKS_SCHEDULER_ENABLED !== 'false';
    if (!enabled) {
      this.logService.log('Ministry tasks scheduler disabled by env', MinistryTasksScheduler.name);
      return;
    }

    this.recurrenceTimer = setInterval(async () => {
      try {
        const result = await this.ministryTasksService.runRecurringGenerationJob({ daysAhead: 30 });
        this.logService.log('Recurring ministry tasks generation executed', MinistryTasksScheduler.name, result);
      } catch (error) {
        this.logService.error('Recurring ministry tasks generation failed', String(error), MinistryTasksScheduler.name);
      }
    }, 60 * 60 * 1000);

    this.overdueTimer = setInterval(async () => {
      try {
        const result = await this.ministryTasksService.markOverdueAndDueSoon();
        this.logService.log('Overdue/due-soon ministry tasks scan executed', MinistryTasksScheduler.name, result);
      } catch (error) {
        this.logService.error('Overdue/due-soon scan failed', String(error), MinistryTasksScheduler.name);
      }
    }, 10 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.recurrenceTimer) {
      clearInterval(this.recurrenceTimer);
      this.recurrenceTimer = null;
    }
    if (this.overdueTimer) {
      clearInterval(this.overdueTimer);
      this.overdueTimer = null;
    }
  }
}
