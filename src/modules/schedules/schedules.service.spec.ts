import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditAction, Role, ScheduleStatus } from '@prisma/client';
import { SchedulesService } from './schedules.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { resolveScopedMinistryIds } from 'src/common/auth/access-scope';
import { ScheduleSlotSwapContextDto } from './dto/contextual-swap-schedule-slot.dto';

const defaultEligibilityEvaluate = (context: any) => {
  const reasons: string[] = [];
  if (context.slot?.blocked) {
    reasons.push(context.slot.blockedReason || 'SLOT_BLOCKED');
  }
  if (context.hasPastoralPending) {
    reasons.push('PASTORAL_PENDING');
  }
  if (context.servant?.status !== 'ATIVO') {
    reasons.push('INACTIVE');
  }
  if (context.servant?.approvalStatus !== 'APPROVED') {
    reasons.push('PENDING_APPROVAL');
  }

  const relation = (context.servant?.servantMinistries ?? []).find(
    (item: any) => item.ministryId === context.ministryId,
  );
  const trainingStatus = relation?.trainingStatus ?? context.servant?.trainingStatus;
  if (context.slot?.requiredTraining !== false && trainingStatus !== 'COMPLETED') {
    reasons.push('MINISTRY_TRAINING_NOT_COMPLETED');
  }

  if (context.unavailableAtServiceTime) {
    reasons.push('UNAVAILABLE_AT_SERVICE_TIME');
  }

  const conflicts: string[] = context.conflictMinistryIds ?? [];
  if (conflicts.some((ministryId) => ministryId !== context.ministryId)) {
    reasons.push('ALREADY_SCHEDULED_IN_OTHER_MINISTRY');
  }
  if (
    context.slot &&
    conflicts.includes(context.ministryId) &&
    context.slot.assignedServantId !== context.servant?.id
  ) {
    reasons.push('ALREADY_SCHEDULED_SAME_MINISTRY');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
};

const eligibilityEngine = {
  evaluate: jest.fn(defaultEligibilityEvaluate),
} as any;

jest.mock('src/common/auth/access-scope', () => ({
  assertMinistryAccess: jest.fn(),
  assertServantAccess: jest.fn().mockResolvedValue(undefined),
  getScheduleAccessWhere: jest.fn().mockResolvedValue(undefined),
  resolveScopedMinistryIds: jest.fn().mockResolvedValue([]),
}));

describe('SchedulesService - duplicate', () => {
  const prisma = {
    schedule: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    worshipService: {
      findUnique: jest.fn(),
    },
    ministry: {
      findMany: jest.fn(),
    },
    servant: {
      findUnique: jest.fn(),
    },
    servantAvailability: {
      findFirst: jest.fn(),
    },
    pastoralVisit: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    pastoralAlert: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'user-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    (eligibilityEngine.evaluate as jest.Mock).mockReset();
    (eligibilityEngine.evaluate as jest.Mock).mockImplementation(defaultEligibilityEvaluate);
    prisma.schedule.findUnique.mockReset();
    prisma.schedule.findFirst.mockReset();
    prisma.schedule.create.mockReset();
    prisma.worshipService.findUnique.mockReset();
    prisma.servant.findUnique.mockReset();
    prisma.servantAvailability.findFirst.mockReset();
    prisma.ministry.findMany.mockReset();
    prisma.pastoralVisit.count.mockReset();
    prisma.pastoralVisit.findMany.mockReset();
    prisma.pastoralAlert.count.mockReset();
    prisma.pastoralAlert.findMany.mockReset();
    prisma.pastoralVisit.count.mockResolvedValue(0);
    prisma.pastoralVisit.findMany.mockResolvedValue([]);
    prisma.pastoralAlert.count.mockResolvedValue(0);
    prisma.pastoralAlert.findMany.mockResolvedValue([]);
    (auditService.log as jest.Mock).mockReset();
    (auditService.log as jest.Mock).mockResolvedValue(undefined);
    (notificationsService.create as jest.Mock).mockReset();
    (notificationsService.createMany as jest.Mock).mockReset();
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset();
    service = new SchedulesService(prisma, auditService, notificationsService, eligibilityEngine);
  });

  it('should duplicate schedule successfully', async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      serviceId: 'service-a',
      servantId: 'servant-1',
      ministryId: 'ministry-1',
      service: { id: 'service-a' },
    });
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-b',
      serviceDate: new Date('2026-03-23T19:00:00.000Z'),
      startTime: '19:00',
    });
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-1',
      status: 'ATIVO',
      trainingStatus: 'COMPLETED',
      approvalStatus: 'APPROVED',
      mainMinistryId: 'ministry-1',
      servantMinistries: [],
      talents: [],
    });
    prisma.schedule.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.servantAvailability.findFirst.mockResolvedValue(null);
    prisma.schedule.create.mockResolvedValue({
      id: 'schedule-2',
      status: ScheduleStatus.ASSIGNED,
      service: { title: 'Culto Domingo 19h' },
      servant: { id: 'servant-1', name: 'Servo 1' },
      ministry: { id: 'ministry-1', name: 'Louvor' },
    });

    const result = await service.duplicate('schedule-1', { worshipServiceId: 'service-b' }, actor);

    expect(result).toEqual(
      expect.objectContaining({ id: 'schedule-2', status: ScheduleStatus.ASSIGNED }),
    );
    expect(prisma.schedule.create).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalled();
  });

  it('should throw 404 when source schedule does not exist', async () => {
    prisma.schedule.findUnique.mockResolvedValue(null);

    await expect(
      service.duplicate('not-found', { worshipServiceId: 'service-b' }, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should throw 404 when target service does not exist', async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      servantId: 'servant-1',
      ministryId: 'ministry-1',
      service: { id: 'service-a' },
    });
    prisma.schedule.findFirst.mockResolvedValue({ id: 'schedule-1' });
    prisma.worshipService.findUnique.mockResolvedValue(null);

    await expect(
      service.duplicate('schedule-1', { worshipServiceId: 'not-found' }, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should throw 409 when duplicate conflicts', async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      servantId: 'servant-1',
      ministryId: 'ministry-1',
      service: { id: 'service-a' },
    });
    prisma.schedule.findFirst.mockResolvedValue({ id: 'existing-schedule' });
    prisma.servantAvailability.findFirst.mockResolvedValue(null);
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-b',
      serviceDate: new Date('2026-03-23T19:00:00.000Z'),
      startTime: '19:00',
    });
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-1',
      status: 'ATIVO',
      trainingStatus: 'COMPLETED',
      approvalStatus: 'APPROVED',
      mainMinistryId: 'ministry-1',
      servantMinistries: [],
      talents: [],
    });

    await expect(
      service.duplicate('schedule-1', { worshipServiceId: 'service-b' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should throw 403 when actor cannot manage source schedule', async () => {
    const localActor: JwtPayload = { ...actor, role: Role.COORDENADOR };

    prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      servantId: 'servant-1',
      ministryId: 'ministry-1',
      service: { id: 'service-a' },
    });
    prisma.schedule.findFirst.mockResolvedValue(null);

    await expect(
      service.duplicate('schedule-1', { worshipServiceId: 'service-b' }, localActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('SchedulesService - history', () => {
  const prisma = {
    schedule: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    scheduleSwapHistory: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'user-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    (eligibilityEngine.evaluate as jest.Mock).mockReset();
    (eligibilityEngine.evaluate as jest.Mock).mockImplementation(defaultEligibilityEvaluate);
    prisma.schedule.findFirst.mockReset();
    prisma.schedule.findUnique.mockReset();
    prisma.scheduleSwapHistory.findMany.mockReset();
    prisma.auditLog.findMany.mockReset();
    (notificationsService.create as jest.Mock).mockReset();
    (notificationsService.createMany as jest.Mock).mockReset();
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset();
    service = new SchedulesService(prisma, auditService, notificationsService, eligibilityEngine);
  });

  it('should return merged history sorted desc with SWAPPED/CREATED/UPDATED/STATUS_CHANGED/DUPLICATED', async () => {
    prisma.schedule.findFirst.mockResolvedValue({ id: 'schedule-1' });
    prisma.schedule.findUnique.mockResolvedValue({ id: 'schedule-1' });

    prisma.scheduleSwapHistory.findMany.mockResolvedValue([
      {
        id: 'sw-1',
        fromScheduleId: 'schedule-1',
        toScheduleId: 'schedule-2',
        reason: 'Troca manual',
        createdAt: new Date('2026-03-23T10:00:00.000Z'),
        swappedBy: { id: 'u-1', name: 'Coord' },
      },
    ]);

    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a-1',
        action: AuditAction.CREATE,
        entity: 'Schedule',
        metadata: null,
        createdAt: new Date('2026-03-23T09:00:00.000Z'),
      },
      {
        id: 'a-2',
        action: AuditAction.UPDATE,
        entity: 'Schedule',
        metadata: null,
        createdAt: new Date('2026-03-23T08:00:00.000Z'),
      },
      {
        id: 'a-3',
        action: AuditAction.STATUS_CHANGE,
        entity: 'Schedule',
        metadata: null,
        createdAt: new Date('2026-03-23T07:00:00.000Z'),
      },
      {
        id: 'a-4',
        action: AuditAction.CREATE,
        entity: 'ScheduleDuplicate',
        metadata: null,
        createdAt: new Date('2026-03-23T06:00:00.000Z'),
      },
    ]);

    const result = await service.history('schedule-1', actor);

    expect(result.map((item) => item.type)).toEqual([
      'SWAPPED',
      'CREATED',
      'UPDATED',
      'STATUS_CHANGED',
      'DUPLICATED',
    ]);
    expect(result[0].createdAt.toISOString()).toBe('2026-03-23T10:00:00.000Z');
    expect(result[result.length - 1].createdAt.toISOString()).toBe('2026-03-23T06:00:00.000Z');
  });

  it('should include swaps where schedule is source or target', async () => {
    prisma.schedule.findFirst.mockResolvedValue({ id: 'schedule-1' });
    prisma.schedule.findUnique.mockResolvedValue({ id: 'schedule-1' });

    prisma.scheduleSwapHistory.findMany.mockResolvedValue([
      {
        id: 'sw-from',
        fromScheduleId: 'schedule-1',
        toScheduleId: 'schedule-9',
        reason: null,
        createdAt: new Date('2026-03-23T10:00:00.000Z'),
        swappedBy: { id: 'u-1', name: 'Coord' },
      },
      {
        id: 'sw-to',
        fromScheduleId: 'schedule-8',
        toScheduleId: 'schedule-1',
        reason: null,
        createdAt: new Date('2026-03-23T09:00:00.000Z'),
        swappedBy: { id: 'u-1', name: 'Coord' },
      },
    ]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.history('schedule-1', actor);

    expect(result.filter((item) => item.type === 'SWAPPED')).toHaveLength(2);
  });
});

