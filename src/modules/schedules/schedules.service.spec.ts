import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, Role, ScheduleStatus } from '@prisma/client';
import { SchedulesService } from './schedules.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { resolveScopedSectorIds } from 'src/common/auth/access-scope';

jest.mock('src/common/auth/access-scope', () => ({
  assertSectorAccess: jest.fn(),
  assertServantAccess: jest.fn().mockResolvedValue(undefined),
  getScheduleAccessWhere: jest.fn().mockResolvedValue(undefined),
  resolveScopedSectorIds: jest.fn().mockResolvedValue([]),
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
    sector: {
      findMany: jest.fn(),
    },
    servant: {
      findUnique: jest.fn(),
    },
    servantAvailability: {
      findFirst: jest.fn(),
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
    prisma.schedule.findUnique.mockReset();
    prisma.schedule.findFirst.mockReset();
    prisma.schedule.create.mockReset();
    prisma.worshipService.findUnique.mockReset();
    prisma.servant.findUnique.mockReset();
    prisma.servantAvailability.findFirst.mockReset();
    prisma.sector.findMany.mockReset();
    (auditService.log as jest.Mock).mockReset();
    (auditService.log as jest.Mock).mockResolvedValue(undefined);
    (notificationsService.create as jest.Mock).mockReset();
    (notificationsService.createMany as jest.Mock).mockReset();
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset();
    service = new SchedulesService(prisma, auditService, notificationsService);
  });

  it('should duplicate schedule successfully', async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      serviceId: 'service-a',
      servantId: 'servant-1',
      sectorId: 'sector-1',
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
      mainSectorId: 'sector-1',
      servantSectors: [],
      talents: [],
    });
    prisma.schedule.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.servantAvailability.findFirst.mockResolvedValue(null);
    prisma.schedule.create.mockResolvedValue({
      id: 'schedule-2',
      status: ScheduleStatus.ASSIGNED,
      service: { title: 'Culto Domingo 19h' },
      servant: { id: 'servant-1', name: 'Servo 1' },
      sector: { id: 'sector-1', name: 'Louvor' },
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
      sectorId: 'sector-1',
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
      sectorId: 'sector-1',
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
      mainSectorId: 'sector-1',
      servantSectors: [],
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
      sectorId: 'sector-1',
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
    prisma.schedule.findFirst.mockReset();
    prisma.schedule.findUnique.mockReset();
    prisma.scheduleSwapHistory.findMany.mockReset();
    prisma.auditLog.findMany.mockReset();
    (notificationsService.create as jest.Mock).mockReset();
    (notificationsService.createMany as jest.Mock).mockReset();
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset();
    service = new SchedulesService(prisma, auditService, notificationsService);
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
    sector: {
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
    prisma.worshipService.findMany.mockReset();
    prisma.scheduleSlot.findMany.mockReset();
    prisma.schedule.findMany.mockReset();
    prisma.sector.findMany.mockReset();
    prisma.sector.findMany.mockResolvedValue([]);
    (resolveScopedSectorIds as jest.Mock).mockReset();
    service = new SchedulesService(prisma, auditService, notificationsService);
  });

  it('infers coordinator ministry automatically when only one scope is available', async () => {
    const actor: JwtPayload = {
      sub: 'coord-1',
      email: 'coord@wcservus.com',
      role: Role.COORDENADOR,
      servantId: null,
    };

    (resolveScopedSectorIds as jest.Mock).mockResolvedValue(['sector-1']);
    prisma.worshipService.findMany.mockResolvedValue([]);
    prisma.scheduleSlot.findMany.mockResolvedValue([]);
    prisma.schedule.findMany.mockResolvedValue([]);

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31' },
        actor,
      ),
    ).resolves.toEqual([]);

    expect(resolveScopedSectorIds).toHaveBeenCalled();
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

    (resolveScopedSectorIds as jest.Mock).mockResolvedValue(['sector-1', 'sector-2']);

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

    (resolveScopedSectorIds as jest.Mock).mockResolvedValue(['sector-1']);

    await expect(
      service.servicesOperationalStatus(
        { startDate: '2026-03-01', endDate: '2026-03-31', ministryId: 'sector-2' },
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

    (resolveScopedSectorIds as jest.Mock).mockResolvedValue([]);

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
        { startDate: '2026-03-01', endDate: '2026-03-31', ministryId: 'sector-1' },
        actor,
      ),
    ).resolves.toEqual([]);
  });
});
