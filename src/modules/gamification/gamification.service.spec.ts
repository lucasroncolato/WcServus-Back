import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GamificationService } from './gamification.service';

describe('GamificationService', () => {
  function createService() {
    const prisma = {
      servantPointLog: { groupBy: jest.fn() },
      servant: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      user: { findUnique: jest.fn() },
      attendance: { count: jest.fn() },
      ministryTaskOccurrence: { count: jest.fn(), groupBy: jest.fn() },
      servantGamificationProfile: { aggregate: jest.fn(), findUnique: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      servantGrowthProgress: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      ministry: { findMany: jest.fn() },
      achievement: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      servantAchievement: { count: jest.fn(), findMany: jest.fn() },
      pointRule: { findFirst: jest.fn() },
    } as any;
    const auditService = { log: jest.fn() } as any;
    const eventBus = { emit: jest.fn() } as any;
    const service = new GamificationService(prisma, auditService, eventBus);
    return { service, prisma };
  }

  it('builds points ranking by metric with sorted positions', async () => {
    const { service, prisma } = createService();
    prisma.servantPointLog.groupBy.mockResolvedValue([
      { servantId: 's2', _sum: { points: 30 } },
      { servantId: 's1', _sum: { points: 80 } },
    ]);
    prisma.servant.findMany.mockResolvedValue([
      { id: 's1', name: 'Servo 1' },
      { id: 's2', name: 'Servo 2' },
    ]);
    prisma.user.findUnique.mockResolvedValue({ servantId: 's2' });

    const result = await service.rankingByMetric(
      'points',
      { limit: 10 },
      { sub: 'u1', role: Role.ADMIN, churchId: 'church-1', servantId: null } as any,
    );

    expect(result.metric).toBe('points');
    expect(result.data[0]).toMatchObject({ servantId: 's1', value: 80, position: 1 });
    expect(result.data[1]).toMatchObject({ servantId: 's2', value: 30, position: 2 });
    expect(result.myPosition).toMatchObject({ servantId: 's2', position: 2, value: 30 });
  });

  it('returns analytics church with calculated attendance and retention rates', async () => {
    const { service, prisma } = createService();
    prisma.servant.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    prisma.attendance.count
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(20);
    prisma.ministryTaskOccurrence.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(5);
    prisma.ministryTaskOccurrence.groupBy.mockResolvedValue([{ ministryId: 'm1', _count: { _all: 12 } }]);
    prisma.servantGamificationProfile.aggregate.mockResolvedValue({
      _avg: { totalPoints: 220, currentLevelOrder: 3 },
    });
    prisma.servantGrowthProgress.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    prisma.ministry.findMany.mockResolvedValue([{ id: 'm1', name: 'Louvor' }]);

    const result = await service.analyticsChurch({ sub: 'u1', role: Role.ADMIN, churchId: 'church-1' } as any, {});
    expect(result.totalActiveServants).toBe(10);
    expect(result.totalInactiveServants).toBe(2);
    expect(result.attendanceRate).toBe(80);
    expect(result.retentionRate).toBeCloseTo(83.33, 1);
    expect(result.tasksByMinistry[0]).toMatchObject({ ministryId: 'm1', total: 12 });
  });

  it('blocks analytics me when user is not linked to servant', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ servantId: null });

    await expect(
      service.analyticsMe({ sub: 'u1', role: Role.SERVO, churchId: 'church-1', servantId: null } as any, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
