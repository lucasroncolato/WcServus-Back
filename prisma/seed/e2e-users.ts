export const E2E_DEFAULT_PASSWORD = '123456';

export type E2ERole = 'SUPER_ADMIN' | 'ADMIN' | 'PASTOR' | 'COORDENADOR' | 'SERVO';

export interface E2EUserFixture {
  role: E2ERole;
  userId: string;
  email: string;
  password: string;
  churchId: string;
  scope: 'GLOBAL' | 'MINISTRY' | 'EQUIPE' | 'SELF';
  ministryId?: string;
  teamId?: string;
  servantId?: string;
  notes?: string;
}

export const E2E_USER_FIXTURES: Record<E2ERole, E2EUserFixture> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    userId: 'seed_user_super_admin',
    email: 'superadmin@servos.local',
    password: E2E_DEFAULT_PASSWORD,
    churchId: 'seed_church_central',
    scope: 'GLOBAL',
    notes: 'Acesso de plataforma/multi-tenant.',
  },
  ADMIN: {
    role: 'ADMIN',
    userId: 'seed_user_admin_central',
    email: 'admin.central@servos.local',
    password: E2E_DEFAULT_PASSWORD,
    churchId: 'seed_church_central',
    scope: 'GLOBAL',
    notes: 'Admin da igreja central para fluxos globais por tenant.',
  },
  PASTOR: {
    role: 'PASTOR',
    userId: 'seed_user_pastor_central',
    email: 'pastor.central@servos.local',
    password: E2E_DEFAULT_PASSWORD,
    churchId: 'seed_church_central',
    scope: 'GLOBAL',
    notes: 'Visao pastoral e analytics/timeline.',
  },
  COORDENADOR: {
    role: 'COORDENADOR',
    userId: 'seed_user_coord_louvor',
    email: 'coord.louvor@servos.local',
    password: E2E_DEFAULT_PASSWORD,
    churchId: 'seed_church_central',
    scope: 'MINISTRY',
    ministryId: 'seed_ministry_louvor_central',
    notes: 'Escopo ministerial para operacao de escalas e presenca.',
  },
  SERVO: {
    role: 'SERVO',
    userId: 'seed_user_servo_ana',
    email: 'ana.souza@servos.local',
    password: E2E_DEFAULT_PASSWORD,
    churchId: 'seed_church_central',
    scope: 'SELF',
    ministryId: 'seed_ministry_recep_o_central',
    teamId: 'seed_team_recep_entrada',
    servantId: 'seed_servant_ana',
    notes: 'Journey privada e fluxos /me/*.',
  },
};
