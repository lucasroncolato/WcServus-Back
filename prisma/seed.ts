import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { E2E_DEFAULT_PASSWORD } from './seed/e2e-users';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = E2E_DEFAULT_PASSWORD;
const SEED_VERSION = '2026-03-31-rich';

type Ctx = {
  summary: Record<string, number>;
  hash: string;
  plans: Record<string, string>;
  churches: Record<string, string>;
  users: Record<string, string>;
  ministries: Record<string, string>;
  teams: Record<string, string>;
  servants: Record<string, string>;
  responsibilities: Record<string, string>;
  templates: Record<string, string>;
  services: Record<string, string>;
  scheduleVersions: Record<string, string>;
  schedules: Record<string, string>;
  scheduleSlots: Record<string, string>;
  taskTemplates: Record<string, string>;
  taskOccurrences: Record<string, string>;
  growthTracks: Record<string, string>;
  growthSteps: Record<string, string>;
  milestones: Record<string, string>;
  automationRules: Record<string, string>;
  notificationTemplates: Record<string, string>;
};

const ctx: Ctx = {
  summary: {},
  hash: '',
  plans: {},
  churches: {},
  users: {},
  ministries: {},
  teams: {},
  servants: {},
  responsibilities: {},
  templates: {},
  services: {},
  scheduleVersions: {},
  schedules: {},
  scheduleSlots: {},
  taskTemplates: {},
  taskOccurrences: {},
  growthTracks: {},
  growthSteps: {},
  milestones: {},
  automationRules: {},
  notificationTemplates: {},
};

const add = (k: string, n = 1) => {
  ctx.summary[k] = (ctx.summary[k] ?? 0) + n;
};

const days = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const months = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d;
};
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
};
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
};

async function seedPlans() {
  const plans = [
    { code: 'START_MONTHLY', name: 'Start Mensal', interval: 'MONTHLY', priceCents: 9900, maxServants: 80, maxUsers: 20, maxMinistries: 8, modules: { TASKS: true, SCHEDULES: true }, active: true },
    { code: 'PRO_MONTHLY', name: 'Pro Mensal', interval: 'MONTHLY', priceCents: 24900, maxServants: 300, maxUsers: 70, maxMinistries: 25, modules: { TASKS: true, SCHEDULES: true, AUTOMATIONS: true, JOURNEY: true }, active: true },
    { code: 'PRO_YEARLY', name: 'Pro Anual', interval: 'YEARLY', priceCents: 249000, maxServants: 500, maxUsers: 120, maxMinistries: 50, modules: { TASKS: true, SCHEDULES: true, AUTOMATIONS: true, JOURNEY: true, TIMELINE: true, ANALYTICS: true }, active: true },
  ] as const;
  for (const p of plans) {
    const out = await prisma.plan.upsert({ where: { code: p.code }, update: p, create: p });
    ctx.plans[p.code] = out.id;
  }
  add('plans', plans.length);
}

async function seedChurches() {
  const churches = [
    { id: 'seed_church_central', name: 'Igreja Central da Esperança', city: 'Goiânia', state: 'GO', active: true },
    { id: 'seed_church_zs', name: 'Comunidade Vida Zona Sul', city: 'São Paulo', state: 'SP', active: true },
    { id: 'seed_church_interior', name: 'Igreja Fonte Interior', city: 'Uberlândia', state: 'MG', active: true },
  ] as const;
  for (const c of churches) {
    await prisma.church.upsert({ where: { id: c.id }, update: c, create: c });
    ctx.churches[c.id] = c.id;
  }
  add('churches', churches.length);

  await prisma.churchSettings.upsert({
    where: { churchId: churches[0].id },
    update: { id: 'seed_church_settings_1', churchId: churches[0].id, timezone: 'America/Sao_Paulo', locale: 'pt-BR', operationalWeekStartsOn: 1, defaultJourneyEnabled: true, requireScheduleConfirmation: true },
    create: { id: 'seed_church_settings_1', churchId: churches[0].id, timezone: 'America/Sao_Paulo', locale: 'pt-BR', operationalWeekStartsOn: 1, defaultJourneyEnabled: true, requireScheduleConfirmation: true },
  });
  await prisma.churchSettings.upsert({
    where: { churchId: churches[1].id },
    update: { id: 'seed_church_settings_2', churchId: churches[1].id, timezone: 'America/Sao_Paulo', locale: 'pt-BR', operationalWeekStartsOn: 0, defaultJourneyEnabled: true, requireScheduleConfirmation: true },
    create: { id: 'seed_church_settings_2', churchId: churches[1].id, timezone: 'America/Sao_Paulo', locale: 'pt-BR', operationalWeekStartsOn: 0, defaultJourneyEnabled: true, requireScheduleConfirmation: true },
  });
  await prisma.churchSettings.upsert({
    where: { churchId: churches[2].id },
    update: { id: 'seed_church_settings_3', churchId: churches[2].id, timezone: 'America/Sao_Paulo', locale: 'pt-BR', operationalWeekStartsOn: 1, defaultJourneyEnabled: false, requireScheduleConfirmation: false },
    create: { id: 'seed_church_settings_3', churchId: churches[2].id, timezone: 'America/Sao_Paulo', locale: 'pt-BR', operationalWeekStartsOn: 1, defaultJourneyEnabled: false, requireScheduleConfirmation: false },
  });
  add('churchSettings', 3);

  const modules = ['ANALYTICS', 'AUTOMATIONS', 'TIMELINE', 'REPORTS', 'NOTIFICATIONS', 'TASKS', 'SCHEDULES', 'JOURNEY'] as const;
  for (const church of churches) {
    for (const moduleKey of modules) {
      const enabled = church.id !== churches[2].id || !['ANALYTICS', 'AUTOMATIONS'].includes(moduleKey);
      await prisma.churchModule.upsert({
        where: { churchId_moduleKey: { churchId: church.id, moduleKey } },
        update: { enabled },
        create: { id: `seed_mod_${church.id}_${moduleKey}`, churchId: church.id, moduleKey, enabled },
      });
    }
  }
  add('churchModules', churches.length * modules.length);

  for (const [i, c] of churches.entries()) {
    await prisma.churchAutomationPreference.upsert({
      where: { churchId: c.id },
      update: { id: `seed_autopref_${i}`, churchId: c.id, enabled: i !== 2, overdueGraceDays: i + 1, stalledTrackDays: 20 + i * 10, noServiceAlertDays: 35 + i * 10, incompleteScheduleWindowHrs: 36 + i * 12 },
      create: { id: `seed_autopref_${i}`, churchId: c.id, enabled: i !== 2, overdueGraceDays: i + 1, stalledTrackDays: 20 + i * 10, noServiceAlertDays: 35 + i * 10, incompleteScheduleWindowHrs: 36 + i * 12 },
    });
  }
  add('churchAutomationPreferences', 3);
}

async function seedUsers() {
  const users = [
    { id: 'seed_user_super_admin', churchId: ctx.churches.seed_church_central, name: 'Rafael Mendes', email: 'superadmin@servos.local', role: 'SUPER_ADMIN', scope: 'GLOBAL', status: 'ACTIVE', mustChangePassword: false, phone: '+5562991110001', avatarUrl: 'https://i.pravatar.cc/150?img=1', lastLoginAt: days(-1) },
    { id: 'seed_user_admin_central', churchId: ctx.churches.seed_church_central, name: 'Juliana Prado', email: 'admin.central@servos.local', role: 'ADMIN', scope: 'GLOBAL', status: 'ACTIVE', mustChangePassword: false, phone: '+5562992220002', avatarUrl: 'https://i.pravatar.cc/150?img=2', lastLoginAt: days(-2) },
    { id: 'seed_user_pastor_central', churchId: ctx.churches.seed_church_central, name: 'Pr. Leonardo Brito', email: 'pastor.central@servos.local', role: 'PASTOR', scope: 'GLOBAL', status: 'ACTIVE', mustChangePassword: false, phone: '+5562993330003', avatarUrl: 'https://i.pravatar.cc/150?img=3', lastLoginAt: days(-1) },
    { id: 'seed_user_coord_louvor', churchId: ctx.churches.seed_church_central, name: 'Camila Tavares', email: 'coord.louvor@servos.local', role: 'COORDENADOR', scope: 'MINISTRY', status: 'ACTIVE', mustChangePassword: false, phone: '+5562994440004', avatarUrl: 'https://i.pravatar.cc/150?img=4', lastLoginAt: days(-2) },
    { id: 'seed_user_coord_midia', churchId: ctx.churches.seed_church_central, name: 'Rogério Alves', email: 'coord.midia@servos.local', role: 'COORDENADOR', scope: 'EQUIPE', status: 'ACTIVE', mustChangePassword: false, phone: '+5562995550005', avatarUrl: 'https://i.pravatar.cc/150?img=5', lastLoginAt: days(-3) },
    { id: 'seed_user_admin_zs', churchId: ctx.churches.seed_church_zs, name: 'Marta Ribeiro', email: 'admin.zs@servos.local', role: 'ADMIN', scope: 'GLOBAL', status: 'ACTIVE', mustChangePassword: false, phone: '+5511998881010', avatarUrl: 'https://i.pravatar.cc/150?img=8', lastLoginAt: days(-1) },
    { id: 'seed_user_pastor_zs', churchId: ctx.churches.seed_church_zs, name: 'Pr. Marcelo Vianna', email: 'pastor.zs@servos.local', role: 'PASTOR', scope: 'GLOBAL', status: 'ACTIVE', mustChangePassword: false, phone: '+5511997771011', avatarUrl: 'https://i.pravatar.cc/150?img=9', lastLoginAt: days(-2) },
    { id: 'seed_user_admin_interior', churchId: ctx.churches.seed_church_interior, name: 'Sérgio Arantes', email: 'admin.interior@servos.local', role: 'ADMIN', scope: 'GLOBAL', status: 'ACTIVE', mustChangePassword: false, phone: '+5534999112020', avatarUrl: 'https://i.pravatar.cc/150?img=10', lastLoginAt: days(-6) },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { ...u, passwordHash: ctx.hash, deletedAt: null, deletedBy: null },
      create: { ...u, passwordHash: ctx.hash },
    });
    ctx.users[u.id] = u.id;
  }
  add('users', users.length);
}

