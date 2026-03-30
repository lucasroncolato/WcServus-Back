import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, ServantStatus, TrainingStatus, UserStatus } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ServantActiveStatusDto } from './dto/create-servant.dto';
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
  const eventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
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
    (eventBus.emit as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new ServantsService(prisma, configService, auditService, notificationsService, eventBus);
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
  const eventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
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
    (eventBus.emit as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new ServantsService(prisma, configService, auditService, notificationsService, eventBus);
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

describe('ServantsService - createWithUser canonical flow', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    ministry: {
      findMany: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const configService = {
    get: jest.fn().mockReturnValue('Temp@1234'),
  } as unknown as ConfigService;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    notifyServantLinkedUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;
  const eventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as any;

  const tenantIntegrity = {
    assertActorChurch: jest.fn().mockReturnValue('church-a'),
    assertSameChurch: jest.fn(),
    assertLinkIntegrity: jest.fn(),
  } as any;

  const actor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@wcservus.com',
    role: Role.ADMIN,
    servantId: null,
    churchId: 'church-a',
  };

  let service: ServantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockReset().mockResolvedValue(null);
    prisma.ministry.findMany.mockReset().mockResolvedValue([{ id: 'ministry-1', churchId: 'church-a' }]);
    prisma.team.findUnique.mockReset();
    prisma.$transaction.mockReset();
    (auditService.log as jest.Mock).mockReset().mockResolvedValue(undefined);
    (eventBus.emit as jest.Mock).mockReset().mockResolvedValue(undefined);
    tenantIntegrity.assertActorChurch.mockReset().mockReturnValue('church-a');
    tenantIntegrity.assertSameChurch.mockReset();
    service = new ServantsService(
      prisma,
      configService,
      auditService,
      notificationsService,
      eventBus,
      tenantIntegrity,
    );
  });

  it('creates servant and linked user in a single transaction', async () => {
    const tx = {
      servant: {
        create: jest.fn().mockResolvedValue({
          id: 'servant-1',
          status: ServantStatus.ATIVO,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'servant-1',
          churchId: 'church-a',
          name: 'Novo Servo',
          phone: '11999999999',
          status: ServantStatus.ATIVO,
          trainingStatus: TrainingStatus.PENDING,
          approvalStatus: 'APPROVED',
          approvalRequestedByUserId: null,
          approvedByUserId: 'admin-1',
          approvalUpdatedAt: new Date(),
          approvalNotes: null,
          aptitude: null,
          teamId: null,
          mainMinistryId: 'ministry-1',
          notes: null,
          joinedAt: null,
          gender: null,
          birthDate: null,
          consecutiveAbsences: 0,
          monthlyAbsences: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
          mainMinistry: { id: 'ministry-1', name: 'Louvor' },
          team: null,
          servantMinistries: [
            {
              ministryId: 'ministry-1',
              trainingStatus: TrainingStatus.PENDING,
              trainingCompletedAt: null,
              trainingReviewedByUserId: null,
              trainingNotes: null,
              ministry: { id: 'ministry-1', name: 'Louvor' },
            },
          ],
          userAccount: {
            id: 'user-1',
            name: 'Novo Servo',
            email: 'novo@servus.app',
            role: Role.SERVO,
            status: UserStatus.ACTIVE,
          },
        }),
      },
      servantMinistry: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      servantStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await service.createWithUser(
      {
        name: 'Novo Servo',
        phone: '11999999999',
        status: ServantActiveStatusDto.ACTIVE,
        ministryIds: ['ministry-1'],
        user: {
          email: 'novo@servus.app',
          name: 'Novo Servo',
          role: Role.SERVO,
        },
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          servantId: 'servant-1',
          role: Role.SERVO,
        }),
      }),
    );
    expect(result).toMatchObject({
      message: 'Servant and user created successfully',
      data: {
        id: 'servant-1',
        linkedUserEmail: 'novo@servus.app',
      },
    });
    expect(auditService.log).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SERVANT_CREATED',
      }),
    );
  });

  it('rolls back when user creation fails inside transaction', async () => {
    const tx = {
      servant: {
        create: jest.fn().mockResolvedValue({
          id: 'servant-rollback-user',
          status: ServantStatus.ATIVO,
        }),
        findUniqueOrThrow: jest.fn(),
      },
      servantMinistry: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      servantStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-rollback-user' }),
      },
      user: {
        create: jest.fn().mockRejectedValue(new Error('User create failure')),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    await expect(
      service.createWithUser(
        {
          name: 'Servo rollback',
          status: ServantActiveStatusDto.ACTIVE,
          ministryIds: ['ministry-1'],
          user: {
            email: 'rollback-user@servus.app',
            name: 'Servo rollback',
            role: Role.SERVO,
          },
        },
        actor,
      ),
    ).rejects.toThrow('User create failure');

    expect(auditService.log).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('rolls back when servant creation fails inside transaction', async () => {
    const tx = {
      servant: {
        create: jest.fn().mockRejectedValue(new Error('Servant create failure')),
      },
      servantMinistry: {
        createMany: jest.fn(),
      },
      servantStatusHistory: {
        create: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    await expect(
      service.createWithUser(
        {
          name: 'Servo rollback 2',
          status: ServantActiveStatusDto.ACTIVE,
          ministryIds: ['ministry-1'],
          user: {
            email: 'rollback-servant@servus.app',
            name: 'Servo rollback 2',
            role: Role.SERVO,
          },
        },
        actor,
      ),
    ).rejects.toThrow('Servant create failure');

    expect(auditService.log).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('blocks duplicated email before transaction start', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' });

    await expect(
      service.createWithUser(
        {
          name: 'Duplicado',
          ministryIds: ['ministry-1'],
          user: {
            email: 'duplicado@servus.app',
            name: 'Duplicado',
            role: Role.SERVO,
          },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks creation when ministry belongs to another tenant', async () => {
    prisma.ministry.findMany.mockResolvedValueOnce([{ id: 'ministry-1', churchId: 'church-b' }]);
    tenantIntegrity.assertSameChurch.mockImplementation(
      (actorChurchId: string, entityChurchId: string) => {
        if (actorChurchId !== entityChurchId) {
          throw new ForbiddenException('Ministry belongs to another church');
        }
      },
    );

    await expect(
      service.createWithUser(
        {
          name: 'Outro Tenant',
          ministryIds: ['ministry-1'],
          user: {
            email: 'tenant@servus.app',
            name: 'Outro Tenant',
            role: Role.SERVO,
          },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});


