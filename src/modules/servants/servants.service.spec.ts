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
    servantMinistry: {
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
  const gamificationService = {
    awardPoints: jest.fn().mockResolvedValue(undefined),
  } as any;

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
    prisma.servantMinistry.update.mockReset();
    prisma.servantMinistry.findMany.mockReset();
    prisma.servantStatusHistory.create.mockReset();
    prisma.$transaction.mockReset();
    (auditService.log as jest.Mock).mockReset().mockResolvedValue(undefined);
    (notificationsService.notifyServantLinkedUser as jest.Mock).mockReset().mockResolvedValue(undefined);
    (gamificationService.awardPoints as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new ServantsService(prisma, configService, auditService, notificationsService, gamificationService);
  });

  it('promotes RECRUTAMENTO to ATIVO when training is completed', async () => {
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-1',
      status: ServantStatus.RECRUTAMENTO,
      trainingStatus: TrainingStatus.PENDING,
      approvalStatus: 'APPROVED',
      mainMinistryId: 'ministry-1',
      servantMinistries: [{ id: 'ss-1', ministryId: 'ministry-1', trainingStatus: TrainingStatus.PENDING }],
    });

    const tx = {
      servant: {
        update: jest.fn().mockResolvedValue({
          id: 'servant-1',
          name: 'Servo 1',
          status: ServantStatus.ATIVO,
          trainingStatus: TrainingStatus.COMPLETED,
          teamId: null,
          mainMinistry: null,
          team: null,
          servantMinistries: [],
          userAccount: null,
        }),
      },
      servantMinistry: {
        update: jest.fn().mockResolvedValue({
          id: 'ss-1',
          servantId: 'servant-1',
          ministryId: 'ministry-1',
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

    const result = await service.completeTraining('servant-1', { ministryId: 'ministry-1' }, actor);

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
      mainMinistryId: 'ministry-2',
      servantMinistries: [{ id: 'ss-2', ministryId: 'ministry-2', trainingStatus: TrainingStatus.PENDING }],
    });

    const tx = {
      servant: {
        update: jest.fn().mockResolvedValue({
          id: 'servant-2',
          name: 'Servo 2',
          status: ServantStatus.AFASTADO,
          trainingStatus: TrainingStatus.COMPLETED,
          teamId: null,
          mainMinistry: null,
          team: null,
          servantMinistries: [],
          userAccount: null,
        }),
      },
      servantStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-2' }),
      },
      servantMinistry: {
        update: jest.fn().mockResolvedValue({
          id: 'ss-2',
          servantId: 'servant-2',
          ministryId: 'ministry-2',
          trainingStatus: TrainingStatus.COMPLETED,
        }),
        findMany: jest.fn().mockResolvedValue([{ trainingStatus: TrainingStatus.COMPLETED }]),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await service.completeTraining('servant-2', { ministryId: 'ministry-2' }, actor);

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
    servantMinistry: {
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
  const gamificationService = {
    awardPoints: jest.fn().mockResolvedValue(undefined),
  } as any;

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
    prisma.servantMinistry.deleteMany.mockReset();
    prisma.servantMinistry.createMany.mockReset();
    prisma.servantStatusHistory.create.mockReset();
    prisma.$transaction.mockReset();
    (auditService.log as jest.Mock).mockReset().mockResolvedValue(undefined);
    (gamificationService.awardPoints as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new ServantsService(prisma, configService, auditService, notificationsService, gamificationService);
  });

  it('auto-promotes to ATIVO when update receives trainingStatus=COMPLETED and no explicit status', async () => {
    prisma.servant.findUnique.mockResolvedValue({
      id: 'servant-3',
      status: ServantStatus.RECICLAGEM,
      teamId: null,
      mainMinistryId: null,
      servantMinistries: [],
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
          mainMinistry: null,
          team: null,
          servantMinistries: [],
          userAccount: {
            id: 'user-3',
            name: 'User 3',
            email: 'user3@test.com',
            role: Role.SERVO,
            status: UserStatus.ACTIVE,
          },
        }),
      },
      servantMinistry: {
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