describe('SchedulesService - workspace context', () => {
  const prisma = {
    worshipService: {
      findMany: jest.fn(),
    },
    scheduleSlot: {
      findMany: jest.fn(),
    },
    schedule: {
      findMany: jest.fn(),
    },
    ministry: {
      findMany: jest.fn(),
    },
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    (eligibilityEngine.evaluate as jest.Mock).mockReset();
    (eligibilityEngine.evaluate as jest.Mock).mockImplementation(defaultEligibilityEvaluate);
    prisma.worshipService.findMany.mockReset();
    prisma.scheduleSlot.findMany.mockReset();
    prisma.schedule.findMany.mockReset();
    prisma.ministry.findMany.mockReset();
    prisma.ministry.findMany.mockResolvedValue([]);
    (resolveScopedMinistryIds as jest.Mock).mockReset();
    service = new SchedulesService(prisma, auditService, notificationsService, eligibilityEngine);
  });

  it('infers coordinator ministry automatically when only one scope is available', async () => {
    const actor: JwtPayload = {
      sub: 'coord-1',
      email: 'coord@wcservus.com',
      role: Role.COORDENADOR,
      servantId: null,
    };

    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue(['ministry-1']);
    prisma.worshipService.findMany.mockResolvedValue([]);
    prisma.scheduleSlot.findMany.mockResolvedValue([]);
    prisma.schedule.findMany.mockResolvedValue([]);

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31' },
        actor,
      ),
    ).resolves.toEqual([]);

    expect(resolveScopedMinistryIds).toHaveBeenCalled();
    expect(prisma.worshipService.findMany).toHaveBeenCalled();
  });

  it('returns 400 for admin when ministry context is missing', async () => {
    const actor: JwtPayload = {
      sub: 'admin-1',
      email: 'admin@wcservus.com',
      role: Role.ADMIN,
      servantId: null,
    };

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 400 for coordinator with multiple ministries and no explicit ministryId', async () => {
    const actor: JwtPayload = {
      sub: 'coord-multi',
      email: 'coord-multi@wcservus.com',
      role: Role.COORDENADOR,
      servantId: null,
    };

    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue(['ministry-1', 'ministry-2']);

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 403 for coordinator when requested ministry is out of scope', async () => {
    const actor: JwtPayload = {
      sub: 'coord-scope',
      email: 'coord-scope@wcservus.com',
      role: Role.COORDENADOR,
      servantId: null,
    };

    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue(['ministry-1']);

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31', ministryId: 'ministry-2' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 403 for coordinator without configured ministry scope', async () => {
    const actor: JwtPayload = {
      sub: 'coord-empty',
      email: 'coord-empty@wcservus.com',
      role: Role.COORDENADOR,
      servantId: null,
    };

    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue([]);

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin with explicit ministryId', async () => {
    const actor: JwtPayload = {
      sub: 'admin-valid',
      email: 'admin-valid@wcservus.com',
      role: Role.ADMIN,
      servantId: null,
    };

    prisma.worshipService.findMany.mockResolvedValue([]);
    prisma.scheduleSlot.findMany.mockResolvedValue([]);
    prisma.schedule.findMany.mockResolvedValue([]);

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31', ministryId: 'ministry-1' },
        actor,
      ),
    ).resolves.toEqual([]);
  });
});

