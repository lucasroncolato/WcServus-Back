import {
  AutomationActionType,
  AutomationDedupeStrategy,
  AutomationExecutionStatus,
  AutomationSourceModule,
} from '@prisma/client';
import { AUTOMATION_ACTION_CATALOG, type AutomationActionKey } from './automation-action-catalog';
import { AUTOMATION_CONDITION_CATALOG, type AutomationConditionKey } from './automation-condition-catalog';
import { AUTOMATION_TRIGGER_CATALOG, type AutomationTriggerKey, isAutomationTriggerKey } from './automation-trigger-catalog';

export type AutomationRuleShape = {
  triggerKey: string;
  conditionConfig?: unknown;
  actionConfig?: unknown;
  actionType?: AutomationActionType | null;
  cooldownMinutes?: number;
  dedupeStrategy?: AutomationDedupeStrategy;
};

export const AUTOMATION_POLICY = {
  supportsCooldown: true,
  supportsDedupe: true,
  safeDefaultDedupeStrategy: AutomationDedupeStrategy.BY_EVENT,
  allowedTriggers: AUTOMATION_TRIGGER_CATALOG,
  allowedConditions: AUTOMATION_CONDITION_CATALOG,
  allowedActions: AUTOMATION_ACTION_CATALOG,
};

export function validateAutomationRuleShape(input: AutomationRuleShape) {
  if (!isAutomationTriggerKey(input.triggerKey)) {
    throw new Error('Invalid trigger key');
  }

  if (input.cooldownMinutes !== undefined && (input.cooldownMinutes < 0 || input.cooldownMinutes > 60 * 24 * 30)) {
    throw new Error('Invalid cooldownMinutes');
  }

  const actionConfig = normalizeAutomationActionConfig(input.actionConfig, input.actionType);
  if (!Array.isArray(actionConfig) || actionConfig.length === 0) {
    throw new Error('At least one action is required');
  }

  for (const item of actionConfig) {
    if (!item?.action || !(AUTOMATION_ACTION_CATALOG as readonly string[]).includes(item.action)) {
      throw new Error(`Invalid action: ${String(item?.action ?? '')}`);
    }
  }

  return true;
}

export function normalizeAutomationActionConfig(
  actionConfig: unknown,
  actionType?: AutomationActionType | null,
): Array<{ action: string; config?: Record<string, unknown> }> {
  if (Array.isArray(actionConfig)) {
    return actionConfig
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        action: String(item.action ?? '').trim(),
        config:
          item.config && typeof item.config === 'object' && !Array.isArray(item.config)
            ? (item.config as Record<string, unknown>)
            : undefined,
      }))
      .filter((item) => item.action.length > 0);
  }

  if (actionConfig && typeof actionConfig === 'object') {
    const raw = actionConfig as Record<string, unknown>;
    if (Array.isArray(raw.actions)) {
      return normalizeAutomationActionConfig(raw.actions, actionType);
    }

    if (typeof raw.action === 'string' && raw.action.trim().length > 0) {
      return [
        {
          action: raw.action.trim(),
          config:
            raw.config && typeof raw.config === 'object' && !Array.isArray(raw.config)
              ? (raw.config as Record<string, unknown>)
              : undefined,
        },
      ];
    }
  }

  if (typeof actionConfig === 'string' && actionConfig.trim().length > 0) {
    return [{ action: actionConfig.trim() }];
  }

  if (actionType) {
    const legacyAction = mapLegacyActionTypeToAction(actionType);
    if (legacyAction) {
      return [{ action: legacyAction }];
    }
  }

  return [];
}

function mapLegacyActionTypeToAction(actionType: AutomationActionType): AutomationActionKey | null {
  switch (actionType) {
    case AutomationActionType.SCHEDULE_ALERT_UNCONFIRMED:
      return 'resend_schedule_notification';
    case AutomationActionType.SCHEDULE_ALERT_INCOMPLETE:
      return 'flag_slot_attention';
    case AutomationActionType.SCHEDULE_FOLLOWUP_DECLINED:
      return 'suggest_substitute';
    case AutomationActionType.TASK_NOTIFY_COORDINATOR_OVERDUE:
      return 'assign_task_to_leader';
    case AutomationActionType.TASK_MARK_OVERDUE:
    case AutomationActionType.TASK_NOTIFY_DUE_SOON:
    case AutomationActionType.TASK_ALERT_UNASSIGNED:
      return 'create_task';
    case AutomationActionType.JOURNEY_REGISTER_EVENT:
    case AutomationActionType.TRACK_ALERT_STALLED:
    case AutomationActionType.TRACK_MARK_STAGNATED:
    case AutomationActionType.TRAINING_ALERT_PENDING:
      return 'write_timeline_entry';
    default:
      return null;
  }
}

