import { AutomationTriggerType } from '@prisma/client';
import { AutomationsSchedulerService } from './automations-scheduler.service';

describe('AutomationsSchedulerService', () => {
  const prisma = {
    automationRule: {
      findMany: jest.fn(),
    },
    attendance: {
      findMany: jest.fn(),
    },
    scheduleSlot: {
      findMany: jest.fn(),
    },
    pastoralFollowUp: {
      findMany: jest.fn(),
    },
  } as any;

  const engine = {
    executeRule: jest.fn(),
  } as any;

  const checkpoint = {
    markStarted: jest.fn(),
    markSuccess: jest.fn(),
    markFailure: jest.fn(),
  } as any;

  const metrics = {
    incrementCounter: jest.fn(),
    recordJob: jest.fn(),
  } as any;

  const logService = {
    event: jest.fn(),
  } as any;

  let service: AutomationsSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.automationRule.findMany.mockResolvedValue([]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.scheduleSlot.findMany.mockResolvedValue([]);
    prisma.pastoralFollowUp.findMany.mockResolvedValue([]);
    engine.executeRule.mockResolvedValue({ status: 'SUCCESS' });

    service = new AutomationsSchedulerService(prisma, engine, checkpoint, metrics, logService);
  });

  it('respects overlap protection', async () => {
    prisma.automationRule.findMany.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
    );

    const first = service.runOnce();
    const second = await service.runOnce();
    await first;

    expect((second as any).overlapSkipped).toBe(true);
    expect(second.reason).toBe('overlap');
  });

  it('runs time rules and forwards to engine', async () => {
    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        churchId: 'church-1',
        triggerType: AutomationTriggerType.TIME,
        triggerKey: 'daily',
        triggerConfig: null,
        lastRunAt: null,
        enabled: true,
        deletedAt: null,
      },
    ]);

    const result = await service.runOnce();

    expect((result as any).executed).toBe(1);
    expect(engine.executeRule).toHaveBeenCalledTimes(1);
  });

  it('runs threshold absence and dispatches per servant', async () => {
    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-threshold',
        churchId: 'church-1',
        triggerType: AutomationTriggerType.THRESHOLD,
        triggerKey: 'threshold.absence_count',
        triggerConfig: { threshold: 2, windowDays: 30 },
        lastRunAt: null,
        enabled: true,
        deletedAt: null,
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      { id: 'a1', servantId: 'serv-1' },
      { id: 'a2', servantId: 'serv-1' },
      { id: 'a3', servantId: 'serv-2' },
    ]);

    const result = await service.runOnce();

    expect((result as any).executed).toBe(1);
    expect(engine.executeRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rule-threshold' }),
      expect.objectContaining({
        payload: expect.objectContaining({ servantId: 'serv-1', absenceCount: 2 }),
      }),
    );
  });
});
