import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { capabilities } from 'src/common/auth/capabilities';
import { CAPABILITIES_KEY } from 'src/common/decorators/require-capabilities.decorator';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ServantUserIntegrityController } from './servant-user-integrity.controller';

describe('ServantUserIntegrityController', () => {
  const integrityService = {
    listDetails: jest.fn().mockResolvedValue([]),
    listSummary: jest.fn().mockResolvedValue([]),
    runScan: jest.fn().mockResolvedValue({
      status: 'healthy',
      totals: { blocking: 0, manualReview: 0, total: 0 },
      byIssueType: [],
    }),
  } as any;

  const controller = new ServantUserIntegrityController(integrityService);

  const adminActor: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: Role.ADMIN,
    servantId: null,
    churchId: 'church-1',
  };

  const superAdminActor: JwtPayload = {
    sub: 'super-1',
    email: 'super@test.com',
    role: Role.SUPER_ADMIN,
    servantId: null,
    churchId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires SUPER_ADMIN or ADMIN role and integrity capability metadata', () => {
    const classRoles = Reflect.getMetadata(ROLES_KEY, ServantUserIntegrityController);
    const classCapabilities = Reflect.getMetadata(CAPABILITIES_KEY, ServantUserIntegrityController);

    expect(classRoles).toEqual([Role.SUPER_ADMIN, Role.ADMIN]);
    expect(classCapabilities).toEqual([capabilities.integrityReadChurch]);
  });

  it('enforces tenant filter for ADMIN users', async () => {
    await controller.summary(adminActor, {
      churchId: 'church-1',
      severity: undefined,
    });

    expect(integrityService.listSummary).toHaveBeenCalledWith({
      churchId: 'church-1',
      severity: undefined,
    });
    expect(integrityService.runScan).toHaveBeenCalledWith({ churchId: 'church-1' });
  });

  it('blocks ADMIN from querying another church', async () => {
    await expect(
      controller.details(adminActor, {
        churchId: 'church-2',
        severity: undefined,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows SUPER_ADMIN to query any church', async () => {
    await controller.summary(superAdminActor, {
      churchId: 'church-xyz',
      severity: 'blocking',
    });

    expect(integrityService.listSummary).toHaveBeenCalledWith({
      churchId: 'church-xyz',
      severity: 'blocking',
    });
    expect(integrityService.runScan).toHaveBeenCalledWith({ churchId: 'church-xyz' });
  });
});
