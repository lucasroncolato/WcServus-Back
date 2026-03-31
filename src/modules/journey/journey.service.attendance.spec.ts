import { JourneyProjectorService } from './journey-projector.service';

describe('JourneyProjectorService', () => {
  const handlers = new Map<string, (event: any) => Promise<void>>();

  const eventBus = {
    on: jest.fn((name: string, handler: (event: any) => Promise<void>) => {
      handlers.set(name, handler);
    }),
  } as any;

  const journeyService = {
    registerJourneyEvent: jest.fn().mockResolvedValue({ id: 'log-1' }),
  } as any;

  const prisma = {
    ministryTaskOccurrence: { findUnique: jest.fn() },
  } as any;

  const checkpointService = {
    wasLastEventProcessed: jest.fn().mockResolvedValue(false),
    markProcessed: jest.fn().mockResolvedValue({ id: 'cp-1' }),
  } as any;

  const metrics = {
    recordJob: jest.fn(),
    incrementCounter: jest.fn(),
  } as any;

  const logService = {
    event: jest.fn(),
    error: jest.fn(),
  } as any;

  let service: JourneyProjectorService;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.clear();
    prisma.ministryTaskOccurrence.findUnique.mockResolvedValue({ id: 'occ-1', assignedServantId: 'servant-1' });
    service = new JourneyProjectorService(
      eventBus,
      journeyService,
      prisma,
      checkpointService,
      metrics,
      logService,
    );
    service.onModuleInit();
  });

  it('projects ATTENDANCE_REGISTERED into journey log', async () => {
    const handler = handlers.get('ATTENDANCE_REGISTERED');
    expect(handler).toBeDefined();

    await handler?.({
      name: 'ATTENDANCE_REGISTERED',
      payload: { status: 'LATE', servantId: 'servant-1', attendanceId: 'att-1' },
      churchId: 'church-1',
      occurredAt: new Date('2026-04-01T10:00:00.000Z'),
    });

    expect(journeyService.registerJourneyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        servantId: 'servant-1',
        referenceId: 'attendance:att-1',
      }),
    );
    expect(checkpointService.markProcessed).toHaveBeenCalled();
  });

  it('skips duplicated event by checkpoint eventKey', async () => {
    checkpointService.wasLastEventProcessed.mockResolvedValueOnce(true);
    const handler = handlers.get('SLOT_CONFIRMED');

    await handler?.({
      name: 'SLOT_CONFIRMED',
      payload: { servantId: 'servant-1', slotId: 'slot-1' },
      churchId: 'church-1',
      occurredAt: new Date(),
    });

    expect(journeyService.registerJourneyEvent).not.toHaveBeenCalled();
    expect(metrics.incrementCounter).toHaveBeenCalledWith('journey.projector.duplicate_skipped', 1);
  });
});
