import { PastoralAlertSchedulerService } from './pastoral-alert-scheduler.service';

describe('PastoralAlertSchedulerService', () => {
  const engine = {
    runRecurringRules: jest.fn(),
  } as any;

  const logService = {
    event: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  } as any;

  const metricsService = {
    recordJob: jest.fn(),
    incrementCounter: jest.fn(),
  } as any;

  let service: PastoralAlertSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    engine.runRecurringRules.mockReset();
    service = new PastoralAlertSchedulerService(engine, logService, metricsService);
  });

  it('runs recurring job and records metrics summary', async () => {
    engine.runRecurringRules.mockResolvedValue({
      analyzed: 10,
      created: 3,
      deduped: 5,
      failed: 2,
    });

    const result = await service.runNow('church-1');

    expect(engine.runRecurringRules).toHaveBeenCalledWith({ churchId: 'church-1' });
    expect(result).toEqual(
      expect.objectContaining({
        analyzed: 10,
        created: 3,
        deduped: 5,
        failed: 2,
        skipped: false,
      }),
    );
    expect(metricsService.incrementCounter).toHaveBeenCalledWith('pastoral.alerts.scheduler.created', 3);
  });

  it('returns failure summary when job throws', async () => {
    engine.runRecurringRules.mockRejectedValue(new Error('boom'));

    const result = await service.runNow();

    expect(result).toEqual(
      expect.objectContaining({
        analyzed: 0,
        created: 0,
        deduped: 0,
        failed: 1,
        skipped: false,
      }),
    );
    expect(logService.error).toHaveBeenCalled();
  });
});
