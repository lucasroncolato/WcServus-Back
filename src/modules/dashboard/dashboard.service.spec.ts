import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';

jest.mock('src/common/auth/access-scope', () => ({
  getServantAccessWhere: jest.fn().mockResolvedValue(undefined),
  getAttendanceAccessWhere: jest.fn().mockResolvedValue(undefined),
  getPastoralVisitAccessWhere: jest.fn().mockResolvedValue(undefined),
  getMinistryAccessWhere: jest.fn().mockResolvedValue(undefined),
}));

describe('DashboardService', () => {
  const prisma = {
    servant: { count: jest.fn() },
    attendance: { count: jest.fn() },
    pastoralVisit: { count: jest.fn() },
    ministry: { findMany: jest.fn() },
    pastoralAlert: { findMany: jest.fn() },
    ministryTaskOccurrence: { count: jest.fn() },
    worshipService: { count: jest.fn() },
    servantGrowthProgress: { count: jest.fn() },
    user: { count: jest.fn() },
  } as any;
  const cacheService = { getOrSet: jest.fn((_k: string, factory: () => Promise<unknown>) => factory()) } as any;
  const metricsService = { setGauge: jest.fn() } as any;

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(prisma, cacheService, metricsService);
    prisma.servant.count.mockResolvedValue(10);
    prisma.attendance.count.mockResolvedValue(5);
    prisma.pastoralVisit.count.mockResolvedValue(2);
    prisma.ministry.findMany.mockResolvedValue([]);
    prisma.pastoralAlert.findMany.mockResolvedValue([]);
  });

  it('uses expanded attendance status sets in summary queries', async () => {
    await service.summary({
      sub: 'user-1',
      role: Role.ADMIN,
      email: 'admin@test.com',
      churchId: 'church-1',
      servantId: null,
    });

    const calls = prisma.attendance.count.mock.calls.map((call: any[]) => call[0]);
    const absenceCall = calls.find((item: any) => item?.where?.status?.in?.includes?.('NO_SHOW'));
    const presenceCall = calls.find((item: any) => item?.where?.status?.in?.includes?.('LATE'));

    expect(absenceCall).toBeTruthy();
    expect(presenceCall).toBeTruthy();
  });
});
