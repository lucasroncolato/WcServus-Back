import { Role } from '@prisma/client';

const ROLE_ALIASES: Record<string, Role> = {
  SUPER_ADMIN: Role.SUPER_ADMIN,
  SUPERADMIN: Role.SUPER_ADMIN,
  'SUPER-ADMIN': Role.SUPER_ADMIN,
  ADMIN: Role.ADMIN,
  ADMINISTRATOR: Role.ADMIN,
  PASTOR: Role.PASTOR,
  COORDENADOR: Role.COORDENADOR,
  COORDINATOR: Role.COORDENADOR,
  LIDER: Role.LIDER,
  LIDERANCA: Role.LIDER,
  LEADER: Role.LIDER,
  SERVO: Role.SERVO,
  SERVANT: Role.SERVO,
};

export function normalizeRoleAlias(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toUpperCase();
  return ROLE_ALIASES[normalized] ?? normalized;
}