export function buildAutomationDedupeKey(input: {
  strategy: AutomationDedupeStrategy;
  ruleId: string;
  churchId: string;
  triggerKey: string;
  sourceRefId?: string | null;
  servantId?: string | null;
  ministryId?: string | null;
  windowBucket?: string | null;
}) {
  if (input.strategy === AutomationDedupeStrategy.BY_ENTITY_WINDOW) {
    return [
      input.triggerKey,
      input.ruleId,
      input.churchId,
      input.servantId ?? input.ministryId ?? 'entity',
      input.windowBucket ?? 'bucket',
    ].join(':');
  }

  if (input.strategy === AutomationDedupeStrategy.CUSTOM) {
    return [
      input.triggerKey,
      input.ruleId,
      input.churchId,
      input.sourceRefId ?? input.servantId ?? input.ministryId ?? 'custom',
      input.windowBucket ?? new Date().toISOString().slice(0, 13),
    ].join(':');
  }

  return [
    input.triggerKey,
    input.ruleId,
    input.churchId,
    input.sourceRefId ?? input.servantId ?? input.ministryId ?? 'event',
  ].join(':');
}

export function shouldSkipByCooldown(lastRunAt: Date | null | undefined, cooldownMinutes: number | null | undefined) {
  if (!lastRunAt || !cooldownMinutes || cooldownMinutes <= 0) {
    return false;
  }
  return Date.now() - lastRunAt.getTime() < cooldownMinutes * 60 * 1000;
}

export function mapExecutionStatus(successCount: number, failedCount: number): AutomationExecutionStatus {
  if (successCount > 0 && failedCount > 0) {
    return AutomationExecutionStatus.PARTIAL_SUCCESS;
  }
  if (failedCount > 0) {
    return AutomationExecutionStatus.FAILED;
  }
  return AutomationExecutionStatus.SUCCESS;
}

export function resolveSourceModule(triggerKey: string): AutomationSourceModule {
  if (triggerKey.startsWith('attendance.')) return AutomationSourceModule.ATTENDANCE;
  if (triggerKey.startsWith('schedule.')) return AutomationSourceModule.SCHEDULE;
  if (triggerKey.startsWith('journey.')) return AutomationSourceModule.JOURNEY;
  if (triggerKey.startsWith('pastoral.')) return AutomationSourceModule.PASTORAL;
  if (triggerKey.startsWith('task.')) return AutomationSourceModule.TASK;
  if (triggerKey.startsWith('threshold.')) return AutomationSourceModule.ANALYTICS;
  return AutomationSourceModule.SYSTEM;
}

export function normalizeConditionKeys(config: unknown): AutomationConditionKey[] {
  if (!config || typeof config !== 'object') return [];
  const node = config as { operator?: string; children?: unknown[]; condition?: string };
  const found: string[] = [];
  const walk = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const current = item as { condition?: string; operator?: string; children?: unknown[] };
    if (typeof current.condition === 'string') found.push(current.condition);
    if (typeof current.operator === 'string') found.push(current.operator.toLowerCase());
    if (Array.isArray(current.children)) current.children.forEach(walk);
  };
  walk(node);
  return found.filter((key): key is AutomationConditionKey =>
    (AUTOMATION_CONDITION_CATALOG as readonly string[]).includes(key),
  );
}

export function normalizeActionKeys(config: unknown): AutomationActionKey[] {
  if (!Array.isArray(config)) return [];
  return config
    .map((item) => (item && typeof item === 'object' ? (item as { action?: string }).action : undefined))
    .filter((key): key is AutomationActionKey =>
      Boolean(key) && (AUTOMATION_ACTION_CATALOG as readonly string[]).includes(key as string),
    );
}

export function isTriggerAllowed(key: string): key is AutomationTriggerKey {
  return isAutomationTriggerKey(key);
}