async function seedPlansAndSubscriptions() {
  const relations = [
    { churchId: ctx.churches.seed_church_central, planId: ctx.plans.PRO_YEARLY, status: 'ACTIVE' },
    { churchId: ctx.churches.seed_church_zs, planId: ctx.plans.PRO_MONTHLY, status: 'PAST_DUE' },
    { churchId: ctx.churches.seed_church_interior, planId: ctx.plans.START_MONTHLY, status: 'TRIAL' },
  ] as const;
  let i = 0;
  for (const r of relations) {
    i += 1;
    await prisma.churchPlan.upsert({
      where: { churchId: r.churchId },
      update: { id: `seed_church_plan_${i}`, ...r, startsAt: months(-2), endsAt: months(2), limitsSnapshot: { tag: `seed-${i}` } },
      create: { id: `seed_church_plan_${i}`, ...r, startsAt: months(-2), endsAt: months(2), limitsSnapshot: { tag: `seed-${i}` } },
    });
    await prisma.subscription.upsert({
      where: { id: `seed_sub_${i}` },
      update: { churchId: r.churchId, planId: r.planId, status: r.status, trialEndsAt: r.status === 'TRIAL' ? months(1) : null, startsAt: months(-2), endsAt: months(2), createdBy: ctx.users.seed_user_super_admin, metadata: { cycle: r.status } },
      create: { id: `seed_sub_${i}`, churchId: r.churchId, planId: r.planId, status: r.status, trialEndsAt: r.status === 'TRIAL' ? months(1) : null, startsAt: months(-2), endsAt: months(2), createdBy: ctx.users.seed_user_super_admin, metadata: { cycle: r.status } },
    });
  }
  add('churchPlans', relations.length);
  add('subscriptions', relations.length);
}

