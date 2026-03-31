import { ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, Role, ScheduleSlotStatus } from '@prisma/client';
import { resolveScopedMinistryIds } from 'src/common/auth/access-scope';
import { AttendancesService } from './attendances.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

jest.mock('src/common/auth/access-scope', () => ({
  assertServantAccess: jest.fn().mockResolvedValue(undefined),
  getAttendanceAccessWhere: jest.fn().mockResolvedValue(undefined),
  resolveScopedMinistryIds: jest.fn().mockResolvedValue([]),
}));

describe('AttendancesService', () => {
  const prisma = {
    worshipService: { findUnique: jest.fn() },
    scheduleSlot: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    attendance: { findMany: jest.fn(), upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    servant: { findUnique: jest.fn(), update: jest.fn() },
    pastoralAlert: { findFirst: jest.fn(), create: jest.fn() },
  } as any;

  const auditService = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const notificationsService = { notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined) } as any;
  const eventBus = { emit: jest.fn().mockResolvedValue(undefined) } as any;
  const pastoralAlertEngine = { evaluateAttendanceSignal: jest.fn().mockResolvedValue(undefined) } as any;

  const adminActor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: Role.ADMIN,
    churchId: 'church-1',
    servantId: null,
  };

  let service: AttendancesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.worshipService.findUnique.mockReset();
    prisma.scheduleSlot.findMany.mockReset();
    prisma.scheduleSlot.findFirst.mockReset();
    prisma.scheduleSlot.updateMany.mockReset().mockResolvedValue({ count: 1 });
    prisma.attendance.findMany.mockReset();
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.upsert.mockReset();
    prisma.attendance.count.mockReset().mockResolvedValue(0);
    prisma.servant.findUnique.mockReset();
    prisma.servant.update.mockReset().mockResolvedValue(undefined);
    prisma.pastoralAlert.findFirst.mockReset().mockResolvedValue(null);
    prisma.pastoralAlert.create.mockReset().mockResolvedValue(undefined);
    pastoralAlertEngine.evaluateAttendanceSignal.mockReset().mockResolvedValue(undefined);
    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue(['ministry-1']);
    service = new AttendancesService(prisma, auditService, notificationsService, eventBus, pastoralAlertEngine);
  });

  it('builds workspace summary with expanded statuses', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Domingo',
      serviceDate: new Date('2026-04-10T00:00:00.000Z'),
      startTime: '09:00',
      status: 'PLANEJADO',
      locked: false,
      canceled: false,
      churchId: 'church-1',
    });
    prisma.scheduleSlot.findMany.mockResolvedValue([
      {
        id: 'slot-1',
        assignedServantId: 'servant-1',
        ministryId: 'ministry-1',
        teamId: null,
        functionName: 'Projecao',
        status: ScheduleSlotStatus.FILLED,
        confirmationStatus: 'PENDING',
        ministry: { id: 'ministry-1', name: 'Midia' },
        team: null,
        responsibility: null,
        assignedServant: { id: 'servant-1', name: 'Carlos' },
      },
      {
        id: 'slot-2',
        assignedServantId: 'servant-2',
        ministryId: 'ministry-1',
        teamId: null,
        functionName: 'Som',
        status: ScheduleSlotStatus.FILLED,
        confirmationStatus: 'PENDING',
        ministry: { id: 'ministry-1', name: 'Midia' },
        team: null,
        responsibility: null,
        assignedServant: { id: 'servant-2', name: 'Joao' },
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      { id: 'att-1', servantId: 'servant-1', status: AttendanceStatus.LATE },
      { id: 'att-2', servantId: 'servant-2', status: AttendanceStatus.NO_SHOW },
    ]);

    const result = await service.serviceWorkspace('service-1', adminActor);
    expect(result.summary.present).toBe(1);
    expect(result.summary.absent).toBe(1);
    expect(result.summary.justified).toBe(0);
    expect(result.summary.totalScheduled).toBe(2);
  });

  it('allows extra service attendance when flag is true', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      churchId: 'church-1',
      canceled: false,
      status: 'PLANEJADO',
    });
    prisma.servant.findUnique.mockResolvedValue({ id: 'servant-3', churchId: 'church-1' });
    prisma.scheduleSlot.findFirst.mockResolvedValue(null);
    prisma.attendance.upsert.mockResolvedValue({
      id: 'att-3',
      churchId: 'church-1',
      serviceId: 'service-1',
      servantId: 'servant-3',
      status: AttendanceStatus.EXTRA_SERVICE,
    });

    const result = await service.markServiceAttendance(
      'service-1',
      { servantId: 'servant-3', status: AttendanceStatus.EXTRA_SERVICE, allowExtraService: true },
      adminActor,
    );

    expect(result.status).toBe(AttendanceStatus.EXTRA_SERVICE);
    expect(prisma.attendance.upsert).toHaveBeenCalled();
  });

  it('blocks cross-tenant operation', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      churchId: 'church-2',
      canceled: false,
      status: 'PLANEJADO',
    });
    prisma.servant.findUnique.mockResolvedValue({ id: 'servant-3', churchId: 'church-1' });

    await expect(
      service.markServiceAttendance(
        'service-1',
        { servantId: 'servant-3', status: AttendanceStatus.PRESENTE },
        adminActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks coordinator without scope', async () => {
    const coordinator: JwtPayload = {
      ...adminActor,
      role: Role.COORDENADOR,
    };
    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue([]);
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Domingo',
      serviceDate: new Date('2026-04-10T00:00:00.000Z'),
      startTime: '09:00',
      status: 'PLANEJADO',
      locked: false,
      canceled: false,
      churchId: 'church-1',
    });

    await expect(service.serviceWorkspace('service-1', coordinator)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