describe('SchedulesService - slot eligibility rules', () => {
  const prisma = {
    worshipService: {
      findUnique: jest.fn(),
    },
    servant: {
      findMany: jest.fn(),
    },
    schedule: {
      findMany: jest.fn(),
    },
    pastoralVisit: {
      findMany: jest.fn(),
    },
    pastoralAlert: {
      findMany: jest.fn(),
    },
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    (eligibilityEngine.evaluate as jest.Mock).mockReset();
    (eligibilityEngine.evaluate as jest.Mock).mockImplementation(defaultEligibilityEvaluate);
    prisma.worshipService.findUnique.mockReset();
    prisma.servant.findMany.mockReset();
    prisma.schedule.findMany.mockReset();
    prisma.pastoralVisit.findMany.mockReset();
    prisma.pastoralAlert.findMany.mockReset();
    service = new SchedulesService(prisma, auditService, notificationsService, eligibilityEngine);
  });

  it('returns pastoral pending and cross-ministry conflict reasons in eligible-servants endpoint', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'svc-1',
      serviceDate: new Date('2026-03-27T22:00:00.000Z'),
      startTime: '19:00',
    });
    prisma.servant.findMany.mockResolvedValue([
      {
        id: 'servant-a',
        name: 'Servo A',
        status: 'ATIVO',
        trainingStatus: 'COMPLETED',
        approvalStatus: 'APPROVED',
        mainMinistryId: 'ministry-1',
        servantMinistries: [],
        availabilities: [],
        talents: [],
      },
      {
        id: 'servant-b',
        name: 'Servo B',
        status: 'ATIVO',
        trainingStatus: 'COMPLETED',
        approvalStatus: 'APPROVED',
        mainMinistryId: 'ministry-1',
        servantMinistries: [],
        availabilities: [],
        talents: [],
      },
    ]);
    prisma.schedule.findMany.mockResolvedValue([
      { servantId: 'servant-b', ministryId: 'ministry-2' },
    ]);
    prisma.pastoralVisit.findMany.mockResolvedValue([
      { servantId: 'servant-a' },
    ]);
    prisma.pastoralAlert.findMany.mockResolvedValue([]);

    const result = await service.listEligibleServants(
      {
        serviceId: 'svc-1',
        ministryId: 'ministry-1',
        includeReasons: true,
      },
      actor,
    );

    const servantA = result.find((item) => item.servantId === 'servant-a');
    const servantB = result.find((item) => item.servantId === 'servant-b');

    expect(servantA?.eligible).toBe(false);
    expect(servantA?.reasons).toContain('PASTORAL_PENDING');
    expect(servantB?.eligible).toBe(false);
    expect(servantB?.reasons).toContain('ALREADY_SCHEDULED_IN_OTHER_MINISTRY');
  });

  it('marks servant ineligible when training is pending for selected ministry', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'svc-1',
      serviceDate: new Date('2026-03-27T22:00:00.000Z'),
      startTime: '19:00',
    });
    prisma.servant.findMany.mockResolvedValue([
      {
        id: 'servant-c',
        name: 'Servo C',
        status: 'ATIVO',
        trainingStatus: 'COMPLETED',
        approvalStatus: 'APPROVED',
        mainMinistryId: 'ministry-2',
        servantMinistries: [
          { ministryId: 'ministry-1', trainingStatus: 'PENDING', trainingCompletedAt: null },
        ],
        availabilities: [],
        talents: [],
      },
    ]);
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.pastoralVisit.findMany.mockResolvedValue([]);
    prisma.pastoralAlert.findMany.mockResolvedValue([]);

    const result = await service.listEligibleServants(
      {
        serviceId: 'svc-1',
        ministryId: 'ministry-1',
        includeReasons: true,
      },
      actor,
    );

    expect(result[0].eligible).toBe(false);
    expect(result[0].reasons).toContain('MINISTRY_TRAINING_NOT_COMPLETED');
  });
});

