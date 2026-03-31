import 'reflect-metadata';
import { Role } from '@prisma/client';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { PastoralController } from './pastoral.controller';

describe('PastoralController roles metadata', () => {
  it('guards class and methods without exposing to SERVO', () => {
    const classRoles: Role[] = Reflect.getMetadata(ROLES_KEY, PastoralController);
    expect(classRoles).toEqual([Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR]);
    expect(classRoles).not.toContain(Role.SERVO);

    const resolveAlertRoles: Role[] = Reflect.getMetadata(
      ROLES_KEY,
      PastoralController.prototype.resolveAlert,
    ) ?? classRoles;
    expect(resolveAlertRoles).not.toContain(Role.SERVO);
  });
});