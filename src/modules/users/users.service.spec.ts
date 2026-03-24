import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, UserScope, UserStatus } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';

describe('UsersService - updateRole', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const adminActor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: Role.ADMIN,
    servantId: null,
  };

  const superAdminActor: JwtPayload = {
    sub: 'super-1',
    email: 'super@test.com',
    role: Role.SUPER_ADMIN,
    servantId: null,
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockReset();
    prisma.user.update.mockReset();
    (auditService.log as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new UsersService(prisma, auditService);
  });

  it('permite ADMIN alterar role de usuario abaixo do seu nivel', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.LIDER });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      name: 'User',
      email: 'user@test.com',
      role: Role.SERVO,
      scope: UserScope.GLOBAL,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      phone: null,
      sectorTeam: null,
      servantId: null,
      lastLoginAt: null,
      servant: null,
      scopeBindings: [],
      permissionOverrides: [],
      createdAt: new Date('2026-03-23T00:00:00.000Z'),
      updatedAt: new Date('2026-03-23T00:00:00.000Z'),
    });

    const result = await service.updateRole('user-1', { role: Role.SERVO }, adminActor);

    expect(result.data.role).toBe(Role.SERVO);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { role: Role.SERVO },
      }),
    );
  });

  it('bloqueia ADMIN promover para ADMIN (mesmo nivel)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.LIDER });

    await expect(service.updateRole('user-1', { role: Role.ADMIN }, adminActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('bloqueia ADMIN editar usuario ADMIN (mesmo nivel)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2', role: Role.ADMIN });

    await expect(service.updateRole('user-2', { role: Role.SERVO }, adminActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('permite SUPER_ADMIN promover para SUPER_ADMIN', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-3', role: Role.ADMIN });
    prisma.user.update.mockResolvedValue({
      id: 'user-3',
      name: 'User',
      email: 'user3@test.com',
      role: Role.SUPER_ADMIN,
      scope: UserScope.GLOBAL,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      phone: null,
      sectorTeam: null,
      servantId: null,
      lastLoginAt: null,
      servant: null,
      scopeBindings: [],
      permissionOverrides: [],
      createdAt: new Date('2026-03-23T00:00:00.000Z'),
      updatedAt: new Date('2026-03-23T00:00:00.000Z'),
    });

    const result = await service.updateRole('user-3', { role: Role.SUPER_ADMIN }, superAdminActor);

    expect(result.data.role).toBe(Role.SUPER_ADMIN);
  });

  it('bloqueia alteracao do proprio usuario', async () => {
    await expect(service.updateRole('admin-1', { role: Role.SERVO }, adminActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('retorna 404 para usuario alvo inexistente', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.updateRole('missing', { role: Role.SERVO }, adminActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('UsersService - compatibility safeguards', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const adminActor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockReset().mockResolvedValue([]);
    prisma.user.count.mockReset().mockResolvedValue(0);
    prisma.user.findUnique.mockReset().mockResolvedValue({
      scope: UserScope.GLOBAL,
      servantId: null,
      scopeBindings: [],
      permissionOverrides: [],
    });
    prisma.$transaction.mockReset().mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
    service = new UsersService(prisma, auditService);
  });

  it('GET /users sem status filtra ACTIVE por padrao', async () => {
    await service.findAll({}, adminActor);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: UserStatus.ACTIVE }),
      }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: UserStatus.ACTIVE }),
    });
  });

  it('PATCH /users/:id bloqueia mudanca de role fora do endpoint dedicado', async () => {
    await expect(service.update('user-1', { role: Role.SUPER_ADMIN }, adminActor.sub)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('UsersService - resetPassword', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const adminActor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: Role.ADMIN,
    servantId: null,
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockReset();
    prisma.$transaction.mockReset();
    (auditService.log as jest.Mock).mockReset().mockResolvedValue(undefined);
    service = new UsersService(prisma, auditService);
  });

  it('reseta senha com mustChangePassword=true por padrao', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.$transaction.mockResolvedValue({
      id: 'user-1',
      name: 'User',
      email: 'user@test.com',
      role: Role.SERVO,
      scope: UserScope.GLOBAL,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      phone: null,
      sectorTeam: null,
      servantId: null,
      lastLoginAt: null,
      servant: null,
      scopeBindings: [],
      permissionOverrides: [],
      createdAt: new Date('2026-03-23T00:00:00.000Z'),
      updatedAt: new Date('2026-03-23T00:00:00.000Z'),
    });

    const result = await service.resetPassword('user-1', { password: 'novaSenha123' }, adminActor.sub);

    expect(result.data.mustChangePassword).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('bloqueia reset administrativo da propria conta', async () => {
    await expect(
      service.resetPassword(adminActor.sub, { password: 'novaSenha123' }, adminActor.sub),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
