import { Injectable } from '@nestjs/common';
import {
  AutomationActionType,
  AuditAction,
  AutomationRule,
  AutomationTriggerType,
  Prisma,
} from '@prisma/client';
import { LogService } from 'src/common/log/log.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MinistryTasksService } from '../ministry-tasks/ministry-tasks.service';
import { TimelinePublisherService } from '../timeline/timeline-publisher.service';

@Injectable()
export class AutomationEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ministryTasksService: MinistryTasksService,
    private readonly auditService: AuditService,
    private readonly logService: LogService,
    private readonly timelinePublisher: TimelinePublisherService,
  ) {}

  async runTimeAndConditionRules() {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        enabled: true,
        triggerType: { in: [AutomationTriggerType.TIME, AutomationTriggerType.CONDITION] },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    let executed = 0;
    let skipped = 0;
    for (const rule of rules) {
      const shouldRun = await this.shouldRun(rule);
      if (!shouldRun) {
        skipped += 1;
        continue;
      }

      const dedupeKey = this.buildDedupeKey(rule);
      const already = await this.prisma.automationExecutionLog.findFirst({
        where: { churchId: rule.churchId, dedupeKey },
        select: { id: true },
      });
      if (already) {
        skipped += 1;
        continue;
      }

      try {
        const result = await this.executeRule(rule);
        await this.prisma.automationExecutionLog.create({
          data: {
            churchId: rule.churchId,
            ruleId: rule.id,
            dedupeKey,
            status: 'SUCCESS',
            processed: result.processed,
            message: result.message,
            metadata: result.metadata as Prisma.InputJsonValue | undefined,
          },
        });
        await this.timelinePublisher.publish({
          churchId: rule.churchId,
          eventType: 'TIMELINE_AUTOMATION_RULE_EXECUTED',
          actorType: 'AUTOMATION',
          title: `Automacao executada: ${rule.name}`,
          message: result.message,
          subjectType: 'AUTOMATION_RULE',
          subjectId: rule.id,
          relatedEntityType: 'AUTOMATION_EXECUTION',
          relatedEntityId: rule.id,
          dedupeKey,
          metadata: {
            sourceModule: 'automation-engine',
            ruleId: rule.id,
            ruleName: rule.name,
            actionType: rule.actionType,
            processed: result.processed,
          },
          occurredAt: new Date(),
        });
        await this.prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
        await this.auditService.log({
          action: AuditAction.CREATE,
          entity: 'AutomationExecution',
          entityId: rule.id,
          churchId: rule.churchId,
          metadata: { dedupeKey, actionType: rule.actionType, processed: result.processed },
        });
        executed += 1;
      } catch (error) {
        await this.prisma.automationExecutionLog.create({
          data: {
            churchId: rule.churchId,
            ruleId: rule.id,
            dedupeKey,
            status: 'FAILED',
            processed: 0,
            message: error instanceof Error ? error.message : 'Automation failed',
            metadata: { actionType: rule.actionType } as Prisma.InputJsonValue,
          },
        });
        this.logService.event({
          level: 'error',
          module: 'automation-engine',
          action: 'rule.failed',
          message: rule.name,
          churchId: rule.churchId,
          metadata: { ruleId: rule.id, actionType: rule.actionType },
        });
      }
    }

    return { checked: rules.length, executed, skipped };
  }

  private async shouldRun(rule: AutomationRule) {
    if (!rule.lastRunAt) {
      return true;
    }
    const config = (rule.triggerConfig as { everyMinutes?: number } | null) ?? null;
    const everyMinutes = Math.max(1, config?.everyMinutes ?? 30);
    return Date.now() - rule.lastRunAt.getTime() >= everyMinutes * 60 * 1000;
  }

  private buildDedupeKey(rule: AutomationRule) {
    const hour = new Date().toISOString().slice(0, 13);
    return `${rule.id}:${hour}`;
  }

  private async executeRule(rule: AutomationRule): Promise<{ processed: number; message: string; metadata?: Record<string, unknown> }> {
    switch (rule.actionType) {
      case AutomationActionType.TASK_MARK_OVERDUE: {
        const result = await this.ministryTasksService.markOverdueAndDueSoon();
        return { processed: result.overdueMarked ?? 0, message: 'Overdue scan executed', metadata: result as Record<string, unknown> };
      }
      case AutomationActionType.SCHEDULE_ALERT_INCOMPLETE: {
        const result = await this.ministryTasksService.emitOperationalAlerts();
        return { processed: result.alertsCreated ?? 0, message: 'Incomplete schedule alerts emitted', metadata: result as Record<string, unknown> };
      }
      case AutomationActionType.TRAINING_ALERT_PENDING: {
        const pending = await this.prisma.servant.findMany({
          where: { churchId: rule.churchId, deletedAt: null, trainingStatus: 'PENDING' },
          select: { id: true, name: true },
          take: 200,
        });
        const admins = await this.prisma.user.findMany({
          where: { churchId: rule.churchId, status: 'ACTIVE', role: { in: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] } },
          select: { id: true },
        });
        let created = 0;
        for (const admin of admins) {
          await this.prisma.notification.create({
            data: {
              userId: admin.id,
              churchId: rule.churchId,
              type: 'TRAINING_PENDING_ALERT',
              title: 'Treinamentos pendentes',
              message: `Existem ${pending.length} servos com treinamento pendente.`,
              link: '/reports',
              metadata: { origin: 'automation-engine', ruleId: rule.id } as Prisma.InputJsonValue,
            },
          });
          created += 1;
        }
        return { processed: created, message: 'Training pending alerts emitted', metadata: { pendingServants: pending.length } };
      }
      case AutomationActionType.TRACK_ALERT_STALLED: {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const stalled = await this.prisma.servantGrowthProgress.count({
          where: { churchId: rule.churchId, completed: false, updatedAt: { lte: cutoff } },
        });
        return { processed: stalled, message: 'Track stalled analysis generated' };
      }
      case AutomationActionType.TASK_ALERT_UNASSIGNED: {
        const count = await this.prisma.ministryTaskOccurrence.count({
          where: {
            churchId: rule.churchId,
            deletedAt: null,
            assignedServantId: null,
            status: { in: ['PENDING', 'ASSIGNED'] },
          },
        });
        return { processed: count, message: 'Unassigned task analysis generated' };
      }
      default:
        return { processed: 0, message: 'Action type mapped for future implementation' };
    }
  }
}
