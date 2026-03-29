import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AutomationActionType } from '@prisma/client';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { AutomationRulesService } from '../automation-rules/automation-rules.service';
import { MinistryTasksService } from './ministry-tasks.service';

@Injectable()
export class MinistryTasksScheduler implements OnModuleInit, OnModuleDestroy {
  private recurrenceTimer: NodeJS.Timeout | null = null;
  private overdueTimer: NodeJS.Timeout | null = null;
  private operationalAlertsTimer: NodeJS.Timeout | null = null;
  private recurrenceRunning = false;
  private overdueRunning = false;
  private operationalAlertsRunning = false;

  constructor(
    private readonly ministryTasksService: MinistryTasksService,
    private readonly automationRulesService: AutomationRulesService,
    private readonly logService: LogService,
    private readonly metricsService: AppMetricsService,
  ) {}

  onModuleInit() {
    const enabled = process.env.MINISTRY_TASKS_SCHEDULER_ENABLED !== 'false';
    if (!enabled) {
      this.logService.log('Ministry tasks scheduler disabled by env', MinistryTasksScheduler.name);
      return;
    }

    this.recurrenceTimer = setInterval(async () => {
      if (this.recurrenceRunning) {
        this.recordSkip('ministry_tasks_recurrence');
        return;
      }
      if (!(await this.automationRulesService.shouldRunGlobalAction(AutomationActionType.TASK_MARK_OVERDUE))) {
        this.recordDisabled('ministry_tasks_recurrence');
        return;
      }
      this.recurrenceRunning = true;
      await this.executeJob(
        'ministry_tasks_recurrence',
        () => this.ministryTasksService.runRecurringGenerationJob({ daysAhead: 30 }),
        MinistryTasksScheduler.name,
      );
      this.recurrenceRunning = false;
    }, 60 * 60 * 1000);

    this.overdueTimer = setInterval(async () => {
      if (this.overdueRunning) {
        this.recordSkip('ministry_tasks_deadline_scan');
        return;
      }
      if (!(await this.automationRulesService.shouldRunGlobalAction(AutomationActionType.TASK_NOTIFY_DUE_SOON))) {
        this.recordDisabled('ministry_tasks_deadline_scan');
        return;
      }
      this.overdueRunning = true;
      await this.executeJob(
        'ministry_tasks_deadline_scan',
        () => this.ministryTasksService.markOverdueAndDueSoon(),
        MinistryTasksScheduler.name,
      );
      this.overdueRunning = false;
    }, 10 * 60 * 1000);

    this.operationalAlertsTimer = setInterval(async () => {
      if (this.operationalAlertsRunning) {
        this.recordSkip('operations_schedule_alerts');
        return;
      }
      if (
        !(await this.automationRulesService.shouldRunGlobalAction(
          AutomationActionType.SCHEDULE_ALERT_INCOMPLETE,
        ))
      ) {
        this.recordDisabled('operations_schedule_alerts');
        return;
      }
      this.operationalAlertsRunning = true;
      await this.executeJob(
        'operations_schedule_alerts',
        () => this.ministryTasksService.emitOperationalAlerts(),
        MinistryTasksScheduler.name,
      );
      this.operationalAlertsRunning = false;
    }, 30 * 60 * 1000);
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
    if (this.operationalAlertsTimer) {
      clearInterval(this.operationalAlertsTimer);
      this.operationalAlertsTimer = null;
    }
  }

  private async executeJob(
    jobName: string,
    executor: () => Promise<Record<string, unknown>>,
    context: string,
  ) {
    const startedAt = performance.now();
    try {
      const result = await executor();
      const durationMs = performance.now() - startedAt;
      const processedItems = this.pickProcessedItems(result);
      this.logService.event({
        level: 'info',
        module: 'scheduler',
        action: `${jobName}.completed`,
        message: `Job ${jobName} finished`,
        durationMs,
        metadata: result,
      });
      this.metricsService.recordJob(jobName, durationMs, true, { processedItems });
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      this.logService.error(`Job ${jobName} failed`, String(error), context);
      this.metricsService.recordJob(jobName, durationMs, false);
    }
  }

  private recordSkip(jobName: string) {
    this.logService.event({
      level: 'warn',
      module: 'scheduler',
      action: `${jobName}.skipped_overlap`,
      message: `Job ${jobName} skipped due to overlap`,
    });
    this.metricsService.recordJob(jobName, 0, true, { skipped: true });
  }

  private recordDisabled(jobName: string) {
    this.logService.event({
      level: 'info',
      module: 'scheduler',
      action: `${jobName}.disabled_by_rule`,
      message: `Job ${jobName} disabled by automation rules`,
    });
  }

  private pickProcessedItems(result: Record<string, unknown>) {
    const knownKeys = [
      'processed',
      'created',
      'alertsCreated',
      'overdueMarked',
      'dueSoonDetected',
      'servicesChecked',
    ];
    for (const key of knownKeys) {
      const value = result[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }
    return 0;
  }
}
