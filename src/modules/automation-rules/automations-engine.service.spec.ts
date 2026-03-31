import {
  AutomationDedupeStrategy,
  AutomationExecutionStatus,
  AutomationRuleSeverity,
  AutomationTriggerType,
} from '@prisma/client';
import { AutomationsEngineService } from './automations-engine.service';

describe('AutomationsEngineService', () => {
  const prisma = {
    automationRule: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    automationExecutionLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    pastoralVisit: { count: jest.fn() },
    churchModule: { findFirst: jest.fn() },
    pastoralAlert: { count: jest.fn() },
    pastoralFollowUp: { count: jest.fn() },
    user: { findFirst: jest.fn() },
  } as any;

  const registry = {
    execute: jest.fn(),
  } as any;

  const metrics = {
    incrementCounter: jest.fn(),
    observeHistogram: jest.fn(),
  } as any;

  const logService = {
    event: jest.fn(),
  } as any;

  const timelinePublisher = {
    publish: jest.fn().mockResolvedValue({ published: true }),
  } as any;

  let service: AutomationsEngineService;

  const baseRule = {
    id: 'rule-1',
    churchId: 'church-1',
    name: 'Rule',
    triggerType: AutomationTriggerType.EVENT,
    triggerKey: 'attendance.recorded',
    triggerConfig: null,
    conditionConfig: null,
    actionConfig: [{ action: 'write_timeline_entry' }],
    cooldownMinutes: 0,
    dedupeStrategy: AutomationDedupeStrategy.BY_EVENT,
    severity: AutomationRuleSeverity.MEDIUM,
    enabled: true,
    lastRunAt: null,
    deletedAt: null,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.automationRule.findMany.mockResolvedValue([]);
    prisma.automationExecutionLog.findFirst.mockResolvedValue(null);
    prisma.automationExecutionLog.create.mockResolvedValue({ id: 'log-1' });
    prisma.automationRule.update.mockResolvedValue(undefined);
    registry.execute.mockResolvedValue({
      action: 'write_timeline_entry',
      success: true,
      processed: 1,
      message: 'ok',
    });

    service = new AutomationsEngineService(prisma, registry, metrics, logService, timelinePublisher);
  });

  it('handles event trigger and executes matched rule', async () => {
    prisma.automationRule.findMany.mockResolvedValue([baseRule]);

    const summary = await service.handleEventTrigger({
      churchId: 'church-1',
      triggerKey: 'attendance.recorded',
      payload: { servantId: 'serv-1' },
      sourceRefId: 'att-1',
    });

    expect(summary.checked).toBe(1);
    expect(summary.success).toBe(1);
    expect(registry.execute).toHaveBeenCalledTimes(1);
  });

  it('skips execution by cooldown', async () => {
    const cooldownRule = {
      ...baseRule,
      cooldownMinutes: 10,
      lastRunAt: new Date(),
    };

    const result = await service.executeRule(cooldownRule, {
      churchId: 'church-1',
      payload: { servantId: 'serv-1' },
      sourceRefId: 'att-1',
    });

    expect(result.status).toBe(AutomationExecutionStatus.SKIPPED);
    expect((result as any).skipReason).toBe('COOLDOWN');
    expect(registry.execute).not.toHaveBeenCalled();
  });

  it('skips execution by dedupe when previous execution exists', async () => {
    prisma.automationExecutionLog.findFirst.mockResolvedValueOnce({ id: 'existing' });

    const result = await service.executeRule(baseRule, {
      churchId: 'church-1',
      payload: { servantId: 'serv-1' },
      sourceRefId: 'att-1',
    });

    expect(result.status).toBe(AutomationExecutionStatus.SKIPPED);
    expect((result as any).skipReason).toBe('DEDUPE');
    expect(registry.execute).not.toHaveBeenCalled();
  });

  it('returns partial success when one action fails', async () => {
    const rule = {
      ...baseRule,
      actionConfig: [{ action: 'write_timeline_entry' }, { action: 'notify_leader' }],
    };

    registry.execute
      .mockResolvedValueOnce({ action: 'write_timeline_entry', success: true, processed: 1, message: 'ok' })
      .mockResolvedValueOnce({ action: 'notify_leader', success: false, processed: 0, message: 'failed' });

    const result = await service.executeRule(rule, {
      churchId: 'church-1',
      payload: { servantId: 'serv-1' },
      sourceRefId: 'att-1',
    });

    expect(result.status).toBe(AutomationExecutionStatus.PARTIAL_SUCCESS);
    expect(result.processed).toBe(1);
  });
});