describe('SchedulesService - assignment flow with ministry training', () => {
  const prisma = {
    scheduleSlot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    worshipService: {
      findUnique: jest.fn(),
    },
    servant: {
      findMany: jest.fn(),
    },
    servantAvailability: {
      findMany: jest.fn(),
    },
    schedule: {
      findMany: jest.fn(),
    },
    pastoralVisit: {
      findMany: jest.fn(),
    },
    pastoralAlert: {
      findMany: jest.fn(),
    },
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    (eligibilityEngine.evaluate as jest.Mock).mockReset();
    (eligibilityEngine.evaluate as jest.Mock).mockImplementation(defaultEligibilityEvaluate);
    prisma.scheduleSlot.findUnique.mockReset();
    prisma.scheduleSlot.findMany.mockReset();
    prisma.worshipService.findUnique.mockReset();
    prisma.servant.findMany.mockReset();
    prisma.servantAvailability.findMany.mockReset();
    prisma.schedule.findMany.mockReset();
    prisma.pastoralVisit.findMany.mockReset();
    prisma.pastoralAlert.findMany.mockReset();

    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'svc-1',
      serviceDate: new Date('2026-03-27T22:00:00.000Z'),
      startTime: '19:00',
    });
    prisma.servant.findMany.mockResolvedValue([
      {
        id: 'servant-1',
        name: 'Servo 1',
        status: 'ATIVO',
        trainingStatus: 'COMPLETED',
        approvalStatus: 'APPROVED',
        aptitude: null,
        mainMinistryId: 'ministry-1',
        servantMinistries: [
          { ministryId: 'ministry-1', trainingStatus: 'PENDING', trainingCompletedAt: null },
        ],
      },
    ]);
    prisma.servantAvailability.findMany.mockResolvedValue([]);
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.pastoralVisit.findMany.mockResolvedValue([]);
    prisma.pastoralAlert.findMany.mockResolvedValue([]);

    service = new SchedulesService(prisma, auditService, notificationsService, eligibilityEngine);
  });

  it('blocks assign when ministry training is pending', async () => {
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      serviceId: 'svc-1',
      ministryId: 'ministry-1',
      functionName: 'Recepcao',
      requiredTraining: true,
      blocked: false,
      blockedReason: null,
      assignedServantId: null,
      service: {
        id: 'svc-1',
      },
    });

    await expect(
      service.assignSlot('slot-1', { servantId: 'servant-1' }, actor),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('blocks fill when ministry training is pending', async () => {
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      serviceId: 'svc-1',
      ministryId: 'ministry-1',
      functionName: 'Recepcao',
      requiredTraining: true,
      blocked: false,
      blockedReason: null,
      assignedServantId: null,
      service: {
        id: 'svc-1',
      },
    });

    await expect(
      service.fillSlot(
        'slot-1',
        { substituteServantId: 'servant-1', context: ScheduleSlotSwapContextDto.FILL_OPEN_SLOT },
        actor,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('blocks swap when ministry training is pending', async () => {
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      serviceId: 'svc-1',
      ministryId: 'ministry-1',
      functionName: 'Recepcao',
      requiredTraining: true,
      blocked: false,
      blockedReason: null,
      assignedServantId: 'servant-old',
      service: {
        id: 'svc-1',
      },
    });

    await expect(
      service.contextualSwapSlot(
        'slot-1',
        { substituteServantId: 'servant-1', context: ScheduleSlotSwapContextDto.REPLACEMENT },
        actor,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('keeps auto-generate from assigning servant without ministry training', async () => {
    const assignSpy = jest.spyOn(service, 'assignSlot');
    prisma.scheduleSlot.findMany.mockResolvedValue([
      {
        id: 'slot-1',
        serviceId: 'svc-1',
        ministryId: 'ministry-1',
        functionName: 'Recepcao',
        requiredTraining: true,
        blocked: false,
        blockedReason: null,
        assignedServantId: null,
        status: 'OPEN',
      },
    ]);

    const result = await service.autoGenerateExplained(
      {
        serviceId: 'svc-1',
        ministryId: 'ministry-1',
      },
      actor,
    );

    expect(assignSpy).not.toHaveBeenCalled();
    expect(result.details[0]).toEqual(
      expect.objectContaining({
        action: 'SKIPPED',
        reason: 'NO_ELIGIBLE_SERVANT',
      }),
    );
  });
});

describe('SchedulesService - slot operations pending gaps', () => {
  const prisma = {
    scheduleSlot: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    schedule: {
      deleteMany: jest.fn(),
    },
    scheduleSlotChange: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
    timelineEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
    },
    scheduleResponseHistory: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const notificationsService = {
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
    churchId: 'church-1',
  };

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.scheduleSlot.findUnique.mockReset();
    prisma.scheduleSlot.update.mockReset();
    prisma.scheduleSlot.count.mockReset();
    prisma.schedule.deleteMany.mockReset();
    prisma.scheduleSlotChange.create.mockReset();
    prisma.scheduleSlotChange.findMany.mockReset();
    prisma.auditLog.findMany.mockReset();
    prisma.timelineEntry.create.mockReset();
    prisma.timelineEntry.findMany.mockReset();
    prisma.notification.findMany.mockReset();
    prisma.scheduleResponseHistory.findMany.mockReset();
    prisma.$transaction.mockReset();
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset();
    (auditService.log as jest.Mock).mockReset();
    (auditService.log as jest.Mock).mockResolvedValue(undefined);
    service = new SchedulesService(prisma, auditService, notificationsService, eligibilityEngine);
  });

  it('unassigns slot with success', async () => {
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      ministryId: 'ministry-1',
      churchId: 'church-1',
      serviceId: 'svc-1',
      assignedServantId: 'servant-1',
      status: 'FILLED',
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        scheduleSlot: {
          update: jest.fn().mockResolvedValue({
            id: 'slot-1',
            assignedServantId: null,
            status: 'EMPTY',
            confirmationStatus: 'PENDING',
          }),
          count: jest.fn().mockResolvedValue(0),
        },
        schedule: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        scheduleSlotChange: {
          create: jest.fn().mockResolvedValue(undefined),
        },
      }),
    );

    const result = await service.unassignSlot('slot-1', actor);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        slot: expect.objectContaining({
          id: 'slot-1',
          servantId: null,
          slotStatus: 'EMPTY',
          confirmationStatus: 'PENDING',
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalled();
  });

  it('blocks unassign when coordinator has no scope', async () => {
    const coordinator: JwtPayload = {
      ...actor,
      role: Role.COORDENADOR,
    };
    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue([]);
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      ministryId: 'ministry-1',
      churchId: 'church-1',
      serviceId: 'svc-1',
      assignedServantId: 'servant-1',
      status: 'FILLED',
    });

    await expect(service.unassignSlot('slot-1', coordinator)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('locks and unlocks slot with success', async () => {
    prisma.scheduleSlot.findUnique
      .mockResolvedValueOnce({
        id: 'slot-1',
        ministryId: 'ministry-1',
        churchId: 'church-1',
        serviceId: 'svc-1',
        assignedServantId: 'servant-1',
      })
      .mockResolvedValueOnce({
        id: 'slot-1',
        ministryId: 'ministry-1',
        churchId: 'church-1',
        serviceId: 'svc-1',
        assignedServantId: 'servant-1',
      });

    prisma.scheduleSlot.update
      .mockResolvedValueOnce({
        id: 'slot-1',
        status: 'LOCKED',
      })
      .mockResolvedValueOnce({
        id: 'slot-1',
        status: 'FILLED',
      });

    const lockResult = await service.lockSlot('slot-1', actor);
    const unlockResult = await service.unlockSlot('slot-1', actor);

    expect(lockResult.slot.slotStatus).toBe('LOCKED');
    expect(unlockResult.slot.slotStatus).toBe('FILLED');
  });

  it('blocks assign and swap when slot is locked', async () => {
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      serviceId: 'svc-1',
      ministryId: 'ministry-1',
      churchId: 'church-1',
      functionName: 'Recepcao',
      requiredTraining: true,
      blocked: true,
      blockedReason: 'LOCKED_BY_COORDINATOR',
      assignedServantId: 'servant-1',
      status: 'LOCKED',
      service: { id: 'svc-1' },
    });

    await expect(service.assignSlot('slot-1', { servantId: 'servant-2' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.contextualSwapSlot(
        'slot-1',
        { substituteServantId: 'servant-2', context: ScheduleSlotSwapContextDto.REPLACEMENT },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails resend notification for empty slot', async () => {
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      churchId: 'church-1',
      serviceId: 'svc-1',
      ministryId: 'ministry-1',
      assignedServantId: null,
      service: { title: 'Culto Domingo' },
    });

    await expect(service.resendSlotNotification('slot-1', actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces tenant on slot history', async () => {
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      churchId: 'church-2',
      ministryId: 'ministry-1',
    });
    const tenantIntegrity = {
      getActorChurchId: jest.fn(() => 'church-1'),
      assertSameChurch: jest.fn(() => {
        throw new ForbiddenException('cross-tenant');
      }),
      assertLinkIntegrity: jest.fn(),
      assertActorChurch: jest.fn(() => 'church-1'),
    } as any;

    service = new SchedulesService(
      prisma,
      auditService,
      notificationsService,
      eligibilityEngine,
      undefined as any,
      undefined as any,
      undefined as any,
      tenantIntegrity,
    );

    await expect(service.slotHistory('slot-1', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces scope permission on slot history', async () => {
    const coordinator: JwtPayload = {
      ...actor,
      role: Role.COORDENADOR,
    };
    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue([]);
    prisma.scheduleSlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      churchId: 'church-1',
      ministryId: 'ministry-1',
    });

    await expect(service.slotHistory('slot-1', coordinator)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('SchedulesService - bulk toolbar actions', () => {
  const prisma = {
    worshipService: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    scheduleSlot: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    timelineEntry: {
      create: jest.fn(),
    },
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const notificationsService = {
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
    churchId: 'church-1',
  };

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.worshipService.findUnique.mockReset();
    prisma.worshipService.update.mockReset();
    prisma.scheduleSlot.findMany.mockReset();
    prisma.scheduleSlot.count.mockReset();
    prisma.timelineEntry.create.mockReset();
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset();
    (auditService.log as jest.Mock).mockReset();
    (auditService.log as jest.Mock).mockResolvedValue(undefined);
    service = new SchedulesService(prisma, auditService, notificationsService, eligibilityEngine);
  });

  it('notify pending success', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-1',
      locked: false,
    });
    prisma.scheduleSlot.findMany
      .mockResolvedValueOnce([{ ministryId: 'ministry-1' }])
      .mockResolvedValueOnce([
        { id: 'slot-1', assignedServantId: 'servant-1' },
        { id: 'slot-2', assignedServantId: 'servant-2' },
      ]);

    const result = await service.notifyPendingSlotsForService('service-1', actor);
    expect(result.summary.totalPending).toBe(2);
    expect(result.summary.sent).toBe(2);
    expect(result.summary.failed).toBe(0);
  });

  it('notify pending partial failure', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-1',
      locked: false,
    });
    prisma.scheduleSlot.findMany
      .mockResolvedValueOnce([{ ministryId: 'ministry-1' }])
      .mockResolvedValueOnce([
        { id: 'slot-1', assignedServantId: 'servant-1' },
        { id: 'slot-2', assignedServantId: 'servant-2' },
      ]);
    (notificationsService.notifyServantLinkedUser as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('provider failed'));

    const result = await service.notifyPendingSlotsForService('service-1', actor);
    expect(result.summary.sent).toBe(1);
    expect(result.summary.failed).toBe(1);
  });

  it('fill empty slots success respecting eligibility', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-1',
      locked: false,
    });
    prisma.scheduleSlot.findMany
      .mockResolvedValueOnce([{ ministryId: 'ministry-1' }])
      .mockResolvedValueOnce([
        {
          id: 'slot-1',
          serviceId: 'service-1',
          churchId: 'church-1',
          ministryId: 'ministry-1',
          status: 'EMPTY',
          blocked: false,
          assignedServantId: null,
        },
      ])
      .mockResolvedValueOnce([]);

    jest.spyOn(service as any, 'listSlotEligibility').mockResolvedValue([
      { servantId: 'servant-1', eligible: true, score: 99, reasons: [] },
    ]);
    jest.spyOn(service, 'assignSlot').mockResolvedValue({ id: 'slot-1' } as any);

    const result = await service.fillEmptySlotsForService('service-1', actor);
    expect(result.summary.filled).toBe(1);
    expect(result.details[0]).toEqual(expect.objectContaining({ slotId: 'slot-1', status: 'FILLED' }));
  });

  it('fill empty slots ignores locked slots', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-1',
      locked: false,
    });
    prisma.scheduleSlot.findMany
      .mockResolvedValueOnce([{ ministryId: 'ministry-1' }])
      .mockResolvedValueOnce([
        {
          id: 'slot-locked',
          serviceId: 'service-1',
          churchId: 'church-1',
          ministryId: 'ministry-1',
          status: 'LOCKED',
          blocked: true,
          assignedServantId: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.fillEmptySlotsForService('service-1', actor);
    expect(result.summary.filled).toBe(0);
    expect(result.summary.unfilled).toBe(1);
  });

  it('regenerate suggestions success', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-1',
      locked: false,
    });
    prisma.scheduleSlot.findMany
      .mockResolvedValueOnce([{ ministryId: 'ministry-1' }])
      .mockResolvedValueOnce([
        {
          id: 'slot-1',
          serviceId: 'service-1',
          churchId: 'church-1',
          ministryId: 'ministry-1',
          status: 'EMPTY',
          blocked: false,
          assignedServantId: null,
        },
      ]);
    jest.spyOn(service as any, 'listSlotEligibility').mockResolvedValue([
      { servantId: 'servant-1', eligible: true, score: 88, reasons: [] },
    ]);

    const result = await service.regenerateSuggestionsForService('service-1', actor);
    expect(result.summary.slotsEvaluated).toBe(1);
    expect(result.summary.withSuggestions).toBe(1);
  });

  it('close schedule success with warnings', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-1',
      locked: false,
    });
    prisma.scheduleSlot.findMany.mockResolvedValue([{ ministryId: 'ministry-1' }]);
    prisma.scheduleSlot.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    prisma.worshipService.update.mockResolvedValue({ id: 'service-1' });

    const result = await service.closeScheduleForService('service-1', actor);
    expect(result.success).toBe(true);
    expect(result.status).toBe('CLOSED');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('blocks bulk action by tenant', async () => {
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-2',
      locked: false,
    });
    const tenantIntegrity = {
      getActorChurchId: jest.fn(() => 'church-1'),
      assertSameChurch: jest.fn(() => {
        throw new ForbiddenException('cross-tenant');
      }),
      assertLinkIntegrity: jest.fn(),
      assertActorChurch: jest.fn(() => 'church-1'),
    } as any;
    service = new SchedulesService(
      prisma,
      auditService,
      notificationsService,
      eligibilityEngine,
      undefined as any,
      undefined as any,
      undefined as any,
      tenantIntegrity,
    );

    await expect(service.notifyPendingSlotsForService('service-1', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks close schedule for coordinator without full service scope', async () => {
    const coordinator: JwtPayload = {
      ...actor,
      role: Role.COORDENADOR,
    };
    (resolveScopedMinistryIds as jest.Mock).mockResolvedValue(['ministry-1']);
    prisma.worshipService.findUnique.mockResolvedValue({
      id: 'service-1',
      title: 'Culto Domingo',
      churchId: 'church-1',
      locked: false,
    });
    prisma.scheduleSlot.findMany.mockResolvedValue([
      { ministryId: 'ministry-1' },
      { ministryId: 'ministry-2' },
    ]);

    await expect(service.closeScheduleForService('service-1', coordinator)).rejects.toBeInstanceOf(ForbiddenException);
  });
});




