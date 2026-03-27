import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, ServantStatus, TrainingStatus, UserStatus } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ServantsService } from './servants.service';

describe('ServantsService - training completion flow', () => {
  const prisma = {
    servant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    servantSector: {
      update: jest.fn(),
      findMany: jest.fn(),
    },
    servantStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: ServantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.servant.findUnique.mockReset();
    prisma.servant.update.mockReset();
    prisma.servantSector.update.mockReset();
    prisma.servantSector.findMany.mockReset();
    prisma.servantStatusHistory.create.mockReset();
    prisma.$transaction.mockReset();
    (auditService.log as jest.Mock).mockReset().mockResolvedValue(undefined);
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new ServantsService(prisma, configService, auditService, notificationsService);
  });

  it('promotes RECRUTAMENTO to ATIVO when training is completed', async () => {
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-1',
      status: ServantStatus.RECRUTAMENTO,
      trainingStatus: TrainingStatus.PENDING,
      approvalStatus: 'APPROVED',
      mainSectorId: 'sector-1',
      servantSectors: [{ id: 'ss-1', sectorId: 'sector-1', trainingStatus: TrainingStatus.PENDING }],
    });

    const tx = {
      servant: {
        update: jest.fn().mockResolvedValue({
          id: 'servant-1',
          name: 'Servo 1',
          status: ServantStatus.ATIVO,
          trainingStatus: TrainingStatus.COMPLETED,
          teamId: null,
          mainSector: null,
          team: null,
          servantSectors: [],
          userAccount: null,
        }),
      },
      servantSector: {
        update: jest.fn().mockResolvedValue({
          id: 'ss-1',
          servantId: 'servant-1',
          sectorId: 'sector-1',
          trainingStatus: TrainingStatus.COMPLETED,
        }),
        findMany: jest.fn().mockResolvedValue([{ trainingStatus: TrainingStatus.COMPLETED }]),
      },
      servantStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await service.completeTraining('servant-1', { ministryId: 'sector-1' }, actor);

    expect(tx.servant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'servant-1' },
        data: expect.objectContaining({
          trainingStatus: TrainingStatus.COMPLETED,
          status: ServantStatus.ATIVO,
        }),
      }),
    );
    expect(tx.servantStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          servantId: 'servant-1',
          fromStatus: ServantStatus.RECRUTAMENTO,
          toStatus: ServantStatus.ATIVO,
        }),
      }),
    );
    expect(result.trainingStatus).toBe(TrainingStatus.COMPLETED);
    expect(result.status).toBe('ACTIVE');
  });

  it('does not force status change when servant is AFASTADO', async () => {
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-2',
      status: ServantStatus.AFASTADO,
      trainingStatus: TrainingStatus.PENDING,
      approvalStatus: 'APPROVED',
      mainSectorId: 'sector-2',
      servantSectors: [{ id: 'ss-2', sectorId: 'sector-2', trainingStatus: TrainingStatus.PENDING }],
    });

    const tx = {
      servant: {
        update: jest.fn().mockResolvedValue({
          id: 'servant-2',
          name: 'Servo 2',
          status: ServantStatus.AFASTADO,
          trainingStatus: TrainingStatus.COMPLETED,
          teamId: null,
          mainSector: null,
          team: null,
          servantSectors: [],
          userAccount: null,
        }),
      },
      servantStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-2' }),
      },
      servantSector: {
        update: jest.fn().mockResolvedValue({
          id: 'ss-2',
          servantId: 'servant-2',
          sectorId: 'sector-2',
          trainingStatus: TrainingStatus.COMPLETED,
        }),
        findMany: jest.fn().mockResolvedValue([{ trainingStatus: TrainingStatus.COMPLETED }]),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await service.completeTraining('servant-2', { ministryId: 'sector-2' }, actor);

    expect(tx.servant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trainingStatus: TrainingStatus.COMPLETED,
        }),
      }),
    );
    expect(tx.servantStatusHistory.create).not.toHaveBeenCalled();
    expect(result.trainingStatus).toBe(TrainingStatus.COMPLETED);
    expect(result.status).toBe('INACTIVE');
  });

  it('returns 404 when completing training for unknown servant', async () => {
    prisma.servant.findUnique.mockResolvedValue(null);

    await expect(service.completeTraining('missing', {}, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ServantsService - profile update with training completion', () => {
  const prisma = {
    servant: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    servantSector: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    servantStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const actor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: ServantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.servant.findUnique.mockReset();
    prisma.servant.update.mockReset();
    prisma.servant.findUniqueOrThrow.mockReset();
    prisma.servantSector.deleteMany.mockReset();
    prisma.servantSector.createMany.mockReset();
    prisma.servantStatusHistory.create.mockReset();
    prisma.$transaction.mockReset();
    (auditService.log as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new ServantsService(prisma, configService, auditService, notificationsService);
  });

  it('auto-promotes to ATIVO when update receives trainingStatus=COMPLETED and no explicit status', async () => {
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-3',
      status: ServantStatus.RECICLAGEM,
      teamId: null,
      mainSectorId: null,
      servantSectors: [],
    });

    const tx = {
      servant: {
        update: jest.fn().mockResolvedValue({ id: 'servant-3' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'servant-3',
          name: 'Servo 3',
          status: ServantStatus.ATIVO,
          trainingStatus: TrainingStatus.COMPLETED,
          teamId: null,
          mainSector: null,
          team: null,
          servantSectors: [],
          userAccount: {
            id: 'user-3',
            name: 'User 3',
            email: 'user3@test.com',
            role: Role.SERVO,
            status: UserStatus.ACTIVE,
          },
        }),
      },
      servantSector: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      servantStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-3' }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await service.update(
      'servant-3',
      {
        trainingStatus: TrainingStatus.COMPLETED,
      },
      actor,
    );

    expect(tx.servant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trainingStatus: TrainingStatus.COMPLETED,
          status: ServantStatus.ATIVO,
        }),
      }),
    );
    expect(tx.servantStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          servantId: 'servant-3',
          fromStatus: ServantStatus.RECICLAGEM,
          toStatus: ServantStatus.ATIVO,
        }),
      }),
    );
    expect(result.status).toBe('ACTIVE');
    expect(result.trainingStatus).toBe(TrainingStatus.COMPLETED);
  });
});
