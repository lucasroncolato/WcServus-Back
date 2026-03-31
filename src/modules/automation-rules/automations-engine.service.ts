import { Injectable } from '@nestjs/common';
import {
  AutomationExecutionSkipReason,
  AutomationExecutionStatus,
  AutomationRule,
  AutomationTriggerType,
  Prisma,
  Role,
} from '@prisma/client';
import { resolveScopedMinistryIds } from 'src/common/auth/access-scope';
import {
  buildAutomationDedupeKey,
  mapExecutionStatus,
  resolveSourceModule,
  shouldSkipByCooldown,
} from 'src/common/automations/automation-policy';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { TimelinePublisherService } from '../timeline/timeline-publisher.service';
import {
  AutomationActionExecutorRegistry,
  AutomationActionInput,
} from './executors/automation-action-executor.registry';

export type AutomationTriggerEventInput = {
  churchId: string;
  triggerKey: string;
  payload: Record<string, unknown>;
  sourceRefId?: string;
  actorUserId?: string;
};

export type AutomationExecutionRequest = {
  churchId: string;
  payload: Record<string, unknown>;
  sourceRefId?: string;
  actorUserId?: string;
  dryRun?: boolean;
  triggerType?: AutomationTriggerType;
  windowBucket?: string;
};

@Injectable()
export class AutomationsEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AutomationActionExecutorRegistry,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
    private readonly timelinePublisher: TimelinePublisherService,
  ) {}

  async handleEventTrigger(event: AutomationTriggerEventInput) {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        churchId: event.churchId,
        triggerType: AutomationTriggerType.EVENT,
        triggerKey: event.triggerKey,
        enabled: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const summary = {
      triggerKey: event.triggerKey,
      checked: rules.length,
      success: 0,
      skipped: 0,
      failed: 0,
      partial: 0,
    };

    for (const rule of rules) {
      const result = await this.executeRule(rule, {
        churchId: event.churchId,
        payload: event.payload,
        sourceRefId: event.sourceRefId,
        actorUserId: event.actorUserId,
        triggerType: AutomationTriggerType.EVENT,
      });

      if (result.status === AutomationExecutionStatus.SUCCESS) summary.success += 1;
      else if (result.status === AutomationExecutionStatus.SKIPPED) summary.skipped += 1;
      else if (result.status === AutomationExecutionStatus.PARTIAL_SUCCESS) summary.partial += 1;
      else summary.failed += 1;
    }

    return summary;
  }

  async runRuleTest(rule: AutomationRule, input: Omit<AutomationExecutionRequest, 'dryRun'>) {
    return this.executeRule(rule, {
      ...input,
      dryRun: true,
      triggerType: rule.triggerType,
    });
  }

  async executeRule(rule: AutomationRule, input: AutomationExecutionRequest) {
    const startedAt = Date.now();
    const actionConfig = (rule.actionConfig as Array<{ action: string; config?: Record<string, unknown> }> | null) ?? [];

    if (!rule.enabled || rule.deletedAt) {
      const details = {
        status: AutomationExecutionStatus.SKIPPED,
        skipReason: AutomationExecutionSkipReason.RULE_DISABLED,
        durationMs: Date.now() - startedAt,
        processed: 0,
        summary: 'Rule disabled',
      };

      if (!input.dryRun) {
        await this.persistExecutionLog(rule, input, details);
      }
      return details;
    }

    if (shouldSkipByCooldown(rule.lastRunAt, rule.cooldownMinutes)) {
      const details = {
        status: AutomationExecutionStatus.SKIPPED,
        skipReason: AutomationExecutionSkipReason.COOLDOWN,
        durationMs: Date.now() - startedAt,
        processed: 0,
        summary: 'Skipped by cooldown',
      };

      if (!input.dryRun) {
        await this.persistExecutionLog(rule, input, details);
      }
      return details;
    }

    const conditionsOk = await this.evaluateRuleConditions(rule, input);
    if (!conditionsOk) {
      const details = {
        status: AutomationExecutionStatus.SKIPPED,
        skipReason: AutomationExecutionSkipReason.CONDITION_FALSE,
        durationMs: Date.now() - startedAt,
        processed: 0,
        summary: 'Conditions evaluated to false',
      };

      if (!input.dryRun) {
        await this.persistExecutionLog(rule, input, details);
      }
      return details;
    }

    const dedupeKey = buildAutomationDedupeKey({
      strategy: rule.dedupeStrategy,
      ruleId: rule.id,
      churchId: rule.churchId,
      triggerKey: rule.triggerKey,
      sourceRefId: input.sourceRefId,
      servantId: this.pickId(input.payload.servantId),
      ministryId: this.pickId(input.payload.ministryId),
      windowBucket: input.windowBucket,
    });

    if (!input.dryRun) {
      const existing = await this.prisma.automationExecutionLog.findFirst({
        where: { churchId: rule.churchId, dedupeKey },
        select: { id: true },
      });
      if (existing) {
        const details = {
          status: AutomationExecutionStatus.SKIPPED,
          skipReason: AutomationExecutionSkipReason.DEDUPE,
          durationMs: Date.now() - startedAt,
          processed: 0,
          summary: 'Skipped by dedupe key',
          dedupeKey,
        };

        await this.persistExecutionLog(rule, input, details);
        return details;
      }
    }

    let processed = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const action of actionConfig) {
      const actionInput: AutomationActionInput = {
        action: action.action,
        config: action.config,
      };

      try {
        const result = await this.registry.execute(actionInput, {
          churchId: rule.churchId,
          ruleId: rule.id,
          triggerKey: rule.triggerKey,
          sourceRefId: input.sourceRefId,
          actorUserId: input.actorUserId,
          payload: input.payload,
          dryRun: input.dryRun,
        });
        if (result.success) {
          processed += result.processed;
        } else {
          failed += 1;
        }
        results.push(result as unknown as Record<string, unknown>);
      } catch (error) {
        failed += 1;
        results.push({
          action: action.action,
          success: false,
          processed: 0,
          message: error instanceof Error ? error.message : 'Execution failed',
        });
      }
    }

    const status = mapExecutionStatus(actionConfig.length - failed, failed);
    const summary =
      status === AutomationExecutionStatus.SUCCESS
        ? 'Rule executed successfully'
        : status === AutomationExecutionStatus.PARTIAL_SUCCESS
          ? 'Rule executed with partial success'
          : 'Rule execution failed';

    if (!input.dryRun) {
      await this.persistExecutionLog(rule, input, {
        status,
        durationMs: Date.now() - startedAt,
        processed,
        summary,
        dedupeKey,
        details: { actions: results },
      });

      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          lastRunAt: new Date(),
        },
      });
    }

    return {
      status,
      durationMs: Date.now() - startedAt,
      processed,
      summary,
      details: {
        actions: results,
      },
      dedupeKey,
      dryRun: Boolean(input.dryRun),
    };
  }

  private async evaluateRuleConditions(rule: AutomationRule, input: AutomationExecutionRequest) {
    const conditionTree = (rule.conditionConfig as Record<string, unknown> | null) ?? null;
    if (!conditionTree) {
      return true;
    }

    return this.evaluateConditionNode(rule, input, conditionTree);
  }

  private async evaluateConditionNode(
    rule: AutomationRule,
    input: AutomationExecutionRequest,
    node: Record<string, unknown>,
  ): Promise<boolean> {
    const operator = String(node.operator ?? '').toLowerCase();
    if (operator === 'and' && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (!child || typeof child !== 'object') continue;
        const ok = await this.evaluateConditionNode(rule, input, child as Record<string, unknown>);
        if (!ok) return false;
      }
      return true;
    }

    if (operator === 'or' && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (!child || typeof child !== 'object') continue;
        const ok = await this.evaluateConditionNode(rule, input, child as Record<string, unknown>);
        if (ok) return true;
      }
      return false;
    }

    if (operator === 'not') {
      const child = Array.isArray(node.children) ? node.children[0] : null;
      if (!child || typeof child !== 'object') return true;
      const ok = await this.evaluateConditionNode(rule, input, child as Record<string, unknown>);
      return !ok;
    }

    const condition = String(node.condition ?? '').toLowerCase();

    switch (condition) {
      case 'field_equals': {
        const field = String(node.field ?? '');
        const expected = node.value;
        return this.getFieldValue(input.payload, field) === expected;
      }
      case 'field_in': {
        const field = String(node.field ?? '');
        const value = this.getFieldValue(input.payload, field);
        const options = Array.isArray(node.values) ? node.values : [];
        return options.includes(value);
      }
      case 'count_in_window_gte': {
        const field = String(node.field ?? 'count');
        const count = Number(this.getFieldValue(input.payload, field) ?? 0);
        const threshold = Number(node.threshold ?? 1);
        return Number.isFinite(count) && count >= threshold;
      }
      case 'score_below_threshold': {
        const field = String(node.field ?? 'score');
        const score = Number(this.getFieldValue(input.payload, field) ?? 0);
        const threshold = Number(node.threshold ?? 0);
        return Number.isFinite(score) && score < threshold;
      }
      case 'has_open_pastoral_case_eq': {
        const servantId = this.pickId(this.getFieldValue(input.payload, String(node.field ?? 'servantId')));
        if (!servantId) return false;
        const openCount = await this.prisma.pastoralVisit.count({
          where: {
            churchId: rule.churchId,
            servantId,
            deletedAt: null,
            status: { in: ['ABERTA', 'EM_ANDAMENTO'] as any },
          },
        });
        return openCount > 0 === Boolean(node.value);
      }
      case 'service_locked_eq': {
        const locked = Boolean(this.getFieldValue(input.payload, String(node.field ?? 'serviceLocked')));
        return locked === Boolean(node.value);
      }
      case 'module_enabled_eq': {
        const moduleKey = String(node.moduleKey ?? node.value ?? '');
        if (!moduleKey) return false;
        const module = await this.prisma.churchModule.findFirst({
          where: { churchId: rule.churchId, moduleKey: moduleKey as any },
          select: { enabled: true },
        });
        return Boolean(module?.enabled) === (node.expectedEnabled === undefined ? true : Boolean(node.expectedEnabled));
      }
      case 'within_scope_eq': {
        const ministryId = this.pickId(this.getFieldValue(input.payload, String(node.field ?? 'ministryId')));
        if (!ministryId) return false;

        const actor = await this.resolveActor(input.actorUserId, rule.churchId);
        if (!actor) return true;
        if (
          actor.role === Role.SUPER_ADMIN ||
          actor.role === Role.ADMIN ||
          actor.role === Role.PASTOR
        ) {
          return true;
        }

        const scopedMinistries = await resolveScopedMinistryIds(this.prisma, actor);
        return scopedMinistries.includes(ministryId) === (node.value === undefined ? true : Boolean(node.value));
      }
      case 'not_alerted_in_window_eq': {
        const servantId = this.pickId(this.getFieldValue(input.payload, String(node.field ?? 'servantId')));
        if (!servantId) return false;

        const windowDays = Number(node.windowDays ?? 30);
        const since = new Date(Date.now() - Math.max(1, windowDays) * 24 * 60 * 60 * 1000);
        const count = await this.prisma.pastoralAlert.count({
          where: {
            churchId: rule.churchId,
            servantId,
            deletedAt: null,
            createdAt: { gte: since },
            status: 'OPEN' as any,
          },
        });
        return count === 0;
      }
      case 'no_active_followup_eq': {
        const servantId = this.pickId(this.getFieldValue(input.payload, String(node.field ?? 'servantId')));
        if (!servantId) return false;
        const followUps = await this.prisma.pastoralFollowUp.count({
          where: {
            churchId: rule.churchId,
            pastoralVisit: {
              servantId,
              deletedAt: null,
            },
            completedAt: null,
            deletedAt: null,
          },
        });
        return followUps === 0;
      }
      default:
        return true;
    }
  }

  private async persistExecutionLog(
    rule: AutomationRule,
    input: AutomationExecutionRequest,
    details: {
      status: AutomationExecutionStatus;
      skipReason?: AutomationExecutionSkipReason;
      durationMs: number;
      processed: number;
      summary: string;
      dedupeKey?: string;
      details?: Record<string, unknown>;
    },
  ) {
    const dedupeKey = details.dedupeKey ?? `${rule.id}:run:${Date.now()}`;
    const dedupeKeyForPersistence =
      details.status === AutomationExecutionStatus.SKIPPED && details.skipReason === AutomationExecutionSkipReason.DEDUPE
        ? `${dedupeKey}:skip:${Date.now()}`
        : dedupeKey;

    const payload = {
      churchId: rule.churchId,
      ruleId: rule.id,
      triggerType: input.triggerType ?? rule.triggerType,
      triggerKey: rule.triggerKey,
      sourceModule: resolveSourceModule(rule.triggerKey),
      sourceRefId: input.sourceRefId,
      dedupeKey: dedupeKeyForPersistence,
      status: details.status,
      skipReason: details.skipReason,
      summary: details.summary,
      details: details.details as Prisma.InputJsonValue | undefined,
      durationMs: details.durationMs,
      executedAt: new Date(),
      message: details.summary,
      processed: details.processed,
      metadata: {
        dryRun: Boolean(input.dryRun),
        baseDedupeKey: dedupeKey,
      } as Prisma.InputJsonValue,
    } as Prisma.AutomationExecutionLogUncheckedCreateInput;

    await this.prisma.automationExecutionLog.create({ data: payload });

    this.metrics.incrementCounter(`automation_execution_total.${details.status.toLowerCase()}`, 1);
    this.metrics.incrementCounter(
      'automation_execution_duration_ms_total',
      Math.max(0, Math.round(details.durationMs)),
    );

    this.logService.event({
      level: details.status === AutomationExecutionStatus.FAILED ? 'error' : 'info',
      module: 'automations',
      action: 'rule.execution',
      message: details.summary,
      churchId: rule.churchId,
      durationMs: details.durationMs,
      metadata: {
        ruleId: rule.id,
        triggerKey: rule.triggerKey,
        status: details.status,
        skipReason: details.skipReason,
        dedupeKey,
        sourceRefId: input.sourceRefId,
      },
    });

    if (details.status === AutomationExecutionStatus.SUCCESS || details.status === AutomationExecutionStatus.SKIPPED) {
      await this.timelinePublisher.publish({
        churchId: rule.churchId,
        eventType:
          details.status === AutomationExecutionStatus.SUCCESS
            ? 'TIMELINE_AUTOMATION_RULE_EXECUTED'
            : 'TIMELINE_AUTOMATION_RULE_SKIPPED',
        actorType: 'AUTOMATION',
        actorUserId: input.actorUserId ?? null,
        subjectType: 'AUTOMATION_RULE',
        subjectId: rule.id,
        relatedEntityType: 'AUTOMATION_TRIGGER',
        relatedEntityId: rule.triggerKey,
        dedupeKey: `${rule.churchId}:${rule.id}:${rule.triggerKey}:${details.status}:${new Date().toISOString().slice(0, 13)}`,
        title:
          details.status === AutomationExecutionStatus.SUCCESS
            ? 'Automacao executada'
            : 'Automacao ignorada',
        message: details.summary,
        metadata: {
          status: details.status,
          skipReason: details.skipReason ?? null,
          dedupeKey,
        },
      });
    }
  }

  private getFieldValue(payload: Record<string, unknown>, field: string) {
    if (!field) return undefined;

    if (!field.includes('.')) {
      return payload[field];
    }

    return field.split('.').reduce<unknown>((acc, key) => {
      if (!acc || typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, payload);
  }

  private pickId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  private async resolveActor(actorUserId: string | undefined, churchId: string): Promise<JwtPayload | null> {
    if (!actorUserId) {
      return null;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: actorUserId, churchId, deletedAt: null },
      select: {
        id: true,
        churchId: true,
        role: true,
        servantId: true,
        scope: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      sub: user.id,
      email: '',
      churchId: user.churchId,
      role: user.role,
      servantId: user.servantId ?? null,
    } as JwtPayload;
  }
}