// remaining functions appended in next patch chunk
async function seedMinistries() {
  const defs = [
    ['seed_church_central', 'Louvor - Central'],
    ['seed_church_central', 'Recepção - Central'],
    ['seed_church_central', 'Mídia - Central'],
    ['seed_church_central', 'Intercessão - Central'],
    ['seed_church_central', 'Infantil - Central'],
    ['seed_church_central', 'Acolhimento - Central'],
    ['seed_church_central', 'Produção - Central'],
    ['seed_church_central', 'Limpeza - Central'],
    ['seed_church_central', 'Segurança - Central'],
    ['seed_church_central', 'Pastoral - Central'],
    ['seed_church_zs', 'Louvor - Zona Sul'],
    ['seed_church_zs', 'Mídia - Zona Sul'],
    ['seed_church_interior', 'Louvor - Interior'],
    ['seed_church_interior', 'Pastoral - Interior'],
  ] as const;
  for (const [churchKey, name] of defs) {
    const id = `seed_ministry_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    await prisma.ministry.upsert({
      where: { name },
      update: { id, churchId: ctx.churches[churchKey], description: `Ministério ${name}`, color: '#2563eb', icon: 'layers', popText: `Servindo em ${name}`, deletedAt: null, deletedBy: null },
      create: { id, churchId: ctx.churches[churchKey], name, description: `Ministério ${name}`, color: '#2563eb', icon: 'layers', popText: `Servindo em ${name}` },
    });
    ctx.ministries[id] = id;
  }
  add('ministries', defs.length);
}

async function seedTeamsAndServants() {
  const teams = [
    ['seed_team_louvor_vocal', 'seed_ministry_louvor_central', 'Louvor Vocal'],
    ['seed_team_louvor_instr', 'seed_ministry_louvor_central', 'Louvor Instrumental'],
    ['seed_team_midia_proj', 'seed_ministry_m_dia_central', 'Mídia Projeção'],
    ['seed_team_midia_trans', 'seed_ministry_m_dia_central', 'Mídia Transmissão'],
    ['seed_team_recep_entrada', 'seed_ministry_recep_o_central', 'Recepção Entrada'],
    ['seed_team_recep_aud', 'seed_ministry_recep_o_central', 'Recepção Auditório'],
    ['seed_team_infantil_berc', 'seed_ministry_infantil_central', 'Infantil Berçário'],
    ['seed_team_infantil_kids', 'seed_ministry_infantil_central', 'Infantil Kids'],
    ['seed_team_prod_palco', 'seed_ministry_produ_o_central', 'Produção Palco'],
    ['seed_team_inter_dom', 'seed_ministry_intercess_o_central', 'Intercessão Domingo'],
  ] as const;
  for (const t of teams) {
    const ministryId = ctx.ministries[t[1]];
    const churchId = (await prisma.ministry.findUniqueOrThrow({ where: { id: ministryId }, select: { churchId: true } })).churchId;
    await prisma.team.upsert({
      where: { ministryId_name: { ministryId, name: t[2] } },
      update: { id: t[0], churchId, slug: t[2].toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: t[2], leaderUserId: ctx.users.seed_user_admin_central, status: 'ACTIVE', deletedAt: null, deletedBy: null },
      create: { id: t[0], ministryId, churchId, name: t[2], slug: t[2].toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: t[2], leaderUserId: ctx.users.seed_user_admin_central, status: 'ACTIVE' },
    });
    ctx.teams[t[0]] = t[0];
  }
  add('teams', teams.length);

  const servants = [
    ['seed_servant_ana', 'Ana Beatriz Souza', 'FEMININO', 'ATIVO', 'COMPLETED', 'APPROVED', 'SOCIAL', 'seed_ministry_recep_o_central', 'seed_team_recep_entrada', 0, 0],
    ['seed_servant_lucas', 'Lucas Nascimento', 'MASCULINO', 'AFASTADO', 'PENDING', 'APPROVED', 'TECNICO', 'seed_ministry_m_dia_central', 'seed_team_midia_trans', 4, 5],
    ['seed_servant_carla', 'Carla Menezes', 'FEMININO', 'ATIVO', 'COMPLETED', 'APPROVED', 'LIDERANCA', 'seed_ministry_louvor_central', 'seed_team_louvor_vocal', 0, 0],
    ['seed_servant_daniel', 'Daniel Furtado', 'MASCULINO', 'RECICLAGEM', 'PENDING', 'PENDING', 'TECNICO', 'seed_ministry_m_dia_central', 'seed_team_midia_proj', 1, 2],
    ['seed_servant_felipe', 'Felipe Cunha', 'MASCULINO', 'ATIVO', 'COMPLETED', 'APPROVED', 'TECNICO', 'seed_ministry_louvor_central', 'seed_team_louvor_instr', 0, 0],
    ['seed_servant_gabriela', 'Gabriela Lemos', 'FEMININO', 'RECRUTAMENTO', 'PENDING', 'PENDING', 'APOIO', 'seed_ministry_recep_o_central', '', 0, 0],
    ['seed_servant_olivia', 'Olívia Freitas', 'FEMININO', 'RECICLAGEM', 'PENDING', 'REJECTED', 'OPERACIONAL', 'seed_ministry_louvor_zona_sul', '', 2, 3],
  ] as const;
  let i = 0;
  for (const s of servants) {
    i += 1;
    const ministryId = ctx.ministries[s[7]];
    const churchId = (await prisma.ministry.findUniqueOrThrow({ where: { id: ministryId }, select: { churchId: true } })).churchId;
    await prisma.servant.upsert({
      where: { id: s[0] },
      update: { id: s[0], churchId, name: s[1], phone: `+550000${i}`, gender: s[2], birthDate: yearsAgo(20 + i), status: s[3], trainingStatus: s[4], approvalStatus: s[5], aptitude: s[6], mainMinistryId: ministryId, teamId: s[8] ? ctx.teams[s[8]] : null, notes: 'seed', joinedAt: months(-i), consecutiveAbsences: s[9], monthlyAbsences: s[10], deletedAt: null, deletedBy: null },
      create: { id: s[0], churchId, name: s[1], phone: `+550000${i}`, gender: s[2], birthDate: yearsAgo(20 + i), status: s[3], trainingStatus: s[4], approvalStatus: s[5], aptitude: s[6], mainMinistryId: ministryId, teamId: s[8] ? ctx.teams[s[8]] : null, notes: 'seed', joinedAt: months(-i), consecutiveAbsences: s[9], monthlyAbsences: s[10] },
    });
    ctx.servants[s[0]] = s[0];
  }
  add('servants', servants.length);
}

async function seedServantUsers() {
  const servantUsers = [
    {
      id: 'seed_user_servo_ana',
      servantKey: 'seed_servant_ana',
      name: 'Ana Beatriz Souza',
      email: 'ana.souza@servos.local',
      status: 'ACTIVE',
      mustChangePassword: false,
      phone: '+5562996660006',
      avatarUrl: 'https://i.pravatar.cc/150?img=6',
      lastLoginAt: days(-5),
    },
    {
      id: 'seed_user_servo_lucas',
      servantKey: 'seed_servant_lucas',
      name: 'Lucas Nascimento',
      email: 'lucas.nascimento@servos.local',
      status: 'INACTIVE',
      mustChangePassword: false,
      phone: '+5562997770007',
      avatarUrl: 'https://i.pravatar.cc/150?img=7',
      lastLoginAt: days(-40),
    },
  ] as const;

  for (const user of servantUsers) {
    const servantId = ctx.servants[user.servantKey];
    const servant = await prisma.servant.findUniqueOrThrow({
      where: { id: servantId },
      select: { churchId: true },
    });
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        id: user.id,
        churchId: servant.churchId,
        servantId,
        name: user.name,
        role: 'SERVO',
        scope: 'SELF',
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt,
        passwordHash: ctx.hash,
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        id: user.id,
        churchId: servant.churchId,
        servantId,
        name: user.name,
        email: user.email,
        role: 'SERVO',
        scope: 'SELF',
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt,
        passwordHash: ctx.hash,
      },
    });
    ctx.users[user.id] = user.id;
  }

  add('users', servantUsers.length);
}

async function seedCoreModules() {
  // responsibilities
  const resp = [
    ['seed_resp_1', 'seed_ministry_louvor_central', 'VOCAL_PRINCIPAL', 'Vocal principal'],
    ['seed_resp_2', 'seed_ministry_m_dia_central', 'OPERADOR_PROJECAO', 'Operador de projeção'],
    ['seed_resp_3', 'seed_ministry_m_dia_central', 'OPERADOR_STREAMING', 'Operador de streaming'],
    ['seed_resp_4', 'seed_ministry_recep_o_central', 'RECEPCIONISTA', 'Recepcionista'],
    ['seed_resp_5', 'seed_ministry_produ_o_central', 'APOIO_PALCO', 'Apoio de palco'],
    ['seed_resp_6', 'seed_ministry_intercess_o_central', 'INTERCESSOR', 'Intercessor'],
  ] as const;
  for (const r of resp) {
    await prisma.ministryResponsibility.upsert({
      where: { id: r[0] },
      update: { id: r[0], ministryId: ctx.ministries[r[1]], name: r[3], title: r[3], functionName: r[2], activity: r[2], description: r[3], requiredTraining: true, requiredAptitude: 'TECNICO', active: true, deletedAt: null, deletedBy: null },
      create: { id: r[0], ministryId: ctx.ministries[r[1]], name: r[3], title: r[3], functionName: r[2], activity: r[2], description: r[3], requiredTraining: true, requiredAptitude: 'TECNICO', active: true },
    });
    ctx.responsibilities[r[0]] = r[0];
  }
  add('ministryResponsibilities', resp.length);

  // templates + services
  await prisma.serviceTemplate.upsert({ where: { id: 'seed_tpl_1' }, update: { id: 'seed_tpl_1', churchId: ctx.churches.seed_church_central, name: 'Culto Domingo Manhã', type: 'DOMINGO', recurrenceType: 'WEEKLY', weekday: 0, startTime: '09:00', duration: 110, active: true, generateAheadDays: 30 }, create: { id: 'seed_tpl_1', churchId: ctx.churches.seed_church_central, name: 'Culto Domingo Manhã', type: 'DOMINGO', recurrenceType: 'WEEKLY', weekday: 0, startTime: '09:00', duration: 110, active: true, generateAheadDays: 30 } });
  await prisma.serviceTemplate.upsert({ where: { id: 'seed_tpl_2' }, update: { id: 'seed_tpl_2', churchId: ctx.churches.seed_church_central, name: 'Culto Domingo Noite', type: 'DOMINGO', recurrenceType: 'WEEKLY', weekday: 0, startTime: '19:00', duration: 130, active: true, generateAheadDays: 30 }, create: { id: 'seed_tpl_2', churchId: ctx.churches.seed_church_central, name: 'Culto Domingo Noite', type: 'DOMINGO', recurrenceType: 'WEEKLY', weekday: 0, startTime: '19:00', duration: 130, active: true, generateAheadDays: 30 } });
  ctx.templates.seed_tpl_1 = 'seed_tpl_1';
  ctx.templates.seed_tpl_2 = 'seed_tpl_2';
  add('serviceTemplates', 2);

  await prisma.worshipService.upsert({ where: { id: 'seed_service_past' }, update: { id: 'seed_service_past', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_2', type: 'DOMINGO', title: 'Culto Passado', serviceDate: days(-14), startTime: '19:00', locked: true, canceled: false, notes: 'seed', status: 'FINALIZADO', deletedAt: null, deletedBy: null }, create: { id: 'seed_service_past', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_2', type: 'DOMINGO', title: 'Culto Passado', serviceDate: days(-14), startTime: '19:00', locked: true, canceled: false, notes: 'seed', status: 'FINALIZADO' } });
  await prisma.worshipService.upsert({ where: { id: 'seed_service_next' }, update: { id: 'seed_service_next', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_1', type: 'DOMINGO', title: 'Culto Próximo', serviceDate: days(4), startTime: '09:00', locked: false, canceled: false, notes: 'seed', status: 'CONFIRMADO', deletedAt: null, deletedBy: null }, create: { id: 'seed_service_next', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_1', type: 'DOMINGO', title: 'Culto Próximo', serviceDate: days(4), startTime: '09:00', locked: false, canceled: false, notes: 'seed', status: 'CONFIRMADO' } });
  await prisma.worshipService.upsert({ where: { id: 'seed_service_pending' }, update: { id: 'seed_service_pending', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_1', type: 'DOMINGO', title: 'Culto Pendente E2E', serviceDate: days(7), startTime: '09:00', locked: false, canceled: false, notes: 'seed pending', status: 'CONFIRMADO', deletedAt: null, deletedBy: null }, create: { id: 'seed_service_pending', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_1', type: 'DOMINGO', title: 'Culto Pendente E2E', serviceDate: days(7), startTime: '09:00', locked: false, canceled: false, notes: 'seed pending', status: 'CONFIRMADO' } });
  await prisma.worshipService.upsert({ where: { id: 'seed_service_pending_2' }, update: { id: 'seed_service_pending_2', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_1', type: 'DOMINGO', title: 'Culto Pendente E2E 2', serviceDate: days(8), startTime: '19:00', locked: false, canceled: false, notes: 'seed pending 2', status: 'CONFIRMADO', deletedAt: null, deletedBy: null }, create: { id: 'seed_service_pending_2', churchId: ctx.churches.seed_church_central, templateId: 'seed_tpl_1', type: 'DOMINGO', title: 'Culto Pendente E2E 2', serviceDate: days(8), startTime: '19:00', locked: false, canceled: false, notes: 'seed pending 2', status: 'CONFIRMADO' } });
  ctx.services.seed_service_past = 'seed_service_past';
  ctx.services.seed_service_next = 'seed_service_next';
  ctx.services.seed_service_pending = 'seed_service_pending';
  ctx.services.seed_service_pending_2 = 'seed_service_pending_2';
  add('worshipServices', 4);

  // minimal schedule/version/slots
  await prisma.scheduleVersion.upsert({ where: { id: 'seed_sv_1' }, update: { id: 'seed_sv_1', worshipServiceId: 'seed_service_next', churchId: ctx.churches.seed_church_central, versionNumber: 1, status: 'PUBLISHED', createdBy: ctx.users.seed_user_admin_central }, create: { id: 'seed_sv_1', worshipServiceId: 'seed_service_next', churchId: ctx.churches.seed_church_central, versionNumber: 1, status: 'PUBLISHED', createdBy: ctx.users.seed_user_admin_central } });
  ctx.scheduleVersions.seed_sv_1 = 'seed_sv_1';
  add('scheduleVersions', 1);

  await prisma.schedule.upsert({ where: { id: 'seed_schedule_1' }, update: { id: 'seed_schedule_1', serviceId: 'seed_service_next', servantId: ctx.servants.seed_servant_ana, ministryId: ctx.ministries.seed_ministry_recep_o_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'CONFIRMED', responseAt: days(-1), declineReason: null, deletedAt: null, deletedBy: null }, create: { id: 'seed_schedule_1', serviceId: 'seed_service_next', servantId: ctx.servants.seed_servant_ana, ministryId: ctx.ministries.seed_ministry_recep_o_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'CONFIRMED', responseAt: days(-1), declineReason: null } });
  ctx.schedules.seed_schedule_1 = 'seed_schedule_1';
  add('schedules', 1);

  await prisma.scheduleSlot.upsert({ where: { id: 'seed_slot_1' }, update: { id: 'seed_slot_1', serviceId: 'seed_service_next', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_1', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_4, functionName: 'RECEPCIONISTA', slotLabel: 'Recepção', position: 1, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'CONFIRMED', confirmationStatus: 'CONFIRMED', assignedServantId: ctx.servants.seed_servant_ana, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed', deletedAt: null, deletedBy: null }, create: { id: 'seed_slot_1', serviceId: 'seed_service_next', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_1', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_4, functionName: 'RECEPCIONISTA', slotLabel: 'Recepção', position: 1, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'CONFIRMED', confirmationStatus: 'CONFIRMED', assignedServantId: ctx.servants.seed_servant_ana, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed' } });
  ctx.scheduleSlots.seed_slot_1 = 'seed_slot_1';
  add('scheduleSlots', 1);

  await prisma.schedule.upsert({ where: { id: 'seed_schedule_2' }, update: { id: 'seed_schedule_2', serviceId: 'seed_service_next', servantId: ctx.servants.seed_servant_felipe, ministryId: ctx.ministries.seed_ministry_louvor_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'PENDING', responseAt: null, declineReason: null, deletedAt: null, deletedBy: null }, create: { id: 'seed_schedule_2', serviceId: 'seed_service_next', servantId: ctx.servants.seed_servant_felipe, ministryId: ctx.ministries.seed_ministry_louvor_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'PENDING', responseAt: null, declineReason: null } });
  ctx.schedules.seed_schedule_2 = 'seed_schedule_2';
  await prisma.scheduleSlot.upsert({ where: { id: 'seed_slot_2' }, update: { id: 'seed_slot_2', serviceId: 'seed_service_next', ministryId: ctx.ministries.seed_ministry_louvor_central, teamId: ctx.teams.seed_team_louvor_instr, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_2', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_1, functionName: 'VOCAL_PRINCIPAL', slotLabel: 'Vocal', position: 2, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'CONFIRMED', confirmationStatus: 'CONFIRMED', assignedServantId: ctx.servants.seed_servant_felipe, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed confirmed louvor', deletedAt: null, deletedBy: null }, create: { id: 'seed_slot_2', serviceId: 'seed_service_next', ministryId: ctx.ministries.seed_ministry_louvor_central, teamId: ctx.teams.seed_team_louvor_instr, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_2', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_1, functionName: 'VOCAL_PRINCIPAL', slotLabel: 'Vocal', position: 2, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'CONFIRMED', confirmationStatus: 'CONFIRMED', assignedServantId: ctx.servants.seed_servant_felipe, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed confirmed louvor' } });
  ctx.scheduleSlots.seed_slot_2 = 'seed_slot_2';
  await prisma.scheduleSlot.upsert({ where: { id: 'seed_slot_3' }, update: { id: 'seed_slot_3', serviceId: 'seed_service_next', ministryId: ctx.ministries.seed_ministry_louvor_central, teamId: ctx.teams.seed_team_louvor_vocal, churchId: ctx.churches.seed_church_central, scheduleId: null, templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_1, functionName: 'VOCAL_PRINCIPAL', slotLabel: 'Vocal apoio', position: 3, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'EMPTY', confirmationStatus: 'PENDING', assignedServantId: null, assignedByUserId: null, notes: 'seed empty louvor', deletedAt: null, deletedBy: null }, create: { id: 'seed_slot_3', serviceId: 'seed_service_next', ministryId: ctx.ministries.seed_ministry_louvor_central, teamId: ctx.teams.seed_team_louvor_vocal, churchId: ctx.churches.seed_church_central, scheduleId: null, templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_1, functionName: 'VOCAL_PRINCIPAL', slotLabel: 'Vocal apoio', position: 3, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'EMPTY', confirmationStatus: 'PENDING', assignedServantId: null, assignedByUserId: null, notes: 'seed empty louvor' } });
  ctx.scheduleSlots.seed_slot_3 = 'seed_slot_3';

  await prisma.schedule.upsert({ where: { id: 'seed_schedule_3' }, update: { id: 'seed_schedule_3', serviceId: 'seed_service_pending', servantId: ctx.servants.seed_servant_ana, ministryId: ctx.ministries.seed_ministry_recep_o_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'PENDING', responseAt: null, declineReason: null, deletedAt: null, deletedBy: null }, create: { id: 'seed_schedule_3', serviceId: 'seed_service_pending', servantId: ctx.servants.seed_servant_ana, ministryId: ctx.ministries.seed_ministry_recep_o_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'PENDING', responseAt: null, declineReason: null } });
  ctx.schedules.seed_schedule_3 = 'seed_schedule_3';
  await prisma.scheduleSlot.upsert({ where: { id: 'seed_slot_4' }, update: { id: 'seed_slot_4', serviceId: 'seed_service_pending', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_3', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_4, functionName: 'RECEPCIONISTA', slotLabel: 'Recepção pendente', position: 1, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'FILLED', confirmationStatus: 'PENDING', assignedServantId: ctx.servants.seed_servant_ana, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed pending servo', deletedAt: null, deletedBy: null }, create: { id: 'seed_slot_4', serviceId: 'seed_service_pending', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_3', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_4, functionName: 'RECEPCIONISTA', slotLabel: 'Recepção pendente', position: 1, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'FILLED', confirmationStatus: 'PENDING', assignedServantId: ctx.servants.seed_servant_ana, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed pending servo' } });
  ctx.scheduleSlots.seed_slot_4 = 'seed_slot_4';

  await prisma.schedule.upsert({ where: { id: 'seed_schedule_4' }, update: { id: 'seed_schedule_4', serviceId: 'seed_service_pending_2', servantId: ctx.servants.seed_servant_ana, ministryId: ctx.ministries.seed_ministry_recep_o_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'PENDING', responseAt: null, declineReason: null, deletedAt: null, deletedBy: null }, create: { id: 'seed_schedule_4', serviceId: 'seed_service_pending_2', servantId: ctx.servants.seed_servant_ana, ministryId: ctx.ministries.seed_ministry_recep_o_central, churchId: ctx.churches.seed_church_central, assignedByUserId: ctx.users.seed_user_admin_central, status: 'ASSIGNED', responseStatus: 'PENDING', responseAt: null, declineReason: null } });
  ctx.schedules.seed_schedule_4 = 'seed_schedule_4';
  await prisma.scheduleSlot.upsert({ where: { id: 'seed_slot_5' }, update: { id: 'seed_slot_5', serviceId: 'seed_service_pending_2', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_4', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_4, functionName: 'RECEPCIONISTA', slotLabel: 'Recepção pendente 2', position: 1, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'FILLED', confirmationStatus: 'PENDING', assignedServantId: ctx.servants.seed_servant_ana, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed pending servo 2', deletedAt: null, deletedBy: null }, create: { id: 'seed_slot_5', serviceId: 'seed_service_pending_2', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_4', templateSlotId: null, responsibilityId: ctx.responsibilities.seed_resp_4, functionName: 'RECEPCIONISTA', slotLabel: 'Recepção pendente 2', position: 1, required: true, requiredTraining: false, blocked: false, blockedReason: null, status: 'FILLED', confirmationStatus: 'PENDING', assignedServantId: ctx.servants.seed_servant_ana, assignedByUserId: ctx.users.seed_user_admin_central, notes: 'seed pending servo 2' } });
  ctx.scheduleSlots.seed_slot_5 = 'seed_slot_5';

  add('schedules', 3);
  add('scheduleSlots', 4);
}

async function seedCoverageExtras() {
  await prisma.churchBranding.upsert({
    where: { churchId: ctx.churches.seed_church_central },
    update: { id: 'seed_brand_1', churchId: ctx.churches.seed_church_central, logoUrl: 'https://cdn.example.com/seed.png', primaryColor: '#1D4ED8', secondaryColor: '#0F172A', accentColor: '#16A34A', welcomeMessage: 'Bem-vindo' },
    create: { id: 'seed_brand_1', churchId: ctx.churches.seed_church_central, logoUrl: 'https://cdn.example.com/seed.png', primaryColor: '#1D4ED8', secondaryColor: '#0F172A', accentColor: '#16A34A', welcomeMessage: 'Bem-vindo' },
  });

  await prisma.refreshToken.upsert({
    where: { id: 'seed_rt_1' },
    update: { id: 'seed_rt_1', userId: ctx.users.seed_user_admin_central, tokenHash: 'seed-rt-hash', expiresAt: days(30), revokedAt: null },
    create: { id: 'seed_rt_1', userId: ctx.users.seed_user_admin_central, tokenHash: 'seed-rt-hash', expiresAt: days(30), revokedAt: null },
  });
  await prisma.passwordResetToken.upsert({
    where: { id: 'seed_prt_1' },
    update: { id: 'seed_prt_1', userId: ctx.users.seed_user_servo_ana, tokenHash: 'seed-prt-hash', expiresAt: days(2), usedAt: null },
    create: { id: 'seed_prt_1', userId: ctx.users.seed_user_servo_ana, tokenHash: 'seed-prt-hash', expiresAt: days(2), usedAt: null },
  });
  await prisma.servantStatusHistory.upsert({
    where: { id: 'seed_ssh_1' },
    update: { id: 'seed_ssh_1', servantId: ctx.servants.seed_servant_lucas, fromStatus: 'ATIVO', toStatus: 'AFASTADO', reason: 'Seed', createdAt: days(-7) },
    create: { id: 'seed_ssh_1', servantId: ctx.servants.seed_servant_lucas, fromStatus: 'ATIVO', toStatus: 'AFASTADO', reason: 'Seed', createdAt: days(-7) },
  });

  await prisma.serviceTemplateSlot.upsert({
    where: { id: 'seed_sts_1' },
    update: { id: 'seed_sts_1', templateId: 'seed_tpl_1', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, responsibilityId: ctx.responsibilities.seed_resp_4, quantity: 2, requiredTalentId: null },
    create: { id: 'seed_sts_1', templateId: 'seed_tpl_1', ministryId: ctx.ministries.seed_ministry_recep_o_central, teamId: ctx.teams.seed_team_recep_entrada, responsibilityId: ctx.responsibilities.seed_resp_4, quantity: 2, requiredTalentId: null },
  });
  await prisma.scheduleVersionSlot.upsert({
    where: { id: 'seed_svs_1' },
    update: { id: 'seed_svs_1', scheduleVersionId: 'seed_sv_1', ministryId: ctx.ministries.seed_ministry_recep_o_central, responsibilityId: ctx.responsibilities.seed_resp_4, assignedServantId: ctx.servants.seed_servant_ana, status: 'CONFIRMED', position: 1 },
    create: { id: 'seed_svs_1', scheduleVersionId: 'seed_sv_1', ministryId: ctx.ministries.seed_ministry_recep_o_central, responsibilityId: ctx.responsibilities.seed_resp_4, assignedServantId: ctx.servants.seed_servant_ana, status: 'CONFIRMED', position: 1 },
  });
  await prisma.scheduleResponseHistory.upsert({
    where: { id: 'seed_srh_1' },
    update: { id: 'seed_srh_1', scheduleId: 'seed_schedule_1', responseStatus: 'CONFIRMED', declineReason: null, respondedByUserId: ctx.users.seed_user_servo_ana, respondedAt: days(-1) },
    create: { id: 'seed_srh_1', scheduleId: 'seed_schedule_1', responseStatus: 'CONFIRMED', declineReason: null, respondedByUserId: ctx.users.seed_user_servo_ana, respondedAt: days(-1) },
  });
  await prisma.servantAvailability.upsert({
    where: { servantId_dayOfWeek_shift: { servantId: ctx.servants.seed_servant_ana, dayOfWeek: 0, shift: 'MORNING' } },
    update: { id: 'seed_sa_1', servantId: ctx.servants.seed_servant_ana, dayOfWeek: 0, shift: 'MORNING', available: true, notes: 'Seed' },
    create: { id: 'seed_sa_1', servantId: ctx.servants.seed_servant_ana, dayOfWeek: 0, shift: 'MORNING', available: true, notes: 'Seed' },
  });
  await prisma.scheduleSwapHistory.upsert({
    where: { id: 'seed_sshist_1' },
    update: { id: 'seed_sshist_1', fromScheduleId: 'seed_schedule_1', toScheduleId: 'seed_schedule_1', reason: 'Seed', swappedByUserId: ctx.users.seed_user_admin_central, createdAt: days(-1) },
    create: { id: 'seed_sshist_1', fromScheduleId: 'seed_schedule_1', toScheduleId: 'seed_schedule_1', reason: 'Seed', swappedByUserId: ctx.users.seed_user_admin_central, createdAt: days(-1) },
  });
  await prisma.scheduleSlotChange.upsert({
    where: { id: 'seed_ssc_1' },
    update: { id: 'seed_ssc_1', slotId: 'seed_slot_1', changeType: 'STATUS_UPDATE', fromServantId: ctx.servants.seed_servant_ana, toServantId: ctx.servants.seed_servant_ana, reason: 'Seed', metadata: { seed: true }, performedByUserId: ctx.users.seed_user_admin_central, createdAt: days(-1) },
    create: { id: 'seed_ssc_1', slotId: 'seed_slot_1', changeType: 'STATUS_UPDATE', fromServantId: ctx.servants.seed_servant_ana, toServantId: ctx.servants.seed_servant_ana, reason: 'Seed', metadata: { seed: true }, performedByUserId: ctx.users.seed_user_admin_central, createdAt: days(-1) },
  });

  await prisma.attendance.upsert({
    where: { serviceId_servantId: { serviceId: 'seed_service_past', servantId: ctx.servants.seed_servant_ana } },
    update: { id: 'seed_att_1', serviceId: 'seed_service_past', servantId: ctx.servants.seed_servant_ana, churchId: ctx.churches.seed_church_central, status: 'PRESENTE', justification: null, notes: 'Seed', registeredByUserId: ctx.users.seed_user_admin_central, deletedAt: null, deletedBy: null },
    create: { id: 'seed_att_1', serviceId: 'seed_service_past', servantId: ctx.servants.seed_servant_ana, churchId: ctx.churches.seed_church_central, status: 'PRESENTE', justification: null, notes: 'Seed', registeredByUserId: ctx.users.seed_user_admin_central },
  });
  await prisma.pastoralVisit.upsert({
    where: { id: 'seed_pv_1' },
    update: { id: 'seed_pv_1', servantId: ctx.servants.seed_servant_lucas, churchId: ctx.churches.seed_church_central, title: 'Acompanhamento', reason: 'Ausencias', reasonType: 'ABSENCE', priority: 'HIGH', assignedToUserId: ctx.users.seed_user_pastor_central, status: 'EM_ANDAMENTO', openedAt: days(-10), nextFollowUpAt: days(2), resolvedAt: null, notes: 'Seed', createdByUserId: ctx.users.seed_user_admin_central, resolvedByUserId: null, deletedAt: null, deletedBy: null },
    create: { id: 'seed_pv_1', servantId: ctx.servants.seed_servant_lucas, churchId: ctx.churches.seed_church_central, title: 'Acompanhamento', reason: 'Ausencias', reasonType: 'ABSENCE', priority: 'HIGH', assignedToUserId: ctx.users.seed_user_pastor_central, status: 'EM_ANDAMENTO', openedAt: days(-10), nextFollowUpAt: days(2), resolvedAt: null, notes: 'Seed', createdByUserId: ctx.users.seed_user_admin_central, resolvedByUserId: null },
  });
  await prisma.pastoralNote.upsert({
    where: { id: 'seed_pn_1' },
    update: { id: 'seed_pn_1', pastoralVisitId: 'seed_pv_1', churchId: ctx.churches.seed_church_central, authorUserId: ctx.users.seed_user_pastor_central, visibility: 'LEADERS_ONLY', note: 'Seed note', deletedAt: null, deletedBy: null },
    create: { id: 'seed_pn_1', pastoralVisitId: 'seed_pv_1', churchId: ctx.churches.seed_church_central, authorUserId: ctx.users.seed_user_pastor_central, visibility: 'LEADERS_ONLY', note: 'Seed note' },
  });
  await prisma.pastoralFollowUp.upsert({
    where: { id: 'seed_pf_1' },
    update: { id: 'seed_pf_1', pastoralVisitId: 'seed_pv_1', churchId: ctx.churches.seed_church_central, scheduledAt: days(2), completedAt: null, status: 'OPEN', notes: 'Seed', createdByUserId: ctx.users.seed_user_pastor_central, completedByUserId: null, deletedAt: null, deletedBy: null },
    create: { id: 'seed_pf_1', pastoralVisitId: 'seed_pv_1', churchId: ctx.churches.seed_church_central, scheduledAt: days(2), completedAt: null, status: 'OPEN', notes: 'Seed', createdByUserId: ctx.users.seed_user_pastor_central, completedByUserId: null },
  });
  await prisma.pastoralWeeklyFollowUp.upsert({
    where: { id: 'seed_pwf_1' },
    update: { id: 'seed_pwf_1', servantId: ctx.servants.seed_servant_lucas, ministryId: ctx.ministries.seed_ministry_m_dia_central, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_1', weekStartDate: days(-7), contactedAt: days(-6), notes: 'Seed', responsibleUserId: ctx.users.seed_user_pastor_central, deletedAt: null, deletedBy: null },
    create: { id: 'seed_pwf_1', servantId: ctx.servants.seed_servant_lucas, ministryId: ctx.ministries.seed_ministry_m_dia_central, churchId: ctx.churches.seed_church_central, scheduleId: 'seed_schedule_1', weekStartDate: days(-7), contactedAt: days(-6), notes: 'Seed', responsibleUserId: ctx.users.seed_user_pastor_central },
  });
  await prisma.pastoralAlert.upsert({
    where: { id: 'seed_pa_1' },
    update: { id: 'seed_pa_1', servantId: ctx.servants.seed_servant_lucas, churchId: ctx.churches.seed_church_central, alertType: 'GENERIC', severity: 'HIGH', source: 'ATTENDANCE', sourceRefId: null, dedupeKey: 'seed_pa_1', message: 'Seed pastoral alert', metadata: { seed: true }, status: 'OPEN', trigger: 'seed', createdAt: days(-2), resolvedAt: null, createdByUserId: ctx.users.seed_user_admin_central, resolvedByUserId: null, deletedAt: null, deletedBy: null },
    create: { id: 'seed_pa_1', servantId: ctx.servants.seed_servant_lucas, churchId: ctx.churches.seed_church_central, alertType: 'GENERIC', severity: 'HIGH', source: 'ATTENDANCE', sourceRefId: null, dedupeKey: 'seed_pa_1', message: 'Seed pastoral alert', metadata: { seed: true }, status: 'OPEN', trigger: 'seed', createdAt: days(-2), resolvedAt: null, createdByUserId: ctx.users.seed_user_admin_central, resolvedByUserId: null },
  });

  add('coverageExtras', 18);
}

async function seedAdvancedModules() {
  await prisma.ministryTaskTemplate.upsert({
    where: { id: 'seed_mtt_1' },
    update: { id: 'seed_mtt_1', churchId: ctx.churches.seed_church_central, ministryId: ctx.ministries.seed_ministry_produ_o_central, name: 'Checklist palco', description: 'Seed', recurrenceType: 'EVERY_SERVICE', recurrenceConfig: { seed: true }, linkedToServiceType: 'DOMINGO', active: true, assigneeMode: 'REQUIRED', reallocationMode: 'MANUAL', maxAssignmentsPerServantPerMonth: 6, createdBy: ctx.users.seed_user_admin_central, deletedAt: null, deletedBy: null },
    create: { id: 'seed_mtt_1', churchId: ctx.churches.seed_church_central, ministryId: ctx.ministries.seed_ministry_produ_o_central, name: 'Checklist palco', description: 'Seed', recurrenceType: 'EVERY_SERVICE', recurrenceConfig: { seed: true }, linkedToServiceType: 'DOMINGO', active: true, assigneeMode: 'REQUIRED', reallocationMode: 'MANUAL', maxAssignmentsPerServantPerMonth: 6, createdBy: ctx.users.seed_user_admin_central },
  });
  await prisma.ministryTaskTemplateChecklistItem.upsert({
    where: { id: 'seed_mttci_1' },
    update: { id: 'seed_mttci_1', templateId: 'seed_mtt_1', label: 'Conferir cabos', description: 'Seed', position: 1, required: true },
    create: { id: 'seed_mttci_1', templateId: 'seed_mtt_1', label: 'Conferir cabos', description: 'Seed', position: 1, required: true },
  });
  await prisma.ministryTaskOccurrence.upsert({
    where: { id: 'seed_mto_1' },
    update: { id: 'seed_mto_1', churchId: ctx.churches.seed_church_central, templateId: 'seed_mtt_1', ministryId: ctx.ministries.seed_ministry_produ_o_central, serviceId: 'seed_service_next', scheduledFor: days(3), assignedServantId: ctx.servants.seed_servant_ana, originAssignedServantId: ctx.servants.seed_servant_ana, status: 'ASSIGNED', reallocationMode: 'MANUAL', reallocationStatus: 'NONE', lastReassignedAt: null, lastReassignedBy: null, dueAt: days(3), startedAt: null, slaMinutes: 60, priority: 'HIGH', criticality: 'HIGH', lastProgressAt: days(-1), progressPercent: 25, completedAt: null, completedBy: null, notes: 'Seed', deletedAt: null, deletedBy: null },
    create: { id: 'seed_mto_1', churchId: ctx.churches.seed_church_central, templateId: 'seed_mtt_1', ministryId: ctx.ministries.seed_ministry_produ_o_central, serviceId: 'seed_service_next', scheduledFor: days(3), assignedServantId: ctx.servants.seed_servant_ana, originAssignedServantId: ctx.servants.seed_servant_ana, status: 'ASSIGNED', reallocationMode: 'MANUAL', reallocationStatus: 'NONE', lastReassignedAt: null, lastReassignedBy: null, dueAt: days(3), startedAt: null, slaMinutes: 60, priority: 'HIGH', criticality: 'HIGH', lastProgressAt: days(-1), progressPercent: 25, completedAt: null, completedBy: null, notes: 'Seed' },
  });
  await prisma.ministryTaskOccurrenceChecklistItem.upsert({
    where: { id: 'seed_mtoci_1' },
    update: { id: 'seed_mtoci_1', occurrenceId: 'seed_mto_1', templateChecklistItemId: 'seed_mttci_1', label: 'Conferir cabos', description: null, position: 1, required: true, status: 'PENDING', checkedAt: null, checkedBy: null, notes: null },
    create: { id: 'seed_mtoci_1', occurrenceId: 'seed_mto_1', templateChecklistItemId: 'seed_mttci_1', label: 'Conferir cabos', description: null, position: 1, required: true, status: 'PENDING', checkedAt: null, checkedBy: null, notes: null },
  });
  await prisma.ministryTaskOccurrenceAssignee.upsert({
    where: { occurrenceId_servantId_role: { occurrenceId: 'seed_mto_1', servantId: ctx.servants.seed_servant_ana, role: 'PRIMARY' } },
    update: { id: 'seed_mtoa_1', occurrenceId: 'seed_mto_1', servantId: ctx.servants.seed_servant_ana, role: 'PRIMARY', active: true, createdBy: ctx.users.seed_user_admin_central, removedAt: null, removedBy: null },
    create: { id: 'seed_mtoa_1', occurrenceId: 'seed_mto_1', servantId: ctx.servants.seed_servant_ana, role: 'PRIMARY', active: true, createdBy: ctx.users.seed_user_admin_central, removedAt: null, removedBy: null },
  });
  await prisma.ministryTaskOccurrenceAssignmentHistory.upsert({
    where: { id: 'seed_mtoh_1' },
    update: { id: 'seed_mtoh_1', occurrenceId: 'seed_mto_1', fromServantId: null, toServantId: ctx.servants.seed_servant_ana, changedBy: ctx.users.seed_user_admin_central, changeType: 'ASSIGN', preserveProgress: true, reason: 'Seed', metadata: { seed: true }, createdAt: days(-1) },
    create: { id: 'seed_mtoh_1', occurrenceId: 'seed_mto_1', fromServantId: null, toServantId: ctx.servants.seed_servant_ana, changedBy: ctx.users.seed_user_admin_central, changeType: 'ASSIGN', preserveProgress: true, reason: 'Seed', metadata: { seed: true }, createdAt: days(-1) },
  });

  await prisma.servantJourney.upsert({
    where: { servantId: ctx.servants.seed_servant_ana },
    update: { id: 'seed_sj_1', servantId: ctx.servants.seed_servant_ana, churchId: ctx.churches.seed_church_central, startedAt: months(-12), totalServices: 20, totalTasksCompleted: 8, totalTrainingsCompleted: 2, totalEventsServed: 3, monthsServing: 12, lastActivityAt: days(-1) },
    create: { id: 'seed_sj_1', servantId: ctx.servants.seed_servant_ana, churchId: ctx.churches.seed_church_central, startedAt: months(-12), totalServices: 20, totalTasksCompleted: 8, totalTrainingsCompleted: 2, totalEventsServed: 3, monthsServing: 12, lastActivityAt: days(-1) },
  });
  await prisma.journeyMilestone.upsert({
    where: { code: 'SEED_MS_1' },
    update: { id: 'seed_jm_1', churchId: ctx.churches.seed_church_central, code: 'SEED_MS_1', name: 'Primeiro culto', description: 'Seed', icon: 'star', category: 'SERVICO' },
    create: { id: 'seed_jm_1', churchId: ctx.churches.seed_church_central, code: 'SEED_MS_1', name: 'Primeiro culto', description: 'Seed', icon: 'star', category: 'SERVICO' },
  });
  await prisma.servantMilestone.upsert({
    where: { servantId_milestoneId: { servantId: ctx.servants.seed_servant_ana, milestoneId: 'seed_jm_1' } },
    update: { id: 'seed_sm_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, milestoneId: 'seed_jm_1', achievedAt: months(-10) },
    create: { id: 'seed_sm_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, milestoneId: 'seed_jm_1', achievedAt: months(-10) },
  });
  await prisma.journeyLog.upsert({
    where: { id: 'seed_jl_1' },
    update: { id: 'seed_jl_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, type: 'SERVICE', title: 'Servico concluido', description: 'Seed', referenceId: 'seed_service_past', occurredAt: days(-14) },
    create: { id: 'seed_jl_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, type: 'SERVICE', title: 'Servico concluido', description: 'Seed', referenceId: 'seed_service_past', occurredAt: days(-14) },
  });
  await prisma.journeyIndicatorSnapshot.upsert({
    where: { servantId_windowDays: { servantId: ctx.servants.seed_servant_ana, windowDays: 30 } },
    update: { id: 'seed_jis_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, windowDays: 30, constancyScore: 80, readinessScore: 80, responsivenessScore: 80, punctualityScore: 80, engagementScore: 80, continuityScore: 80, formationScore: 80 },
    create: { id: 'seed_jis_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, windowDays: 30, constancyScore: 80, readinessScore: 80, responsivenessScore: 80, punctualityScore: 80, engagementScore: 80, continuityScore: 80, formationScore: 80 },
  });
  await prisma.journeyNextStep.upsert({
    where: { id: 'seed_jns_1' },
    update: { id: 'seed_jns_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_lucas, type: 'RETURN', priority: 'HIGH', title: 'Plano de retorno', description: 'Seed', status: 'OPEN', source: 'seed', metadata: { seed: true }, resolvedAt: null },
    create: { id: 'seed_jns_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_lucas, type: 'RETURN', priority: 'HIGH', title: 'Plano de retorno', description: 'Seed', status: 'OPEN', source: 'seed', metadata: { seed: true }, resolvedAt: null },
  });
  await prisma.journeyProjectionCheckpoint.upsert({
    where: { id: 'seed_jpc_1' },
    update: { id: 'seed_jpc_1', churchId: ctx.churches.seed_church_central, servantId: null, projectorName: 'seed-projector', lastProcessedAt: days(-1), lastProcessedEventKey: 'seed:1', lastReconciledAt: days(-1), status: 'OK', details: { seed: true } },
    create: { id: 'seed_jpc_1', churchId: ctx.churches.seed_church_central, servantId: null, projectorName: 'seed-projector', lastProcessedAt: days(-1), lastProcessedEventKey: 'seed:1', lastReconciledAt: days(-1), status: 'OK', details: { seed: true } },
  });

  await prisma.growthTrack.upsert({
    where: { id: 'seed_gt_1' },
    update: { id: 'seed_gt_1', churchId: ctx.churches.seed_church_central, ministryId: null, name: 'Base de servico', description: 'Seed', active: true, createdBy: ctx.users.seed_user_admin_central },
    create: { id: 'seed_gt_1', churchId: ctx.churches.seed_church_central, ministryId: null, name: 'Base de servico', description: 'Seed', active: true, createdBy: ctx.users.seed_user_admin_central },
  });
  await prisma.growthTrackStep.upsert({
    where: { growthTrackId_stepOrder: { growthTrackId: 'seed_gt_1', stepOrder: 1 } },
    update: { id: 'seed_gts_1', growthTrackId: 'seed_gt_1', title: 'Integracao', description: 'Seed', stepOrder: 1, criteria: { seed: true }, manualReview: false, createdBy: ctx.users.seed_user_admin_central },
    create: { id: 'seed_gts_1', growthTrackId: 'seed_gt_1', title: 'Integracao', description: 'Seed', stepOrder: 1, criteria: { seed: true }, manualReview: false, createdBy: ctx.users.seed_user_admin_central },
  });
  await prisma.servantGrowthProgress.upsert({
    where: { servantId_stepId: { servantId: ctx.servants.seed_servant_ana, stepId: 'seed_gts_1' } },
    update: { id: 'seed_sgp_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, growthTrackId: 'seed_gt_1', stepId: 'seed_gts_1', completed: true, completedAt: months(-5), progressValue: 100, notes: 'Seed', verifiedBy: ctx.users.seed_user_admin_central },
    create: { id: 'seed_sgp_1', churchId: ctx.churches.seed_church_central, servantId: ctx.servants.seed_servant_ana, growthTrackId: 'seed_gt_1', stepId: 'seed_gts_1', completed: true, completedAt: months(-5), progressValue: 100, notes: 'Seed', verifiedBy: ctx.users.seed_user_admin_central },
  });

  await prisma.notificationTemplate.upsert({
    where: { eventKey_channel: { eventKey: 'TASK_OVERDUE', channel: 'IN_APP' } },
    update: { id: 'seed_nt_2', eventKey: 'TASK_OVERDUE', channel: 'IN_APP', provider: 'MOCK', name: 'Tarefa atrasada', content: 'Seed', variables: ['task'], status: 'ACTIVE' },
    create: { id: 'seed_nt_2', eventKey: 'TASK_OVERDUE', channel: 'IN_APP', provider: 'MOCK', name: 'Tarefa atrasada', content: 'Seed', variables: ['task'], status: 'ACTIVE' },
  });
  await prisma.notificationQueue.upsert({
    where: { id: 'seed_nq_2' },
    update: { id: 'seed_nq_2', eventKey: 'TASK_OVERDUE', channel: 'IN_APP', provider: 'MOCK', status: 'SENT', userId: ctx.users.seed_user_admin_central, servantId: null, recipientPhone: '+550000', recipientName: 'Admin', templateId: 'seed_nt_2', payload: { seed: true }, renderedMessage: 'Seed', attemptCount: 1, maxAttempts: 3, nextRetryAt: days(1), lockedAt: null, processedAt: days(-1), providerMessageId: 'seed-msg', lastError: null },
    create: { id: 'seed_nq_2', eventKey: 'TASK_OVERDUE', channel: 'IN_APP', provider: 'MOCK', status: 'SENT', userId: ctx.users.seed_user_admin_central, servantId: null, recipientPhone: '+550000', recipientName: 'Admin', templateId: 'seed_nt_2', payload: { seed: true }, renderedMessage: 'Seed', attemptCount: 1, maxAttempts: 3, nextRetryAt: days(1), lockedAt: null, processedAt: days(-1), providerMessageId: 'seed-msg', lastError: null },
  });
  await prisma.notificationLog.upsert({
    where: { id: 'seed_nl_2' },
    update: { id: 'seed_nl_2', queueId: 'seed_nq_2', eventKey: 'TASK_OVERDUE', channel: 'IN_APP', provider: 'MOCK', status: 'SUCCESS', userId: ctx.users.seed_user_admin_central, servantId: null, recipientPhone: '+550000', templateId: 'seed_nt_2', payload: { seed: true }, providerMessageId: 'seed-msg', error: null, attempt: 1, sentAt: days(-1) },
    create: { id: 'seed_nl_2', queueId: 'seed_nq_2', eventKey: 'TASK_OVERDUE', channel: 'IN_APP', provider: 'MOCK', status: 'SUCCESS', userId: ctx.users.seed_user_admin_central, servantId: null, recipientPhone: '+550000', templateId: 'seed_nt_2', payload: { seed: true }, providerMessageId: 'seed-msg', error: null, attempt: 1, sentAt: days(-1) },
  });

  await prisma.automationRule.upsert({
    where: { id: 'seed_ar_2' },
    update: { id: 'seed_ar_2', churchId: ctx.churches.seed_church_central, name: 'Seed unconfirmed', description: 'Seed', triggerType: 'THRESHOLD', triggerKey: '48h', triggerConfig: { seed: true }, conditionConfig: { seed: true }, actionType: 'SCHEDULE_ALERT_UNCONFIRMED', actionConfig: { seed: true }, cooldownMinutes: 120, dedupeStrategy: 'BY_ENTITY_WINDOW', severity: 'MEDIUM', enabled: true, createdBy: ctx.users.seed_user_admin_central, updatedBy: ctx.users.seed_user_admin_central, lastRunAt: days(-1), deletedAt: null },
    create: { id: 'seed_ar_2', churchId: ctx.churches.seed_church_central, name: 'Seed unconfirmed', description: 'Seed', triggerType: 'THRESHOLD', triggerKey: '48h', triggerConfig: { seed: true }, conditionConfig: { seed: true }, actionType: 'SCHEDULE_ALERT_UNCONFIRMED', actionConfig: { seed: true }, cooldownMinutes: 120, dedupeStrategy: 'BY_ENTITY_WINDOW', severity: 'MEDIUM', enabled: true, createdBy: ctx.users.seed_user_admin_central, updatedBy: ctx.users.seed_user_admin_central, lastRunAt: days(-1), deletedAt: null },
  });
  await prisma.automationExecutionLog.upsert({
    where: { churchId_dedupeKey: { churchId: ctx.churches.seed_church_central, dedupeKey: 'seed_exec_2' } },
    update: { id: 'seed_ael_2', churchId: ctx.churches.seed_church_central, ruleId: 'seed_ar_2', triggerType: 'THRESHOLD', triggerKey: '48h', sourceModule: 'SCHEDULE', sourceRefId: 'seed_slot_1', dedupeKey: 'seed_exec_2', status: 'PARTIAL_SUCCESS', skipReason: null, summary: 'Seed partial', details: { success: 1, failed: 1 }, durationMs: 200, executedAt: days(-1), message: 'partial', processed: 2, metadata: { seed: true } },
    create: { id: 'seed_ael_2', churchId: ctx.churches.seed_church_central, ruleId: 'seed_ar_2', triggerType: 'THRESHOLD', triggerKey: '48h', sourceModule: 'SCHEDULE', sourceRefId: 'seed_slot_1', dedupeKey: 'seed_exec_2', status: 'PARTIAL_SUCCESS', skipReason: null, summary: 'Seed partial', details: { success: 1, failed: 1 }, durationMs: 200, executedAt: days(-1), message: 'partial', processed: 2, metadata: { seed: true } },
  });
  await prisma.automationCheckpoint.upsert({
    where: { churchId_schedulerName: { churchId: ctx.churches.seed_church_central, schedulerName: 'seed-hourly' } },
    update: { id: 'seed_ac_2', churchId: ctx.churches.seed_church_central, schedulerName: 'seed-hourly', lastProcessedAt: days(-1), lastProcessedCursor: 'seed2', status: 'WARNING', details: { seed: true } },
    create: { id: 'seed_ac_2', churchId: ctx.churches.seed_church_central, schedulerName: 'seed-hourly', lastProcessedAt: days(-1), lastProcessedCursor: 'seed2', status: 'WARNING', details: { seed: true } },
  });

  const p0 = monthStart();
  const p1 = new Date(Date.UTC(p0.getUTCFullYear(), p0.getUTCMonth() + 1, 0, 23, 59, 59));
  await prisma.churchAnalyticsSnapshot.upsert({
    where: { churchId_windowKey_periodStart_periodEnd: { churchId: ctx.churches.seed_church_zs, windowKey: 'MONTH', periodStart: p0, periodEnd: p1 } },
    update: { churchId: ctx.churches.seed_church_zs, windowKey: 'MONTH', periodStart: p0, periodEnd: p1, summary: { seed: true }, generatedAt: days(-1) },
    create: { churchId: ctx.churches.seed_church_zs, windowKey: 'MONTH', periodStart: p0, periodEnd: p1, summary: { seed: true }, generatedAt: days(-1) },
  });
  await prisma.timelineEntry.upsert({
    where: { id: 'seed_tl_2' },
    update: { id: 'seed_tl_2', churchId: ctx.churches.seed_church_central, ministryId: ctx.ministries.seed_ministry_produ_o_central, servantId: ctx.servants.seed_servant_ana, actorUserId: null, actorType: 'AUTOMATION', actorName: 'Seed Automation', scope: 'MINISTRY', type: 'AUTOMATION_TRIGGERED', category: 'AUTOMATION', eventType: 'SEED_AUTO_EVT', severity: 'WARNING', title: 'Automacao disparada', message: 'Seed', description: 'Seed', link: '/automation', subjectType: 'AutomationExecutionLog', subjectId: 'seed_ael_2', relatedEntityType: 'AutomationRule', relatedEntityId: 'seed_ar_2', dedupeKey: 'seed_tl_2', metadata: { seed: true }, occurredAt: days(-1) },
    create: { id: 'seed_tl_2', churchId: ctx.churches.seed_church_central, ministryId: ctx.ministries.seed_ministry_produ_o_central, servantId: ctx.servants.seed_servant_ana, actorUserId: null, actorType: 'AUTOMATION', actorName: 'Seed Automation', scope: 'MINISTRY', type: 'AUTOMATION_TRIGGERED', category: 'AUTOMATION', eventType: 'SEED_AUTO_EVT', severity: 'WARNING', title: 'Automacao disparada', message: 'Seed', description: 'Seed', link: '/automation', subjectType: 'AutomationExecutionLog', subjectId: 'seed_ael_2', relatedEntityType: 'AutomationRule', relatedEntityId: 'seed_ar_2', dedupeKey: 'seed_tl_2', metadata: { seed: true }, occurredAt: days(-1) },
  });
  await prisma.supportRequest.upsert({
    where: { id: 'seed_sr_2' },
    update: { id: 'seed_sr_2', type: 'DADOS', subject: 'Seed dashboard', description: 'Inconsistencia seed', reference: 'SR-2', status: 'EM_ANALISE', authorUserId: ctx.users.seed_user_admin_zs, handledByUserId: ctx.users.seed_user_super_admin, handledAt: null },
    create: { id: 'seed_sr_2', type: 'DADOS', subject: 'Seed dashboard', description: 'Inconsistencia seed', reference: 'SR-2', status: 'EM_ANALISE', authorUserId: ctx.users.seed_user_admin_zs, handledByUserId: ctx.users.seed_user_super_admin, handledAt: null },
  });
  await prisma.userMinistryBinding.upsert({
    where: { userId_ministryId_teamId: { userId: ctx.users.seed_user_coord_louvor, ministryId: ctx.ministries.seed_ministry_louvor_central, teamId: ctx.teams.seed_team_louvor_instr } },
    update: { id: 'seed_umb_1', userId: ctx.users.seed_user_coord_louvor, ministryId: ctx.ministries.seed_ministry_louvor_central, teamId: ctx.teams.seed_team_louvor_instr },
    create: { id: 'seed_umb_1', userId: ctx.users.seed_user_coord_louvor, ministryId: ctx.ministries.seed_ministry_louvor_central, teamId: ctx.teams.seed_team_louvor_instr },
  });
  await prisma.userMinistryBinding.upsert({
    where: { userId_ministryId_teamId: { userId: ctx.users.seed_user_coord_midia, ministryId: ctx.ministries.seed_ministry_m_dia_central, teamId: ctx.teams.seed_team_midia_proj } },
    update: { id: 'seed_umb_2', userId: ctx.users.seed_user_coord_midia, ministryId: ctx.ministries.seed_ministry_m_dia_central, teamId: ctx.teams.seed_team_midia_proj },
    create: { id: 'seed_umb_2', userId: ctx.users.seed_user_coord_midia, ministryId: ctx.ministries.seed_ministry_m_dia_central, teamId: ctx.teams.seed_team_midia_proj },
  });
  await prisma.userPermissionOverride.upsert({
    where: { userId_permissionKey: { userId: ctx.users.seed_user_servo_lucas, permissionKey: 'schedule.respond' } },
    update: { id: 'seed_upo_2', userId: ctx.users.seed_user_servo_lucas, permissionKey: 'schedule.respond', effect: 'DENY', reason: 'Conta inativa' },
    create: { id: 'seed_upo_2', userId: ctx.users.seed_user_servo_lucas, permissionKey: 'schedule.respond', effect: 'DENY', reason: 'Conta inativa' },
  });
  await prisma.auditLog.upsert({
    where: { id: 'seed_audit_2' },
    update: { id: 'seed_audit_2', churchId: ctx.churches.seed_church_central, action: 'MINISTRY_TASK_ASSIGNED', entity: 'MinistryTaskOccurrence', entityId: 'seed_mto_1', before: Prisma.JsonNull, after: { assignedServantId: ctx.servants.seed_servant_ana }, metadata: { seed: true }, userId: ctx.users.seed_user_admin_central, createdAt: days(-1) },
    create: { id: 'seed_audit_2', churchId: ctx.churches.seed_church_central, action: 'MINISTRY_TASK_ASSIGNED', entity: 'MinistryTaskOccurrence', entityId: 'seed_mto_1', before: Prisma.JsonNull, after: { assignedServantId: ctx.servants.seed_servant_ana }, metadata: { seed: true }, userId: ctx.users.seed_user_admin_central, createdAt: days(-1) },
  });

  add('advancedModules', 28);
}

async function seedRemainingCoverage() {
  const devotionalDate = days(-2);
  const fastingReferenceMonth = monthStart();
  const servantStatsMonth = monthStart();

  await prisma.servantMinistry.upsert({
    where: { servantId_ministryId: { servantId: ctx.servants.seed_servant_ana, ministryId: ctx.ministries.seed_ministry_recep_o_central } },
    update: {
      id: 'seed_smx_1',
      servantId: ctx.servants.seed_servant_ana,
      ministryId: ctx.ministries.seed_ministry_recep_o_central,
      trainingStatus: 'COMPLETED',
      trainingCompletedAt: months(-6),
      trainingReviewedByUserId: ctx.users.seed_user_coord_louvor,
      trainingNotes: 'Seed training completed',
      createdAt: months(-7),
    },
    create: {
      id: 'seed_smx_1',
      servantId: ctx.servants.seed_servant_ana,
      ministryId: ctx.ministries.seed_ministry_recep_o_central,
      trainingStatus: 'COMPLETED',
      trainingCompletedAt: months(-6),
      trainingReviewedByUserId: ctx.users.seed_user_coord_louvor,
      trainingNotes: 'Seed training completed',
      createdAt: months(-7),
    },
  });

  await prisma.dailyDevotional.upsert({
    where: { id: 'seed_dd_1' },
    update: {
      id: 'seed_dd_1',
      servantId: ctx.servants.seed_servant_ana,
      devotionalDate,
      status: 'DONE',
      notes: 'Seed devotional',
      registeredByUserId: ctx.users.seed_user_admin_central,
    },
    create: {
      id: 'seed_dd_1',
      servantId: ctx.servants.seed_servant_ana,
      devotionalDate,
      status: 'DONE',
      notes: 'Seed devotional',
      registeredByUserId: ctx.users.seed_user_admin_central,
    },
  });

  await prisma.monthlyFasting.upsert({
    where: { id: 'seed_mf_1' },
    update: {
      id: 'seed_mf_1',
      servantId: ctx.servants.seed_servant_ana,
      referenceMonth: fastingReferenceMonth,
      status: 'COMPLETED',
      completedAt: days(-3),
      notes: 'Seed fasting',
      registeredByUserId: ctx.users.seed_user_admin_central,
    },
    create: {
      id: 'seed_mf_1',
      servantId: ctx.servants.seed_servant_ana,
      referenceMonth: fastingReferenceMonth,
      status: 'COMPLETED',
      completedAt: days(-3),
      notes: 'Seed fasting',
      registeredByUserId: ctx.users.seed_user_admin_central,
    },
  });

  await prisma.talent.upsert({
    where: { id: 'seed_talent_1' },
    update: {
      id: 'seed_talent_1',
      servantId: ctx.servants.seed_servant_gabriela,
      stage: 'EM_AVALIACAO',
      reviewStatus: 'PENDING_ADMIN_REVIEW',
      rejectionReason: null,
      rejectedByUserId: null,
      rejectedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNotes: 'Seed talent em avaliacao',
      notes: 'Seed',
      approvedAt: null,
    },
    create: {
      id: 'seed_talent_1',
      servantId: ctx.servants.seed_servant_gabriela,
      stage: 'EM_AVALIACAO',
      reviewStatus: 'PENDING_ADMIN_REVIEW',
      rejectionReason: null,
      rejectedByUserId: null,
      rejectedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNotes: 'Seed talent em avaliacao',
      notes: 'Seed',
      approvedAt: null,
    },
  });

  const periodStart = monthStart();
  const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0, 23, 59, 59));

  await prisma.ministryAnalyticsSnapshot.upsert({
    where: {
      churchId_ministryId_windowKey_periodStart_periodEnd: {
        churchId: ctx.churches.seed_church_central,
        ministryId: ctx.ministries.seed_ministry_recep_o_central,
        windowKey: 'MONTH',
        periodStart,
        periodEnd,
      },
    },
    update: {
      churchId: ctx.churches.seed_church_central,
      ministryId: ctx.ministries.seed_ministry_recep_o_central,
      windowKey: 'MONTH',
      periodStart,
      periodEnd,
      summary: { assigned: 12, confirmed: 10 },
      generatedAt: days(-1),
    },
    create: {
      churchId: ctx.churches.seed_church_central,
      ministryId: ctx.ministries.seed_ministry_recep_o_central,
      windowKey: 'MONTH',
      periodStart,
      periodEnd,
      summary: { assigned: 12, confirmed: 10 },
      generatedAt: days(-1),
    },
  });

  await prisma.teamAnalyticsSnapshot.upsert({
    where: {
      churchId_teamId_windowKey_periodStart_periodEnd: {
        churchId: ctx.churches.seed_church_central,
        teamId: ctx.teams.seed_team_recep_entrada,
        windowKey: 'MONTH',
        periodStart,
        periodEnd,
      },
    },
    update: {
      churchId: ctx.churches.seed_church_central,
      teamId: ctx.teams.seed_team_recep_entrada,
      windowKey: 'MONTH',
      periodStart,
      periodEnd,
      summary: { health: 'good' },
      generatedAt: days(-1),
    },
    create: {
      churchId: ctx.churches.seed_church_central,
      teamId: ctx.teams.seed_team_recep_entrada,
      windowKey: 'MONTH',
      periodStart,
      periodEnd,
      summary: { health: 'good' },
      generatedAt: days(-1),
    },
  });

  await prisma.servantOperationalSnapshot.upsert({
    where: {
      churchId_servantId_windowKey_periodStart_periodEnd: {
        churchId: ctx.churches.seed_church_central,
        servantId: ctx.servants.seed_servant_ana,
        windowKey: 'MONTH',
        periodStart,
        periodEnd,
      },
    },
    update: {
      churchId: ctx.churches.seed_church_central,
      servantId: ctx.servants.seed_servant_ana,
      windowKey: 'MONTH',
      periodStart,
      periodEnd,
      summary: { presenceRate: 0.92, tasksDone: 8 },
      generatedAt: days(-1),
    },
    create: {
      churchId: ctx.churches.seed_church_central,
      servantId: ctx.servants.seed_servant_ana,
      windowKey: 'MONTH',
      periodStart,
      periodEnd,
      summary: { presenceRate: 0.92, tasksDone: 8 },
      generatedAt: days(-1),
    },
  });

  await prisma.servantMonthlyStats.upsert({
    where: { id: 'seed_sms_1' },
    update: {
      id: 'seed_sms_1',
      churchId: ctx.churches.seed_church_central,
      ministryId: ctx.ministries.seed_ministry_recep_o_central,
      servantId: ctx.servants.seed_servant_ana,
      referenceMonth: servantStatsMonth,
      attendanceConfirmed: 4,
      absences: 0,
      tasksCompleted: 3,
      tasksOverdue: 0,
      checklistPerfect: 2,
      pointsEarned: 120,
    },
    create: {
      id: 'seed_sms_1',
      churchId: ctx.churches.seed_church_central,
      ministryId: ctx.ministries.seed_ministry_recep_o_central,
      servantId: ctx.servants.seed_servant_ana,
      referenceMonth: servantStatsMonth,
      attendanceConfirmed: 4,
      absences: 0,
      tasksCompleted: 3,
      tasksOverdue: 0,
      checklistPerfect: 2,
      pointsEarned: 120,
    },
  });

  await prisma.notification.upsert({
    where: { id: 'seed_notif_1' },
    update: {
      id: 'seed_notif_1',
      userId: ctx.users.seed_user_admin_central,
      churchId: ctx.churches.seed_church_central,
      type: 'TASK_DUE_SOON',
      title: 'Tarefa vencendo',
      message: 'Uma tarefa vence em breve.',
      link: '/tasks/seed_mto_1',
      metadata: { seed: true },
      readAt: null,
      createdAt: days(-1),
    },
    create: {
      id: 'seed_notif_1',
      userId: ctx.users.seed_user_admin_central,
      churchId: ctx.churches.seed_church_central,
      type: 'TASK_DUE_SOON',
      title: 'Tarefa vencendo',
      message: 'Uma tarefa vence em breve.',
      link: '/tasks/seed_mto_1',
      metadata: { seed: true },
      readAt: null,
      createdAt: days(-1),
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId_channel: { userId: ctx.users.seed_user_admin_central, channel: 'IN_APP' } },
    update: {
      id: 'seed_np_1',
      userId: ctx.users.seed_user_admin_central,
      servantId: null,
      channel: 'IN_APP',
      enabled: true,
    },
    create: {
      id: 'seed_np_1',
      userId: ctx.users.seed_user_admin_central,
      servantId: null,
      channel: 'IN_APP',
      enabled: true,
    },
  });

  await prisma.notificationSystemSetting.upsert({
    where: { key: 'seed.notification.throttle' },
    update: { id: 'seed_nss_1', key: 'seed.notification.throttle', value: { perMinute: 30, burst: 10 } },
    create: { id: 'seed_nss_1', key: 'seed.notification.throttle', value: { perMinute: 30, burst: 10 } },
  });

  add('remainingCoverage', 11);
}

async function run() {
  ctx.hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await seedPlans();
  await seedChurches();
  await seedUsers();
  await seedPlansAndSubscriptions();
  await seedMinistries();
  await seedTeamsAndServants();
  await seedServantUsers();
  await seedCoreModules();
  await seedCoverageExtras();
  await seedAdvancedModules();
  await seedRemainingCoverage();
  console.log('\n=== Seed concluído ===');
  console.log(`Versão: ${SEED_VERSION}`);
  console.log(`Senha padrão: ${DEFAULT_PASSWORD}`);
  for (const [k, v] of Object.entries(ctx.summary).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- ${k}: ${v}`);
  }
}

run()
  .catch((err) => {
    console.error('Erro no seed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
