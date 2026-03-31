import { TimelinePublisherService } from './timeline-publisher.service';

describe('TimelinePublisherService', () => {
  const prisma = {
    timelineEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const metrics = {
    incrementCounter: jest.fn(),
  } as any;

  const logService = {
    event: jest.fn(),
  } as any;

  let service: TimelinePublisherService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.timelineEntry.findFirst.mockResolvedValue(null);
    prisma.timelineEntry.create.mockResolvedValue({ id: 'entry-1', category: 'SCHEDULE', severity: 'INFO' });
    prisma.timelineEntry.update.mockResolvedValue({ id: 'entry-1' });
    service = new TimelinePublisherService(prisma, metrics, logService);
  });

  it('publishes a supported timeline event', async () => {
    const result = await service.publish({
      churchId: 'church-1',
      eventType: 'TIMELINE_SCHEDULE_ASSIGNED',
      subjectType: 'SLOT',
      subjectId: 'slot-1',
    });

    expect(result.published).toBe(true);
    expect(prisma.timelineEntry.create).toHaveBeenCalled();
  });

  it('skips duplicate non-aggregatable event', async () => {
    prisma.timelineEntry.findFirst.mockResolvedValueOnce({
      id: 'existing-1',
      occurredAt: new Date(),
      metadata: {},
    });

    const result = await service.publish({
      churchId: 'church-1',
      eventType: 'TIMELINE_SCHEDULE_DECLINED',
      dedupeKey: 'dup-1',
    });

    expect(result.published).toBe(false);
    expect(result.reason).toBe('dedupe');
    expect(prisma.timelineEntry.create).not.toHaveBeenCalled();
  });

  it('aggregates deduped automation event inside window', async () => {
    prisma.timelineEntry.findFirst.mockResolvedValueOnce({
      id: 'existing-2',
      occurredAt: new Date(),
      metadata: { aggregatedCount: 2 },
    });

    const result = await service.publish({
      churchId: 'church-1',
      eventType: 'TIMELINE_AUTOMATION_RULE_EXECUTED',
      dedupeKey: 'agg-1',
      occurredAt: new Date(),
    });

    expect(result.published).toBe(true);
    expect(result.aggregated).toBe(true);
    expect(prisma.timelineEntry.update).toHaveBeenCalled();
  });
});
