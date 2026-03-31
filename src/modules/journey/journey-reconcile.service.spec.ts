import { JourneyReconcileService } from './journey-reconcile.service';

describe('JourneyReconcileService', () => {
  const prisma = {
    servant: {
      findMany: jest.fn(),
    },
  } as any;

  const journeyService = {
    refreshJourneyProjection: jest.fn(),
  } as any;

  const checkpointService = {
    markReconciled: jest.fn(),
    statusSummary: jest.fn().mockResolvedValue({ ok: 1, warning: 0, error: 0 }),
  } as any;

  const metrics = {
    recordJob: jest.fn(),
    incrementCounter: jest.fn(),
  } as any;

  const logService = {
    event: jest.fn(),
    error: jest.fn(),
  } as any;

  let service: JourneyReconcileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JourneyReconcileService(
      prisma,
      journeyService,
      checkpointService,
      metrics,
      logService,
    );
  });

  it('rebuilds single servant journey', async () => {
    journeyService.refreshJourneyProjection.mockResolvedValue(undefined);
    checkpointService.markReconciled.mockResolvedValue(undefined);

    const result = await service.rebuildJourneyForServant('servant-1', 'church-1');

    expect(journeyService.refreshJourneyProjection).toHaveBeenCalledWith('servant-1', 'church-1');
    expect(checkpointService.markReconciled).toHaveBeenCalled();
    expect(result.servantId).toBe('servant-1');
  });

  it('runs daily reconcile and records failures without aborting batch', async () => {
    prisma.servant.findMany.mockResolvedValue([
      { id: 'servant-1', churchId: 'church-1' },
      { id: 'servant-2', churchId: 'church-1' },
    ]);
    journeyService.refreshJourneyProjection
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));

    const result = await service.reconcileDaily();

    expect(result.stale).toBe(2);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(metrics.recordJob).toHaveBeenCalledWith(
      'journey_reconcile_daily',
      expect.any(Number),
      false,
      expect.objectContaining({ processedItems: 2 }),
    );
  });
});

