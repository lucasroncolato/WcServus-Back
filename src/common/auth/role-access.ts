import { Role } from '@prisma/client';

const ROLE_HIERARCHY: Record<Role, Role[]> = {
  [Role.SUPER_ADMIN]: [
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.PASTOR,
    Role.COORDENADOR,
  ],
  [Role.ADMIN]: [Role.ADMIN, Role.PASTOR, Role.COORDENADOR],
  [Role.PASTOR]: [Role.PASTOR],
  [Role.COORDENADOR]: [Role.COORDENADOR],
  [Role.SERVO]: [Role.SERVO],
};

export function hasRoleAccess(userRole: Role, requiredRoles: Role[]) {
  const allowedRoles = ROLE_HIERARCHY[userRole] ?? [userRole];
  return requiredRoles.some((requiredRole) => allowedRoles.includes(requiredRole));
}
