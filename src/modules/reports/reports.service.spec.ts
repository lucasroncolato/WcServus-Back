import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';

jest.mock('src/common/auth/access-scope', () => ({
  getServantAccessWhere: jest.fn().mockResolvedValue(undefined),
}));

describe('ReportsService', () => {
  const prisma = {
    schedule: { groupBy: jest.fn() },
    attendance: { groupBy: jest.fn(), findMany: jest.fn() },
    servant: { findMany: jest.fn() },
    worshipService: { findMany: jest.fn() },
    pastoralVisit: { findMany: jest.fn() },
    talent: { findMany: jest.fn() },
    ministry: { findMany: jest.fn() },
  } as any;
  const cacheService = { getOrSet: jest.fn((_k: string, factory: () => Promise<unknown>) => factory()) } as any;

  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(prisma, cacheService);
  });

  it('counts LATE as presence in attendance report', async () => {
    prisma.worshipService.findMany.mockResolvedValue([
      { id: 'service-1', title: 'Domingo', serviceDate: new Date('2026-04-01T00:00:00.000Z') },
    ]);
    prisma.attendance.groupBy.mockResolvedValue([
      { serviceId: 'service-1', status: 'LATE', _count: { _all: 2 } },
      { serviceId: 'service-1', status: 'NO_SHOW', _count: { _all: 1 } },
    ]);

    const result = await service.attendanceReport(
      { startDate: '2026-04-01', endDate: '2026-04-30' },
      { sub: 'admin-1', role: Role.ADMIN, email: 'admin@test.com', churchId: 'church-1', servantId: null },
    );

    expect(result[0].presentes).toBe(2);
    expect(result[0].faltas).toBe(1);
  });
});
