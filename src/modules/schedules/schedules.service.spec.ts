import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, ScheduleStatus } from '@prisma/client';
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

    expect(result).toEqual({ id: 'schedule-2', status: ScheduleStatus.ASSIGNED });
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
