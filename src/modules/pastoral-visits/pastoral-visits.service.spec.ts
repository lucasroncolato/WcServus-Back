import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlertStatus, Role } from '@prisma/client';
import { assertServantAccess, getPastoralVisitAccessWhere, getServantAccessWhere } from 'src/common/auth/access-scope';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PastoralVisitsService } from './pastoral-visits.service';

jest.mock('src/common/auth/access-scope', () => ({
  assertServantAccess: jest.fn().mockResolvedValue(undefined),
  getPastoralVisitAccessWhere: jest.fn().mockResolvedValue(undefined),
  getServantAccessWhere: jest.fn().mockResolvedValue(undefined),
}));

describe('PastoralVisitsService', () => {
  const prisma = {
    servant: { findUnique: jest.fn() },
    pastoralVisit: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    pastoralAlert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    pastoralNote: { create: jest.fn() },
    pastoralFollowUp: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    attendance: { findFirst: jest.fn() },
  } as any;

  const tenantIntegrity = {
    assertActorChurch: jest.fn(),
    assertSameChurch: jest.fn(),
    assertServantChurch: jest.fn(),
  } as any;

  const auditService = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const notificationsService = { notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined) } as any;
  const eventBus = { emit: jest.fn().mockResolvedValue(undefined) } as any;

  const adminActor: JwtPayload = {
    sub: 'admin-1',
    role: Role.ADMIN,
    email: 'admin@test.com',
    churchId: 'church-1',
    servantId: null,
  };

  let service: PastoralVisitsService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantIntegrity.assertActorChurch.mockReturnValue('church-1');
    tenantIntegrity.assertSameChurch.mockImplementation((a: string, b: string) => {
      if (a !== b) {
        throw new ForbiddenException('Tenant mismatch');
      }
    });
    tenantIntegrity.assertServantChurch.mockResolvedValue(undefined);

    prisma.servant.findUnique.mockReset();
    prisma.pastoralVisit.findMany.mockReset();
    prisma.pastoralVisit.findUnique.mockReset();
    prisma.pastoralVisit.create.mockReset();
    prisma.pastoralVisit.update.mockReset();
    prisma.pastoralVisit.count.mockReset().mockResolvedValue(0);
    prisma.pastoralAlert.findMany.mockReset();
    prisma.pastoralAlert.findUnique.mockReset();
    prisma.pastoralAlert.update.mockReset();
    prisma.pastoralAlert.updateMany.mockReset().mockResolvedValue({ count: 0 });
    prisma.pastoralAlert.count.mockReset().mockResolvedValue(0);
    prisma.pastoralNote.create.mockReset();
    prisma.pastoralFollowUp.create.mockReset();
    prisma.pastoralFollowUp.findMany.mockReset();
    prisma.pastoralFollowUp.findUnique.mockReset();
    prisma.pastoralFollowUp.update.mockReset();
    prisma.pastoralFollowUp.count.mockReset().mockResolvedValue(0);
    prisma.attendance.findFirst.mockReset().mockResolvedValue(null);

    (assertServantAccess as jest.Mock).mockResolvedValue(undefined);
    (getPastoralVisitAccessWhere as jest.Mock).mockResolvedValue(undefined);
    (getServantAccessWhere as jest.Mock).mockResolvedValue(undefined);

    service = new PastoralVisitsService(
      prisma,
      tenantIntegrity,
      auditService,
      notificationsService,
      eventBus,
    );
  });

  it('creates pastoral record with tenant and scope checks', async () => {
    prisma.servant.findUnique.mockResolvedValue({ id: 'serv-1', churchId: 'church-1' });
    prisma.pastoralVisit.create.mockResolvedValue({
      id: 'rec-1',
      servantId: 'serv-1',
      churchId: 'church-1',
      status: 'ABERTA',
      priority: 'HIGH',
      reasonType: 'NO_SHOW',
    });

    const result = await service.createRecord(
      {
        servantId: 'serv-1',
        reason: 'No-show recorrente',
        priority: 'HIGH',
        reasonType: 'NO_SHOW',
      },
      adminActor,
    );

    expect(result.id).toBe('rec-1');
    expect(assertServantAccess).toHaveBeenCalledWith(prisma, adminActor, 'serv-1');
    expect(prisma.pastoralVisit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ churchId: 'church-1', priority: 'HIGH', reasonType: 'NO_SHOW' }),
      }),
    );
    expect(eventBus.emit).toHaveBeenCalled();
  });

  it('blocks coordinator out of scope when assertServantAccess denies', async () => {
    (assertServantAccess as jest.Mock).mockRejectedValueOnce(new ForbiddenException('out of scope'));

    await expect(
      service.createRecord(
        {
          servantId: 'serv-out',
          reason: 'Teste',
        },
        { ...adminActor, role: Role.COORDENADOR },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists alerts with servant scope where clause', async () => {
    (getServantAccessWhere as jest.Mock).mockResolvedValue({ mainMinistryId: { in: ['min-1'] } });
    prisma.pastoralAlert.findMany.mockResolvedValue([]);

    await service.listAlerts({ status: AlertStatus.OPEN }, adminActor);

    expect(prisma.pastoralAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: AlertStatus.OPEN,
          servant: { mainMinistryId: { in: ['min-1'] } },
        }),
      }),
    );
  });

  it('resolves alert and stores resolver metadata', async () => {
    prisma.pastoralAlert.findUnique.mockResolvedValue({
      id: 'alert-1',
      churchId: 'church-1',
      servantId: 'serv-1',
      metadata: null,
    });
    prisma.pastoralAlert.update.mockResolvedValue({ id: 'alert-1', status: AlertStatus.RESOLVED, resolvedByUserId: 'admin-1' });

    const result = await service.resolveAlert('alert-1', { resolutionNotes: 'Contato realizado' }, adminActor);

    expect(result.status).toBe(AlertStatus.RESOLVED);
    expect(prisma.pastoralAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AlertStatus.RESOLVED,
          resolvedByUserId: 'admin-1',
        }),
      }),
    );
  });

  it('denies resolving alert from another tenant', async () => {
    prisma.pastoralAlert.findUnique.mockResolvedValue({
      id: 'alert-2',
      churchId: 'church-2',
      servantId: 'serv-1',
      metadata: null,
    });

    await expect(service.resolveAlert('alert-2', {}, adminActor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('adds note with author and church from case', async () => {
    prisma.pastoralVisit.findUnique.mockResolvedValue({
      id: 'rec-10',
      servantId: 'serv-1',
      churchId: 'church-1',
      servant: { id: 'serv-1' },
    });
    prisma.pastoralNote.create.mockResolvedValue({ id: 'note-1', note: 'Acompanhamento realizado' });

    const note = await service.addNote('rec-10', { note: 'Acompanhamento realizado' }, adminActor);

    expect(note.id).toBe('note-1');
    expect(prisma.pastoralNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pastoralVisitId: 'rec-10',
          churchId: 'church-1',
          authorUserId: 'admin-1',
        }),
      }),
    );
  });

  it('creates and completes follow-up linked to record', async () => {
    prisma.pastoralVisit.findUnique.mockResolvedValue({
      id: 'rec-11',
      servantId: 'serv-1',
      churchId: 'church-1',
      status: 'ABERTA',
      servant: { id: 'serv-1' },
    });
    prisma.pastoralFollowUp.create.mockResolvedValue({ id: 'fu-1', scheduledAt: new Date('2026-04-08T19:00:00.000Z') });
    prisma.pastoralVisit.update.mockResolvedValue({ id: 'rec-11' });
    prisma.pastoralFollowUp.findUnique.mockResolvedValue({
      id: 'fu-1',
      churchId: 'church-1',
      notes: 'retorno',
      pastoralVisit: { servantId: 'serv-1' },
    });
    prisma.pastoralFollowUp.update.mockResolvedValue({ id: 'fu-1', status: 'DONE' });

    await service.addFollowUp('rec-11', { scheduledAt: '2026-04-08T19:00:00.000Z' }, adminActor);
    const completed = await service.completeFollowUp('fu-1', { notes: 'ok' }, adminActor);

    expect(completed.status).toBe('DONE');
    expect(prisma.pastoralFollowUp.update).toHaveBeenCalled();
  });

  it('returns not found when record detail does not exist', async () => {
    prisma.pastoralVisit.findUnique.mockResolvedValue(null);
    await expect(service.getRecordById('missing', adminActor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns servant summary without cross-tenant leak', async () => {
    prisma.attendance.findFirst.mockResolvedValue({ status: 'NO_SHOW', createdAt: new Date('2026-04-01T00:00:00.000Z') });

    const summary = await service.summaryByServant('serv-1', adminActor);

    expect(assertServantAccess).toHaveBeenCalledWith(prisma, adminActor, 'serv-1');
    expect(summary).toEqual(
      expect.objectContaining({
        servantId: 'serv-1',
        openCases: 0,
        inProgressCases: 0,
        openAlerts: 0,
      }),
    );
  });
});