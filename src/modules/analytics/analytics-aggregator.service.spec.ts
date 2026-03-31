import { AttendanceStatus, ScheduleResponseStatus } from '@prisma/client';
import { AnalyticsAggregatorService } from './analytics-aggregator.service';

describe('AnalyticsAggregatorService', () => {
  const prisma = {
    worshipService: { count: jest.fn() },
    scheduleSlot: { count: jest.fn() },
    attendance: { groupBy: jest.fn(), findMany: jest.fn() },
    schedule: { groupBy: jest.fn() },
    pastoralAlert: { count: jest.fn(), groupBy: jest.fn() },
    pastoralFollowUp: { count: jest.fn() },
    pastoralVisit: { count: jest.fn(), findMany: jest.fn() },
    journeyIndicatorSnapshot: { aggregate: jest.fn(), findUnique: jest.fn() },
    servant: { findMany: jest.fn() },
    servantMinistry: { count: jest.fn(), findMany: jest.fn() },
    timelineEntry: { groupBy: jest.fn() },
  } as any;

  let service: AnalyticsAggregatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsAggregatorService(prisma);

    prisma.worshipService.count.mockResolvedValue(4);
    prisma.scheduleSlot.count.mockResolvedValue(0);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.schedule.groupBy.mockResolvedValue([]);
    prisma.pastoralAlert.count.mockResolvedValue(0);
    prisma.pastoralFollowUp.count.mockResolvedValue(0);
    prisma.journeyIndicatorSnapshot.aggregate.mockResolvedValue({ _avg: { constancyScore: 0, readinessScore: 0 } });
  });

  it('computes presence/no-show rates using ATTENDANCE_POLICY helpers', async () => {
    prisma.attendance.groupBy.mockResolvedValueOnce([
      { status: AttendanceStatus.PRESENTE, _count: { _all: 3 } },
      { status: AttendanceStatus.LATE, _count: { _all: 1 } },
      { status: AttendanceStatus.NO_SHOW, _count: { _all: 1 } },
      { status: AttendanceStatus.UNKNOWN, _count: { _all: 2 } },
      { status: AttendanceStatus.CANCELLED_SERVICE, _count: { _all: 2 } },
    ]);

    prisma.schedule.groupBy.mockResolvedValueOnce([
      { responseStatus: ScheduleResponseStatus.CONFIRMED, _count: { _all: 4 } },
      { responseStatus: ScheduleResponseStatus.DECLINED, _count: { _all: 2 } },
    ]);
    prisma.scheduleSlot.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8).mockResolvedValueOnce(2);

    const result = await service.churchSummary(
      'church-1',
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.000Z'),
      '30d',
    );

    expect(result.summary.attendancePresentRate).toBe(80);
    expect(result.summary.attendanceNoShowRate).toBe(20);
    expect(result.meta.dataQualityWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('UNKNOWN(2)'),
        expect.stringContaining('CANCELLED_SERVICE(2)'),
      ]),
    );
  });

  it('returns timeline envelope with totals', async () => {
    prisma.timelineEntry.groupBy.mockResolvedValueOnce([
      { type: 'SERVICE_COMPLETED', _count: { _all: 2 } },
      { type: 'TASK_COMPLETED', _count: { _all: 1 } },
    ]);

    const result = await service.timelineSummary(
      'church-1',
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.000Z'),
      '30d',
    );

    expect(result.view).toBe('timeline');
    expect(result.summary.eventsTotal).toBe(3);
    expect(Array.isArray((result.breakdowns as any).totals)).toBe(true);
  });
});
