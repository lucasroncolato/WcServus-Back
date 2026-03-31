import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TimelineService } from './timeline.service';

describe('TimelineService', () => {
  const prisma = {
    timelineEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    ministry: {
      findFirst: jest.fn(),
    },
    servant: {
      findFirst: jest.fn(),
    },
  } as any;

  let service: TimelineService;

  const admin = {
    sub: 'u1',
    email: 'admin@test.com',
    role: Role.ADMIN,
    churchId: 'church-1',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.timelineEntry.findMany.mockResolvedValue([]);
    prisma.timelineEntry.findFirst.mockResolvedValue(null);
    prisma.timelineEntry.groupBy.mockResolvedValue([]);
    prisma.timelineEntry.count.mockResolvedValue(0);
    service = new TimelineService(prisma);
  });

  it('lists timeline with cursor envelope', async () => {
    prisma.timelineEntry.findMany.mockResolvedValueOnce([
      {
        id: 'e1',
        category: 'SCHEDULE',
        eventType: 'TIMELINE_SCHEDULE_ASSIGNED',
        severity: 'INFO',
        title: 'x',
        message: 'y',
        actorType: 'USER',
        actorUserId: 'u1',
        actorName: null,
        subjectType: 'SLOT',
        subjectId: 'slot-1',
        relatedEntityType: null,
        relatedEntityId: null,
        metadata: {},
        occurredAt: new Date('2026-03-31T10:00:00.000Z'),
        createdAt: new Date('2026-03-31T10:00:00.000Z'),
        actorUser: { id: 'u1', name: 'Admin' },
      },
    ]);

    const result = await service.list(admin, { limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.pageInfo.hasMore).toBe(false);
  });

  it('returns summary grouped by category and severity', async () => {
    prisma.timelineEntry.groupBy
      .mockResolvedValueOnce([{ category: 'SCHEDULE', _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ severity: 'WARNING', _count: { _all: 1 } }]);
    prisma.timelineEntry.findMany.mockResolvedValueOnce([]);
    prisma.timelineEntry.count.mockResolvedValueOnce(3);

    const result = await service.summary(admin, {});

    expect(result.totals.events).toBe(3);
    expect(result.byCategory[0]).toEqual({ category: 'SCHEDULE', count: 3 });
    expect(result.bySeverity[0]).toEqual({ severity: 'WARNING', count: 1 });
  });

  it('denies administrative timeline for servo role', async () => {
    await expect(
      service.list(
        {
          sub: 'servo',
          email: 'servo@test.com',
          role: Role.SERVO,
          churchId: 'church-1',
        } as any,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
