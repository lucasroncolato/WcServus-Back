import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  Role,
  ScheduleSlotConfirmationStatus,
  ScheduleSlotStatus,
  WorshipServiceStatus,
} from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { MeService } from './me.service';
import { MyScheduleResponse } from './dto/respond-my-schedule-slot.dto';

describe('MeService - my schedules self-service', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    scheduleSlot: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    attendance: {
      findMany: jest.fn(),
    },
  } as any;

  const notificationsService = {
    createMany: jest.fn().mockResolvedValue(undefined),
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as any;

  const eventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as any;

  const schedulesService = {
    confirmSchedule: jest.fn(),
    declineSchedule: jest.fn(),
  } as any;

  const actor: JwtPayload = {
    sub: 'user-1',
    role: Role.SERVO,
    email: 'servo@test.com',
    servantId: 'servant-1',
    churchId: 'church-1',
  };

  let service: MeService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockReset();
    prisma.user.findMany.mockReset();
    prisma.scheduleSlot.findMany.mockReset();
    prisma.scheduleSlot.findFirst.mockReset();
    prisma.attendance.findMany.mockReset();
    schedulesService.confirmSchedule.mockReset();
    schedulesService.declineSchedule.mockReset();
    service = new MeService(prisma, notificationsService, auditService, eventBus, schedulesService);
  });

  it('lists only schedules from linked servant', async () => {
    prisma.user.findUnique.mockResolvedValue({ servantId: 'servant-1' });
    prisma.scheduleSlot.findMany.mockResolvedValue([
      {
        id: 'slot-1',
        serviceId: 'service-1',
        ministryId: 'ministry-1',
        teamId: 'team-1',
        functionName: 'Projecao',
        status: ScheduleSlotStatus.FILLED,
        confirmationStatus: ScheduleSlotConfirmationStatus.PENDING,
        notes: null,
        service: {
          id: 'service-1',
          title: 'Domingo',
          type: 'DOMINGO',
          serviceDate: new Date('2026-04-10T00:00:00.000Z'),
          startTime: '09:00',
          status: WorshipServiceStatus.PLANEJADO,
          locked: false,
          canceled: false,
          notes: null,
        },
        ministry: { id: 'ministry-1', name: 'Midia' },
        team: { id: 'team-1', name: 'Projecao' },
        responsibility: { id: 'resp-1', title: 'Projecao' },
      },
    ]);

    const result = await service.listMySchedules(actor, {});
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].slotId).toBe('slot-1');
  });

  it('accepts schedule slot successfully', async () => {
    prisma.scheduleSlot.findFirst.mockResolvedValue({
      id: 'slot-1',
      churchId: 'church-1',
      serviceId: 'service-1',
      ministryId: 'ministry-1',
      assignedServantId: 'servant-1',
      confirmationStatus: ScheduleSlotConfirmationStatus.PENDING,
      service: {
        id: 'service-1',
        title: 'Domingo',
        serviceDate: new Date('2026-04-10T00:00:00.000Z'),
        startTime: '09:00',
        status: WorshipServiceStatus.PLANEJADO,
        locked: false,
        canceled: false,
      },
    });
    schedulesService.confirmSchedule.mockResolvedValue({
      id: 'slot-1',
      confirmationStatus: ScheduleSlotConfirmationStatus.CONFIRMED,
      status: ScheduleSlotStatus.CONFIRMED,
    });

    const result = await service.respondMyScheduleSlot(actor, {
      slotId: 'slot-1',
      response: MyScheduleResponse.ACCEPTED,
    });

    expect(result.confirmationStatus).toBe(ScheduleSlotConfirmationStatus.CONFIRMED);
    expect(schedulesService.confirmSchedule).toHaveBeenCalledWith('slot-1', actor);
  });

  it('declines schedule and reflects substitute pending', async () => {
    prisma.scheduleSlot.findFirst.mockResolvedValue({
      id: 'slot-1',
      churchId: 'church-1',
      serviceId: 'service-1',
      ministryId: 'ministry-1',
      assignedServantId: 'servant-1',
      confirmationStatus: ScheduleSlotConfirmationStatus.PENDING,
      service: {
        id: 'service-1',
        title: 'Domingo',
        serviceDate: new Date('2026-04-10T00:00:00.000Z'),
        startTime: '09:00',
        status: WorshipServiceStatus.PLANEJADO,
        locked: false,
        canceled: false,
      },
    });
    schedulesService.declineSchedule.mockResolvedValue({
      id: 'slot-1',
      confirmationStatus: ScheduleSlotConfirmationStatus.DECLINED,
      status: ScheduleSlotStatus.SUBSTITUTE_PENDING,
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    const result = await service.respondMyScheduleSlot(actor, {
      slotId: 'slot-1',
      response: MyScheduleResponse.DECLINED,
      declineReason: 'Indisponivel',
    });

    expect(result.slotStatus).toBe(ScheduleSlotStatus.SUBSTITUTE_PENDING);
    expect(schedulesService.declineSchedule).toHaveBeenCalledWith('slot-1', actor, 'Indisponivel');
  });

  it('prevents response for slot not assigned to servant', async () => {
    prisma.scheduleSlot.findFirst.mockResolvedValue(null);
    await expect(
      service.respondMyScheduleSlot(actor, { slotId: 'slot-x', response: MyScheduleResponse.ACCEPTED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents response in closed occurrence', async () => {
    prisma.scheduleSlot.findFirst.mockResolvedValue({
      id: 'slot-1',
      assignedServantId: 'servant-1',
      confirmationStatus: ScheduleSlotConfirmationStatus.PENDING,
      service: {
        id: 'service-1',
        title: 'Domingo',
        serviceDate: new Date('2026-04-10T00:00:00.000Z'),
        startTime: '09:00',
        status: WorshipServiceStatus.CONFIRMADO,
        locked: true,
        canceled: false,
      },
    });
    await expect(
      service.respondMyScheduleSlot(actor, { slotId: 'slot-1', response: MyScheduleResponse.ACCEPTED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents expired response', async () => {
    prisma.scheduleSlot.findFirst.mockResolvedValue({
      id: 'slot-1',
      churchId: 'church-1',
      serviceId: 'service-1',
      ministryId: 'ministry-1',
      assignedServantId: 'servant-1',
      confirmationStatus: ScheduleSlotConfirmationStatus.PENDING,
      service: {
        id: 'service-1',
        title: 'Domingo',
        serviceDate: new Date('2026-01-01T00:00:00.000Z'),
        startTime: '09:00',
        status: WorshipServiceStatus.PLANEJADO,
        locked: false,
        canceled: false,
      },
    });
    await expect(
      service.respondMyScheduleSlot(actor, { slotId: 'slot-1', response: MyScheduleResponse.ACCEPTED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires decline reason when declining', async () => {
    await expect(
      service.respondMyScheduleSlot(actor, { slotId: 'slot-1', response: MyScheduleResponse.DECLINED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns /me/attendance grouped shape with summary', async () => {
    prisma.user.findUnique.mockResolvedValue({ servantId: 'servant-1' });
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 'att-1',
        serviceId: 'service-1',
        status: 'LATE',
        justification: null,
        notes: null,
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        updatedAt: new Date('2026-04-01T10:00:00.000Z'),
        service: {
          id: 'service-1',
          title: 'Domingo Manha',
          type: 'DOMINGO',
          serviceDate: new Date('2026-04-01T09:00:00.000Z'),
          startTime: '09:00',
          status: WorshipServiceStatus.PLANEJADO,
          locked: false,
          canceled: false,
        },
      },
    ]);
    prisma.scheduleSlot.findMany.mockResolvedValue([
      {
        id: 'slot-upcoming',
        serviceId: 'service-2',
        functionName: 'Projecao',
        service: {
          id: 'service-2',
          title: 'Domingo Noite',
          type: 'DOMINGO',
          serviceDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          startTime: '19:00',
          status: WorshipServiceStatus.PLANEJADO,
          locked: false,
          canceled: false,
        },
        ministry: { id: 'ministry-1', name: 'Midia' },
        team: null,
        responsibility: null,
      },
    ]);

    const result = await service.listMyAttendance(actor, {});
    expect(result).toEqual(
      expect.objectContaining({
        upcoming: expect.any(Array),
        history: expect.any(Array),
        summary: expect.objectContaining({
          total: 1,
          present: 1,
          absent: 0,
          justified: 0,
        }),
      }),
    );
    expect(result.upcoming[0].attendanceStatus).toBe('UNKNOWN');
    expect(result.history[0].attendanceStatus).toBe('LATE');
  });

  it('does not leak attendance from another servant', async () => {
    prisma.user.findUnique.mockResolvedValue({ servantId: 'servant-1' });
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.scheduleSlot.findMany.mockResolvedValue([]);

    await service.listMyAttendance(actor, {});

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ servantId: 'servant-1' }),
      }),
    );
    expect(prisma.scheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedServantId: 'servant-1' }),
      }),
    );
  });
});
