import { AttendanceStatus, Role, ScheduleResponseStatus } from '@prisma/client';
import { PastoralAlertEngineService } from './pastoral-alert-engine.service';

describe('PastoralAlertEngineService', () => {
  const prisma = {
    pastoralAlert: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    pastoralFollowUp: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    pastoralVisit: {
      findFirst: jest.fn(),
    },
    church: {
      findMany: jest.fn(),
    },
    servant: {
      findMany: jest.fn(),
    },
    attendance: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    schedule: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    journeyIndicatorSnapshot: {
      findUnique: jest.fn(),
    },
  } as any;

  const auditService = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const eventBus = { on: jest.fn() } as any;
  const metrics = { incrementCounter: jest.fn(), recordJob: jest.fn() } as any;
  const logService = { event: jest.fn(), error: jest.fn() } as any;

  let service: PastoralAlertEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.pastoralAlert.findFirst.mockReset().mockResolvedValue(null);
    prisma.pastoralAlert.create.mockReset().mockResolvedValue({ id: 'alert-1' });
    prisma.pastoralVisit.findFirst.mockReset().mockResolvedValue(null);
    prisma.pastoralFollowUp.findFirst.mockReset().mockResolvedValue(null);
    prisma.pastoralFollowUp.create.mockReset().mockResolvedValue({ id: 'fu-1' });
    prisma.church.findMany.mockReset().mockResolvedValue([]);
    prisma.servant.findMany.mockReset().mockResolvedValue([]);
    prisma.attendance.count.mockReset().mockResolvedValue(0);
    prisma.attendance.findFirst.mockReset().mockResolvedValue({ createdAt: new Date() });
    prisma.schedule.count.mockReset().mockResolvedValue(0);
    prisma.schedule.findMany.mockReset().mockResolvedValue([]);
    prisma.journeyIndicatorSnapshot.findUnique.mockReset().mockResolvedValue(null);

    service = new PastoralAlertEngineService(prisma, auditService, eventBus, metrics, logService);
  });

  it('creates NO_SHOW immediate alert from attendance signal', async () => {
    const result = await service.evaluateAttendanceSignal({
      churchId: 'church-1',
      servantId: 'serv-1',
      serviceId: 'service-1',
      attendanceId: 'att-1',
      status: AttendanceStatus.NO_SHOW,
      actorUserId: 'admin-1',
    });

    expect(result.created).toBe(true);
    expect(prisma.pastoralAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alertType: 'NO_SHOW_IMMEDIATE',
          source: 'ATTENDANCE',
          severity: 'HIGH',
          dedupeKey: 'attendance:no_show:church-1:serv-1:service-1',
        }),
      }),
    );
  });

  it('deduplicates when open alert with same dedupeKey already exists', async () => {
    prisma.pastoralAlert.findFirst.mockResolvedValueOnce({ id: 'open-1' });

    const result = await service.createAlertIfNeeded({
      churchId: 'church-1',
      servantId: 'serv-1',
      alertType: 'NO_SHOW_IMMEDIATE',
      dedupeKey: 'attendance:no_show:church-1:serv-1:service-1',
    });

    expect(result.created).toBe(false);
    expect(result.reason).toBe('open_duplicate');
    expect(prisma.pastoralAlert.create).not.toHaveBeenCalled();
  });

  it('respects reopen policy for RETURN_AFTER_GAP when resolved duplicate exists', async () => {
    prisma.pastoralAlert.findFirst
      .mockResolvedValueOnce(null) // open duplicate
      .mockResolvedValueOnce({ id: 'resolved-1' }); // resolved duplicate

    const result = await service.createAlertIfNeeded({
      churchId: 'church-1',
      servantId: 'serv-1',
      alertType: 'RETURN_AFTER_GAP',
      dedupeKey: 'journey:return_after_gap:church-1:serv-1:30:2026-04-01',
    });

    expect(result.created).toBe(false);
    expect(result.reason).toBe('resolved_policy_skip');
    expect(prisma.pastoralAlert.create).not.toHaveBeenCalled();
  });

  it('creates repeated decline alert from schedule signal', async () => {
    const result = await service.evaluateScheduleSignal({
      churchId: 'church-1',
      servantId: 'serv-1',
      scheduleId: 'sched-1',
      slotId: 'slot-1',
      responseStatus: ScheduleResponseStatus.DECLINED,
      actorUserId: 'coord-1',
    });

    expect(result.created).toBe(true);
    expect(prisma.pastoralAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alertType: 'REPEATED_DECLINE',
          source: 'SCHEDULE',
          sourceRefId: 'slot-1',
        }),
      }),
    );
  });

  it('runs recurring rules and returns processing summary', async () => {
    prisma.church.findMany.mockResolvedValue([{ id: 'church-1' }]);
    prisma.servant.findMany.mockResolvedValue([{ id: 'serv-1', churchId: 'church-1' }]);
    prisma.attendance.count
      .mockResolvedValueOnce(3) // recurrent absence
      .mockResolvedValueOnce(3) // recurrent late
      .mockResolvedValueOnce(4); // excused pattern
    prisma.attendance.findFirst.mockResolvedValueOnce(null); // inactivity
    prisma.schedule.count.mockResolvedValueOnce(3); // repeated decline
    prisma.schedule.findMany.mockResolvedValueOnce([{ id: 'sched-pending-1' }]); // no response
    prisma.journeyIndicatorSnapshot.findUnique.mockResolvedValueOnce({
      constancyScore: 20,
      readinessScore: 15,
    });

    const result = await service.runRecurringRules({
      churchId: 'church-1',
      now: new Date('2026-04-01T00:00:00.000Z'),
    });

    expect(result.analyzed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.created).toBeGreaterThan(0);
    expect(prisma.pastoralAlert.create).toHaveBeenCalled();
  });
});
