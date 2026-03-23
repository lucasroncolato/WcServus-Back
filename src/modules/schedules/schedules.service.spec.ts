import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, Role, ScheduleStatus } from '@prisma/client';
import { SchedulesService } from './schedules.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

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
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

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
    prisma.sector.findMany.mockReset();
    (auditService.log as jest.Mock).mockReset();
    (auditService.log as jest.Mock).mockResolvedValue(undefined);
    service = new SchedulesService(prisma, auditService);
  });

  it('should duplicate schedule successfully', async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      serviceId: 'service-a',
      servantId: 'servant-1',
      sectorId: 'sector-1',
      classGroup: 'A',
      service: { id: 'service-a' },
    });
    prisma.worshipService.findUnique.mockResolvedValue({ id: 'service-b' });
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-1',
      status: 'ATIVO',
      trainingStatus: 'COMPLETED',
      mainSectorId: 'sector-1',
      servantSectors: [],
    });
    prisma.schedule.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.schedule.create.mockResolvedValue({
      id: 'schedule-2',
      status: ScheduleStatus.ASSIGNED,
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
      classGroup: 'A',
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
      classGroup: 'A',
      service: { id: 'service-a' },
    });
    prisma.schedule.findFirst.mockResolvedValue({ id: 'existing-schedule' });
    prisma.worshipService.findUnique.mockResolvedValue({ id: 'service-b' });
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-1',
      status: 'ATIVO',
      trainingStatus: 'COMPLETED',
      mainSectorId: 'sector-1',
      servantSectors: [],
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
      classGroup: 'A',
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
    service = new SchedulesService(prisma, auditService);
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
