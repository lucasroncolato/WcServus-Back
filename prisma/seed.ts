import {
  Aptitude,
  AlertStatus,
  AttendanceStatus,
  Gender,
  MinistryTaskAssigneeMode,
  MinistryTaskOccurrenceCriticality,
  MinistryTaskOccurrencePriority,
  MinistryTaskOccurrenceStatus,
  MinistryTaskRecurrenceType,
  MinistryTaskReallocationMode,
  PastoralVisitStatus,
  PrismaClient,
  Role,
  ScheduleResponseStatus,
  ScheduleSlotStatus,
  ScheduleStatus,
  ServantApprovalStatus,
  ServantStatus,
  TeamStatus,
  TimelineEntryType,
  TimelineScope,
  TrainingStatus,
  UserScope,
  UserStatus,
  WorshipServiceStatus,
  WorshipServiceType,
  AuditAction,
  NotificationChannel,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = '123456';

type ResponsibilitySeed = {
  title: string;
  functionName: string;
  description: string;
  requiredTraining?: boolean;
  requiredAptitude?: Aptitude;
};

type ServantSeed = {
  name: string;
  email?: string;
  phone: string;
  gender: Gender;
  aptitude: Aptitude;
  status?: ServantStatus;
  trainingStatus?: TrainingStatus;
  joinedAt: Date;
  notes?: string;
  birthDate?: Date;
  createUser?: boolean;
};

type MinistrySeed = {
  name: string;
  color: string;
  icon: string;
  popText: string;
  description: string;
  coordinator: {
    name: string;
    email: string;
    phone: string;
  };
  team: {
    name: string;
    slug: string;
    description: string;
  };
  responsibilities: ResponsibilitySeed[];
  servants: ServantSeed[];
};

type CreatedService = {
  id: string;
  title: string;
  churchId: string;
  type: WorshipServiceType;
  serviceDate: Date;
  startTime: string;
  status: WorshipServiceStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
};

function normalizeEmail(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.') + '@servos.local'
  );
}

async function upsertChurch() {
  return prisma.church.upsert({
    where: { id: 'church_seed_central' },
    update: {
      name: 'Igreja Central Servos',
      city: 'Goiânia',
      state: 'GO',
      active: true,
    },
    create: {
      id: 'church_seed_central',
      name: 'Igreja Central Servos',
      city: 'Goiânia',
      state: 'GO',
      active: true,
    },
  });
}

async function upsertUser(params: {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  churchId: string;
  scope?: UserScope;
  status?: UserStatus;
  phone?: string | null;
  servantId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    if (params.servantId) {
      await tx.user.updateMany({
        where: {
          servantId: params.servantId,
          email: { not: params.email },
        },
        data: {
          servantId: null,
        },
      });
    }

    return tx.user.upsert({
      where: { email: params.email },
      update: {
        name: params.name,
        passwordHash: params.passwordHash,
        role: params.role,
        churchId: params.churchId,
        scope: params.scope ?? UserScope.GLOBAL,
        status: params.status ?? UserStatus.ACTIVE,
        phone: params.phone ?? null,
        servantId: params.servantId ?? null,
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        name: params.name,
        email: params.email,
        passwordHash: params.passwordHash,
        role: params.role,
        churchId: params.churchId,
        scope: params.scope ?? UserScope.GLOBAL,
        status: params.status ?? UserStatus.ACTIVE,
        phone: params.phone ?? null,
        servantId: params.servantId ?? null,
      },
    });
  });
}

async function upsertMinistry(params: {
  churchId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  popText: string;
  coordinatorUserId?: string | null;
}) {
  return prisma.ministry.upsert({
    where: { name: params.name },
    update: {
      churchId: params.churchId,
      description: params.description,
      color: params.color,
      icon: params.icon,
      popText: params.popText,
      coordinatorUserId: params.coordinatorUserId ?? null,
      deletedAt: null,
      deletedBy: null,
    },
    create: {
      churchId: params.churchId,
      name: params.name,
      description: params.description,
      color: params.color,
      icon: params.icon,
      popText: params.popText,
      coordinatorUserId: params.coordinatorUserId ?? null,
    },
  });
}

async function upsertTeam(params: {
  churchId: string;
  ministryId: string;
  name: string;
  slug: string;
  description: string;
  leaderUserId?: string | null;
}) {
  return prisma.team.upsert({
    where: {
      ministryId_name: {
        ministryId: params.ministryId,
        name: params.name,
      },
    },
    update: {
      churchId: params.churchId,
      slug: params.slug,
      description: params.description,
      leaderUserId: params.leaderUserId ?? null,
      status: TeamStatus.ACTIVE,
      deletedAt: null,
      deletedBy: null,
    },
    create: {
      churchId: params.churchId,
      ministryId: params.ministryId,
      name: params.name,
      slug: params.slug,
      description: params.description,
      leaderUserId: params.leaderUserId ?? null,
      status: TeamStatus.ACTIVE,
    },
  });
}

async function upsertServant(params: {
  churchId: string;
  name: string;
  phone: string;
  gender: Gender;
  aptitude: Aptitude;
  mainMinistryId: string;
  teamId?: string | null;
  status?: ServantStatus;
  trainingStatus?: TrainingStatus;
  joinedAt: Date;
  notes?: string;
  birthDate?: Date;
}) {
  const existing = await prisma.servant.findFirst({
    where: {
      churchId: params.churchId,
      name: params.name,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.servant.update({
      where: { id: existing.id },
      data: {
        churchId: params.churchId,
        phone: params.phone,
        gender: params.gender,
        aptitude: params.aptitude,
        mainMinistryId: params.mainMinistryId,
        teamId: params.teamId ?? null,
        status: params.status ?? ServantStatus.ATIVO,
        trainingStatus: params.trainingStatus ?? TrainingStatus.COMPLETED,
        approvalStatus: ServantApprovalStatus.APPROVED,
        joinedAt: params.joinedAt,
        notes: params.notes,
        birthDate: params.birthDate,
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  return prisma.servant.create({
    data: {
      churchId: params.churchId,
      name: params.name,
      phone: params.phone,
      gender: params.gender,
      aptitude: params.aptitude,
      mainMinistryId: params.mainMinistryId,
      teamId: params.teamId ?? null,
      status: params.status ?? ServantStatus.ATIVO,
      trainingStatus: params.trainingStatus ?? TrainingStatus.COMPLETED,
      approvalStatus: ServantApprovalStatus.APPROVED,
      joinedAt: params.joinedAt,
      notes: params.notes,
      birthDate: params.birthDate,
    },
  });
}

async function upsertResponsibility(params: {
  ministryId: string;
  title: string;
  functionName: string;
  description: string;
  requiredTraining?: boolean;
  requiredAptitude?: Aptitude;
}) {
  const existing = await prisma.ministryResponsibility.findFirst({
    where: {
      ministryId: params.ministryId,
      title: params.title,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.ministryResponsibility.update({
      where: { id: existing.id },
      data: {
        functionName: params.functionName,
        description: params.description,
        requiredTraining: params.requiredTraining ?? false,
        requiredAptitude: params.requiredAptitude ?? null,
        active: true,
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  return prisma.ministryResponsibility.create({
    data: {
      ministryId: params.ministryId,
      title: params.title,
      functionName: params.functionName,
      description: params.description,
      requiredTraining: params.requiredTraining ?? false,
      requiredAptitude: params.requiredAptitude ?? null,
      active: true,
    },
  });
}

async function createBaseChurchData(churchId: string) {
  await prisma.churchSettings.upsert({
    where: { churchId },
    update: {
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      operationalWeekStartsOn: 1,
      defaultJourneyEnabled: true,
      requireScheduleConfirmation: true,
    },
    create: {
      churchId,
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      operationalWeekStartsOn: 1,
      defaultJourneyEnabled: true,
      requireScheduleConfirmation: true,
    },
  });

  await prisma.churchBranding.upsert({
    where: { churchId },
    update: {
      primaryColor: '#1D4ED8',
      secondaryColor: '#0F172A',
      accentColor: '#16A34A',
      welcomeMessage: 'Bem-vindo ao painel de servos',
    },
    create: {
      churchId,
      primaryColor: '#1D4ED8',
      secondaryColor: '#0F172A',
      accentColor: '#16A34A',
      welcomeMessage: 'Bem-vindo ao painel de servos',
    },
  });

  const modules = [
    'ANALYTICS',
    'AUTOMATIONS',
    'TIMELINE',
    'REPORTS',
    'NOTIFICATIONS',
    'TASKS',
    'SCHEDULES',
    'JOURNEY',
  ] as const;

  for (const moduleKey of modules) {
    await prisma.churchModule.upsert({
      where: { churchId_moduleKey: { churchId, moduleKey } },
      update: { enabled: true },
      create: { churchId, moduleKey, enabled: true },
    });
  }

  await prisma.churchAutomationPreference.upsert({
    where: { churchId },
    update: {
      enabled: true,
      overdueGraceDays: 0,
      stalledTrackDays: 30,
      noServiceAlertDays: 45,
      incompleteScheduleWindowHrs: 48,
    },
    create: {
      churchId,
      enabled: true,
      overdueGraceDays: 0,
      stalledTrackDays: 30,
      noServiceAlertDays: 45,
      incompleteScheduleWindowHrs: 48,
    },
  });
}

async function clearOperationalData() {
  await prisma.scheduleSwapHistory.deleteMany();
  await prisma.scheduleResponseHistory.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.scheduleSlotChange.deleteMany();
  await prisma.scheduleSlot.deleteMany();
  await prisma.schedule.deleteMany();

  await prisma.ministryTaskOccurrenceChecklistItem.deleteMany();
  await prisma.ministryTaskOccurrenceAssignmentHistory.deleteMany();
  await prisma.ministryTaskOccurrenceAssignee.deleteMany();
  await prisma.ministryTaskOccurrence.deleteMany();
  await prisma.ministryTaskTemplateChecklistItem.deleteMany();
  await prisma.ministryTaskTemplate.deleteMany();

  await prisma.pastoralVisit.deleteMany();
  await prisma.pastoralAlert.deleteMany();
  await prisma.timelineEntry.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.servantAvailability.deleteMany();
  await prisma.servantMinistry.deleteMany();
  await prisma.userMinistryBinding.deleteMany();

  await prisma.automationExecutionLog.deleteMany();
  await prisma.automationRule.deleteMany();

  await prisma.servantMilestone.deleteMany();
  await prisma.journeyLog.deleteMany();
  await prisma.servantJourney.deleteMany();
  await prisma.journeyMilestone.deleteMany();

  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.notification.deleteMany();
}

async function main() {
  console.log('Starting seed...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const church = await upsertChurch();
  await createBaseChurchData(church.id);

  const superAdmin = await upsertUser({
    name: 'Super Admin',
    email: 'superadmin@servos.local',
    passwordHash,
    role: Role.SUPER_ADMIN,
    churchId: church.id,
    scope: UserScope.GLOBAL,
    phone: '62990000001',
  });

  const admin = await upsertUser({
    name: 'Admin Geral',
    email: 'admin@servos.local',
    passwordHash,
    role: Role.ADMIN,
    churchId: church.id,
    scope: UserScope.GLOBAL,
    phone: '62990000002',
  });

  const pastor = await upsertUser({
    name: 'Pr. Elias Ribeiro',
    email: 'pastor@servos.local',
    passwordHash,
    role: Role.PASTOR,
    churchId: church.id,
    scope: UserScope.GLOBAL,
    phone: '62990000003',
  });

  await clearOperationalData();

  const ministriesSeed: MinistrySeed[] = [
    {
      name: 'Recepção',
      color: '#2563EB',
      icon: 'door-open',
      popText: 'Acolhimento com excelência',
      description: 'Primeiro contato com visitantes e organização de entrada.',
      coordinator: {
        name: 'Caíque Martins',
        email: 'caique@servos.local',
        phone: '62991110001',
      },
      team: {
        name: 'Equipe A',
        slug: 'equipe-a',
        description: 'Recepção principal',
      },
      responsibilities: [
        {
          title: 'Boas-vindas',
          functionName: 'Recepcionar visitantes',
          description: 'Receber visitantes na entrada principal.',
          requiredTraining: false,
          requiredAptitude: Aptitude.SOCIAL,
        },
        {
          title: 'Organização da Entrada',
          functionName: 'Controlar fluxo',
          description: 'Organizar entrada, apoio e circulação.',
          requiredTraining: true,
          requiredAptitude: Aptitude.OPERACIONAL,
        },
      ],
      servants: [
        { name: 'Ruan Souza', phone: '62991111001', gender: Gender.MASCULINO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-01-10'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Lucas Ferreira', phone: '62991111002', gender: Gender.MASCULINO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-02-10'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Ana Clara Lima', phone: '62991111003', gender: Gender.FEMININO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-03-05'), trainingStatus: TrainingStatus.PENDING, status: ServantStatus.RECICLAGEM },
        { name: 'João Pedro Alves', phone: '62991111004', gender: Gender.MASCULINO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-04-15'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Mariana Costa', phone: '62991111005', gender: Gender.FEMININO, aptitude: Aptitude.LIDERANCA, joinedAt: new Date('2024-05-08'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Gabriel Rocha', phone: '62991111006', gender: Gender.MASCULINO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-06-01'), trainingStatus: TrainingStatus.COMPLETED },
      ],
    },
    {
      name: 'Mídia',
      color: '#0F766E',
      icon: 'monitor',
      popText: 'Suporte técnico e transmissão',
      description: 'Som, projeção, transmissão e operação técnica.',
      coordinator: {
        name: 'Maria Eduarda Gomes',
        email: 'maria.eduarda@servos.local',
        phone: '62992220001',
      },
      team: {
        name: 'Equipe Técnica',
        slug: 'equipe-tecnica',
        description: 'Operação de som e transmissão',
      },
      responsibilities: [
        {
          title: 'Operador de Som',
          functionName: 'Som do culto',
          description: 'Responsável pela mesa de som.',
          requiredTraining: true,
          requiredAptitude: Aptitude.TECNICO,
        },
        {
          title: 'Projeção',
          functionName: 'Slides e letras',
          description: 'Responsável pela projeção e apoio visual.',
          requiredTraining: true,
          requiredAptitude: Aptitude.TECNICO,
        },
      ],
      servants: [
        { name: 'Thiago Ruan Silva', phone: '62992221001', gender: Gender.MASCULINO, aptitude: Aptitude.TECNICO, joinedAt: new Date('2024-01-20'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Larissa Mendes', phone: '62992221002', gender: Gender.FEMININO, aptitude: Aptitude.TECNICO, joinedAt: new Date('2024-02-18'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Caio Henrique', phone: '62992221003', gender: Gender.MASCULINO, aptitude: Aptitude.TECNICO, joinedAt: new Date('2024-03-22'), trainingStatus: TrainingStatus.PENDING, status: ServantStatus.RECICLAGEM },
        { name: 'Bianca Nunes', phone: '62992221004', gender: Gender.FEMININO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-04-10'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Pedro Lucas', phone: '62992221005', gender: Gender.MASCULINO, aptitude: Aptitude.OPERACIONAL, joinedAt: new Date('2024-05-16'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Rafael Castro', phone: '62992221006', gender: Gender.MASCULINO, aptitude: Aptitude.TECNICO, joinedAt: new Date('2024-06-12'), trainingStatus: TrainingStatus.COMPLETED, status: ServantStatus.AFASTADO, notes: 'Afastado temporariamente para ajuste pessoal.' },
      ],
    },
    {
      name: 'Intercessão',
      color: '#B45309',
      icon: 'hands-praying',
      popText: 'Cobertura espiritual',
      description: 'Base de oração, apoio espiritual e intercessão.',
      coordinator: {
        name: 'Ruan Oliveira',
        email: 'ruan.oliveira@servos.local',
        phone: '62993330001',
      },
      team: {
        name: 'Equipe de Oração',
        slug: 'equipe-oracao',
        description: 'Intercessão antes e durante os cultos',
      },
      responsibilities: [
        {
          title: 'Intercessão Pré-Culto',
          functionName: 'Oração inicial',
          description: 'Cobertura espiritual antes do culto.',
          requiredTraining: false,
          requiredAptitude: Aptitude.APOIO,
        },
        {
          title: 'Apoio Pastoral',
          functionName: 'Apoio durante o culto',
          description: 'Apoio ao pastor em momentos de oração.',
          requiredTraining: true,
          requiredAptitude: Aptitude.LIDERANCA,
        },
      ],
      servants: [
        { name: 'Débora Martins', phone: '62993331001', gender: Gender.FEMININO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-01-03'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Samuel Fernandes', phone: '62993331002', gender: Gender.MASCULINO, aptitude: Aptitude.LIDERANCA, joinedAt: new Date('2024-02-14'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Aline Ribeiro', phone: '62993331003', gender: Gender.FEMININO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-03-27'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Daniel Carvalho', phone: '62993331004', gender: Gender.MASCULINO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-04-21'), trainingStatus: TrainingStatus.PENDING },
        { name: 'Priscila Moraes', phone: '62993331005', gender: Gender.FEMININO, aptitude: Aptitude.LIDERANCA, joinedAt: new Date('2024-05-11'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Emanuel Costa', phone: '62993331006', gender: Gender.MASCULINO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-06-09'), trainingStatus: TrainingStatus.COMPLETED },
      ],
    },
    {
      name: 'Louvor',
      color: '#7C3AED',
      icon: 'music',
      popText: 'Adoração e sensibilidade',
      description: 'Equipe de músicos e apoio ao louvor.',
      coordinator: {
        name: 'Ana Paula Rocha',
        email: 'ana.paula@servos.local',
        phone: '62994440001',
      },
      team: {
        name: 'Banda Base',
        slug: 'banda-base',
        description: 'Ministração principal',
      },
      responsibilities: [
        {
          title: 'Vocal de Apoio',
          functionName: 'Apoio vocal',
          description: 'Apoio ao time principal de louvor.',
          requiredTraining: true,
          requiredAptitude: Aptitude.SOCIAL,
        },
        {
          title: 'Instrumentista',
          functionName: 'Execução musical',
          description: 'Instrumentação do culto.',
          requiredTraining: true,
          requiredAptitude: Aptitude.TECNICO,
        },
      ],
      servants: [
        { name: 'Caíque Ruan', phone: '62994441001', gender: Gender.MASCULINO, aptitude: Aptitude.LIDERANCA, joinedAt: new Date('2024-01-18'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Juliana Freitas', phone: '62994441002', gender: Gender.FEMININO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-02-09'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Vinícius Melo', phone: '62994441003', gender: Gender.MASCULINO, aptitude: Aptitude.TECNICO, joinedAt: new Date('2024-03-01'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Letícia Souza', phone: '62994441004', gender: Gender.FEMININO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-04-07'), trainingStatus: TrainingStatus.PENDING, status: ServantStatus.RECICLAGEM },
        { name: 'João Vitor Lima', phone: '62994441005', gender: Gender.MASCULINO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-05-19'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Esther Nascimento', phone: '62994441006', gender: Gender.FEMININO, aptitude: Aptitude.LIDERANCA, joinedAt: new Date('2024-06-25'), trainingStatus: TrainingStatus.COMPLETED },
      ],
    },
    {
      name: 'Infantil',
      color: '#DB2777',
      icon: 'baby',
      popText: 'Cuidado e ensino às crianças',
      description: 'Acolhimento, ensino e apoio às crianças.',
      coordinator: {
        name: 'Fernanda Alves',
        email: 'fernanda@servos.local',
        phone: '62995550001',
      },
      team: {
        name: 'Kids Base',
        slug: 'kids-base',
        description: 'Equipe principal do infantil',
      },
      responsibilities: [
        {
          title: 'Recepção Infantil',
          functionName: 'Receber crianças',
          description: 'Receber e direcionar crianças com segurança.',
          requiredTraining: false,
          requiredAptitude: Aptitude.SOCIAL,
        },
        {
          title: 'Apoio de Sala',
          functionName: 'Suporte às atividades',
          description: 'Auxiliar nas atividades e organização das salas.',
          requiredTraining: true,
          requiredAptitude: Aptitude.APOIO,
        },
      ],
      servants: [
        { name: 'Patrícia Gomes', phone: '62995551001', gender: Gender.FEMININO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-01-12'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Ruan Gabriel', phone: '62995551002', gender: Gender.MASCULINO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-02-23'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Camila Tavares', phone: '62995551003', gender: Gender.FEMININO, aptitude: Aptitude.LIDERANCA, joinedAt: new Date('2024-03-19'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Nicole Martins', phone: '62995551004', gender: Gender.FEMININO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-04-13'), trainingStatus: TrainingStatus.PENDING },
        { name: 'Mateus Fernandes', phone: '62995551005', gender: Gender.MASCULINO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-05-02'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Beatriz Campos', phone: '62995551006', gender: Gender.FEMININO, aptitude: Aptitude.SOCIAL, joinedAt: new Date('2024-06-17'), trainingStatus: TrainingStatus.COMPLETED },
      ],
    },
    {
      name: 'Apoio',
      color: '#475569',
      icon: 'shield',
      popText: 'Organização e suporte operacional',
      description: 'Apoio logístico, ordem e organização do culto.',
      coordinator: {
        name: 'João Marcos',
        email: 'joao.marcos@servos.local',
        phone: '62996660001',
      },
      team: {
        name: 'Equipe Operacional',
        slug: 'equipe-operacional',
        description: 'Logística e apoio geral',
      },
      responsibilities: [
        {
          title: 'Organização do Espaço',
          functionName: 'Preparar ambiente',
          description: 'Preparar cadeiras, circulação e apoio geral.',
          requiredTraining: false,
          requiredAptitude: Aptitude.OPERACIONAL,
        },
        {
          title: 'Suporte Operacional',
          functionName: 'Responder demandas',
          description: 'Atender necessidades operacionais durante o culto.',
          requiredTraining: true,
          requiredAptitude: Aptitude.APOIO,
        },
      ],
      servants: [
        { name: 'Carlos Eduardo', phone: '62996661001', gender: Gender.MASCULINO, aptitude: Aptitude.OPERACIONAL, joinedAt: new Date('2024-01-05'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Bruno Henrique', phone: '62996661002', gender: Gender.MASCULINO, aptitude: Aptitude.OPERACIONAL, joinedAt: new Date('2024-02-11'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Ana Beatriz', phone: '62996661003', gender: Gender.FEMININO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-03-29'), trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Lucas Mendes', phone: '62996661004', gender: Gender.MASCULINO, aptitude: Aptitude.LIDERANCA, joinedAt: new Date('2024-04-18'), createUser: true, trainingStatus: TrainingStatus.COMPLETED },
        { name: 'Ruan Victor', phone: '62996661005', gender: Gender.MASCULINO, aptitude: Aptitude.OPERACIONAL, joinedAt: new Date('2024-05-27'), trainingStatus: TrainingStatus.PENDING, status: ServantStatus.RECICLAGEM },
        { name: 'Karina Lopes', phone: '62996661006', gender: Gender.FEMININO, aptitude: Aptitude.APOIO, joinedAt: new Date('2024-06-08'), trainingStatus: TrainingStatus.COMPLETED },
      ],
    },
  ];

  const createdMinistries: Array<{
    ministry: any;
    coordinatorUser: any;
    team: any;
    servants: any[];
    servantUsers: any[];
    responsibilities: any[];
  }> = [];

  for (const item of ministriesSeed) {
    const coordinatorUser = await upsertUser({
      name: item.coordinator.name,
      email: item.coordinator.email,
      passwordHash,
      role: Role.COORDENADOR,
      churchId: church.id,
      scope: UserScope.MINISTRY,
      phone: item.coordinator.phone,
    });

    const ministry = await upsertMinistry({
      churchId: church.id,
      name: item.name,
      description: item.description,
      color: item.color,
      icon: item.icon,
      popText: item.popText,
      coordinatorUserId: coordinatorUser.id,
    });

    const team = await upsertTeam({
      churchId: church.id,
      ministryId: ministry.id,
      name: item.team.name,
      slug: item.team.slug,
      description: item.team.description,
      leaderUserId: coordinatorUser.id,
    });

    const servants: any[] = [];
    const servantUsers: any[] = [];
    const responsibilities: any[] = [];

    for (const servantSeed of item.servants) {
      const servant = await upsertServant({
        churchId: church.id,
        name: servantSeed.name,
        phone: servantSeed.phone,
        gender: servantSeed.gender,
        aptitude: servantSeed.aptitude,
        mainMinistryId: ministry.id,
        teamId: team.id,
        status: servantSeed.status ?? ServantStatus.ATIVO,
        trainingStatus: servantSeed.trainingStatus ?? TrainingStatus.COMPLETED,
        joinedAt: servantSeed.joinedAt,
        notes: servantSeed.notes ?? `Servo do ministério ${item.name}`,
        birthDate: servantSeed.birthDate,
      });

      servants.push(servant);

      await prisma.servantMinistry.upsert({
        where: {
          servantId_ministryId: {
            servantId: servant.id,
            ministryId: ministry.id,
          },
        },
        update: {
          trainingStatus: servant.trainingStatus,
          trainingCompletedAt:
            servant.trainingStatus === TrainingStatus.COMPLETED ? servant.joinedAt : null,
        },
        create: {
          servantId: servant.id,
          ministryId: ministry.id,
          trainingStatus: servant.trainingStatus,
          trainingCompletedAt:
            servant.trainingStatus === TrainingStatus.COMPLETED ? servant.joinedAt : null,
        },
      });

      await prisma.servantAvailability.upsert({
        where: {
          servantId_dayOfWeek_shift: {
            servantId: servant.id,
            dayOfWeek: 0,
            shift: 'EVENING',
          },
        },
        update: { available: true },
        create: {
          servantId: servant.id,
          dayOfWeek: 0,
          shift: 'EVENING',
          available: true,
        },
      });

      await prisma.servantAvailability.upsert({
        where: {
          servantId_dayOfWeek_shift: {
            servantId: servant.id,
            dayOfWeek: 4,
            shift: 'EVENING',
          },
        },
        update: { available: true },
        create: {
          servantId: servant.id,
          dayOfWeek: 4,
          shift: 'EVENING',
          available: true,
        },
      });

      if (servantSeed.createUser) {
        const servantUser = await upsertUser({
          name: servantSeed.name,
          email: servantSeed.email ?? normalizeEmail(servantSeed.name),
          passwordHash,
          role: Role.SERVO,
          churchId: church.id,
          scope: UserScope.SELF,
          phone: servantSeed.phone,
          servantId: servant.id,
        });
        servantUsers.push(servantUser);
      }
    }

    for (const responsibilitySeed of item.responsibilities) {
      const responsibility = await upsertResponsibility({
        ministryId: ministry.id,
        title: responsibilitySeed.title,
        functionName: responsibilitySeed.functionName,
        description: responsibilitySeed.description,
        requiredTraining: responsibilitySeed.requiredTraining,
        requiredAptitude: responsibilitySeed.requiredAptitude,
      });
      responsibilities.push(responsibility);
    }

    const existingBinding = await prisma.userMinistryBinding.findFirst({
      where: {
        userId: coordinatorUser.id,
        ministryId: ministry.id,
        teamId: null,
      },
      select: { id: true },
    });

    if (!existingBinding) {
      await prisma.userMinistryBinding.create({
        data: {
          userId: coordinatorUser.id,
          ministryId: ministry.id,
        },
      });
    }

    await prisma.servantStatusHistory.createMany({
      data: servants.map((servant) => ({
        servantId: servant.id,
        fromStatus: null,
        toStatus: servant.status,
        reason: 'Carga inicial do seed',
      })),
      skipDuplicates: true,
    });

    createdMinistries.push({
      ministry,
      coordinatorUser,
      team,
      servants,
      servantUsers,
      responsibilities,
    });
  }

  const allServants = createdMinistries.flatMap((m) => m.servants);

  const servicesData = [
    {
      title: 'Culto Domingo Manhã 1',
      type: WorshipServiceType.DOMINGO,
      serviceDate: new Date('2026-03-08T10:00:00.000Z'),
      startTime: '10:00',
      status: WorshipServiceStatus.FINALIZADO,
    },
    {
      title: 'Culto Quinta 1',
      type: WorshipServiceType.QUINTA,
      serviceDate: new Date('2026-03-12T22:30:00.000Z'),
      startTime: '19:30',
      status: WorshipServiceStatus.FINALIZADO,
    },
    {
      title: 'Culto Domingo Noite 1',
      type: WorshipServiceType.DOMINGO,
      serviceDate: new Date('2026-03-15T22:30:00.000Z'),
      startTime: '19:30',
      status: WorshipServiceStatus.CONFIRMADO,
    },
    {
      title: 'Culto Domingo Manhã 2',
      type: WorshipServiceType.DOMINGO,
      serviceDate: new Date('2026-03-22T10:00:00.000Z'),
      startTime: '10:00',
      status: WorshipServiceStatus.CONFIRMADO,
    },
    {
      title: 'Culto Quinta 2',
      type: WorshipServiceType.QUINTA,
      serviceDate: new Date('2026-03-26T22:30:00.000Z'),
      startTime: '19:30',
      status: WorshipServiceStatus.CONFIRMADO,
    },
  ];

  const createdServices: CreatedService[] = [];
  for (const item of servicesData) {
    const service = await prisma.worshipService.upsert({
      where: {
        serviceDate_startTime_title: {
          serviceDate: item.serviceDate,
          startTime: item.startTime,
          title: item.title,
        },
      },
      update: {
        churchId: church.id,
        type: item.type,
        status: item.status,
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        churchId: church.id,
        type: item.type,
        title: item.title,
        serviceDate: item.serviceDate,
        startTime: item.startTime,
        status: item.status,
      },
    });
    createdServices.push(service as CreatedService);
  }

  for (const service of createdServices) {
    const version = await prisma.scheduleVersion.upsert({
      where: {
        worshipServiceId_versionNumber: {
          worshipServiceId: service.id,
          versionNumber: 1,
        },
      },
      update: {
        churchId: church.id,
        createdBy: admin.id,
      },
      create: {
        worshipServiceId: service.id,
        churchId: church.id,
        versionNumber: 1,
        status: service.status === WorshipServiceStatus.FINALIZADO ? 'PUBLISHED' : 'DRAFT',
        createdBy: admin.id,
      },
    });

    for (const [index, item] of createdMinistries.entries()) {
      await prisma.scheduleVersionSlot.create({
        data: {
          scheduleVersionId: version.id,
          ministryId: item.ministry.id,
          responsibilityId: item.responsibilities[0]?.id ?? null,
          assignedServantId: item.servants[index % item.servants.length]?.id,
          status: service.status === WorshipServiceStatus.FINALIZADO ? ScheduleSlotStatus.CONFIRMED : ScheduleSlotStatus.OPEN,
          position: 1,
        },
      }).catch(() => null);

      await prisma.scheduleVersionSlot.create({
        data: {
          scheduleVersionId: version.id,
          ministryId: item.ministry.id,
          responsibilityId: item.responsibilities[1]?.id ?? null,
          assignedServantId: item.servants[(index + 1) % item.servants.length]?.id ?? null,
          status: service.status === WorshipServiceStatus.FINALIZADO ? ScheduleSlotStatus.CONFIRMED : ScheduleSlotStatus.OPEN,
          position: 2,
        },
      }).catch(() => null);
    }
  }

  const createdSchedules: any[] = [];

  for (const [serviceIndex, service] of createdServices.entries()) {
    for (const [index, item] of createdMinistries.entries()) {
      const assignedServant = item.servants[index % item.servants.length];
      const backupServant = item.servants[(index + 1) % item.servants.length];

      const schedule = await prisma.schedule.upsert({
        where: {
          serviceId_servantId_ministryId: {
            serviceId: service.id,
            servantId: assignedServant.id,
            ministryId: item.ministry.id,
          },
        },
        update: {
          churchId: church.id,
          assignedByUserId: admin.id,
          status:
            service.title === 'Culto Domingo Noite 1' && item.ministry.name === 'Recepção'
              ? ScheduleStatus.SWAPPED
              : ScheduleStatus.ASSIGNED,
          responseStatus:
            service.status === WorshipServiceStatus.CONFIRMADO
              ? ScheduleResponseStatus.PENDING
              : ScheduleResponseStatus.CONFIRMED,
          responseAt:
            service.status === WorshipServiceStatus.CONFIRMADO ? null : new Date(),
          declineReason: null,
          deletedAt: null,
          deletedBy: null,
        },
        create: {
          churchId: church.id,
          serviceId: service.id,
          servantId: assignedServant.id,
          ministryId: item.ministry.id,
          assignedByUserId: admin.id,
          status:
            service.title === 'Culto Domingo Noite 1' && item.ministry.name === 'Recepção'
              ? ScheduleStatus.SWAPPED
              : ScheduleStatus.ASSIGNED,
          responseStatus:
            service.status === WorshipServiceStatus.CONFIRMADO
              ? ScheduleResponseStatus.PENDING
              : ScheduleResponseStatus.CONFIRMED,
          responseAt:
            service.status === WorshipServiceStatus.CONFIRMADO ? null : new Date(),
        },
      });

      createdSchedules.push(schedule);

      await prisma.scheduleSlot.create({
        data: {
          churchId: church.id,
          serviceId: service.id,
          ministryId: item.ministry.id,
          scheduleId: schedule.id,
          responsibilityId: item.responsibilities[0]?.id ?? null,
          functionName: item.responsibilities[0]?.functionName ?? `Principal ${item.ministry.name}`,
          slotLabel: `Principal - ${item.ministry.name}`,
          position: 1,
          status:
            service.status === WorshipServiceStatus.CONFIRMADO
              ? ScheduleSlotStatus.PENDING_CONFIRMATION
              : ScheduleSlotStatus.CONFIRMED,
          assignedServantId: assignedServant.id,
          assignedByUserId: admin.id,
          required: true,
          requiredTraining: item.responsibilities[0]?.requiredTraining ?? true,
        },
      }).catch(() => null);

      await prisma.scheduleSlot.create({
        data: {
          churchId: church.id,
          serviceId: service.id,
          ministryId: item.ministry.id,
          scheduleId: schedule.id,
          responsibilityId: item.responsibilities[1]?.id ?? null,
          functionName: item.responsibilities[1]?.functionName ?? `Apoio ${item.ministry.name}`,
          slotLabel: `Apoio - ${item.ministry.name}`,
          position: 2,
          status:
            serviceIndex <= 1
              ? ScheduleSlotStatus.CONFIRMED
              : ScheduleSlotStatus.OPEN,
          assignedServantId: serviceIndex <= 1 ? backupServant.id : null,
          assignedByUserId: serviceIndex <= 1 ? admin.id : null,
          required: false,
          requiredTraining: item.responsibilities[1]?.requiredTraining ?? false,
        },
      }).catch(() => null);

      if (service.status !== WorshipServiceStatus.CONFIRMADO) {
        await prisma.attendance.upsert({
          where: {
            serviceId_servantId: {
              serviceId: service.id,
              servantId: assignedServant.id,
            },
          },
          update: {
            churchId: church.id,
            status:
              service.title === 'Culto Quinta 1' && item.ministry.name === 'Mídia'
                ? AttendanceStatus.FALTA
                : service.title === 'Culto Domingo Manhã 1' && item.ministry.name === 'Intercessão'
                ? AttendanceStatus.FALTA_JUSTIFICADA
                : AttendanceStatus.PRESENTE,
            justification:
              service.title === 'Culto Quinta 1' && item.ministry.name === 'Mídia'
                ? 'Imprevisto no trabalho'
                : service.title === 'Culto Domingo Manhã 1' && item.ministry.name === 'Intercessão'
                ? 'Consulta médica'
                : null,
            registeredByUserId: admin.id,
          },
          create: {
            churchId: church.id,
            serviceId: service.id,
            servantId: assignedServant.id,
            status:
              service.title === 'Culto Quinta 1' && item.ministry.name === 'Mídia'
                ? AttendanceStatus.FALTA
                : service.title === 'Culto Domingo Manhã 1' && item.ministry.name === 'Intercessão'
                ? AttendanceStatus.FALTA_JUSTIFICADA
                : AttendanceStatus.PRESENTE,
            justification:
              service.title === 'Culto Quinta 1' && item.ministry.name === 'Mídia'
                ? 'Imprevisto no trabalho'
                : service.title === 'Culto Domingo Manhã 1' && item.ministry.name === 'Intercessão'
                ? 'Consulta médica'
                : null,
            registeredByUserId: admin.id,
          },
        });
      }
    }
  }

  const cultoDomingoNoite1 = createdServices.find(
    (svc) => svc.title === 'Culto Domingo Noite 1',
  );

  const recepcaoMinistry = createdMinistries.find(
    (m) => m.ministry.name === 'Recepção',
  );

  const receptionSchedule = createdSchedules.find(
    (s) =>
      s.serviceId === cultoDomingoNoite1?.id &&
      s.ministryId === recepcaoMinistry?.ministry.id,
  );

  const mediaMinistry = createdMinistries.find((m) => m.ministry.name === 'Mídia')!;
  if (receptionSchedule) {
    const swappedTo = await prisma.schedule.create({
      data: {
        churchId: church.id,
        serviceId: receptionSchedule.serviceId,
        servantId: mediaMinistry.servants[1].id,
        ministryId: mediaMinistry.ministry.id,
        assignedByUserId: admin.id,
        status: ScheduleStatus.SWAPPED,
        responseStatus: ScheduleResponseStatus.CONFIRMED,
        responseAt: new Date('2026-03-14T14:30:00.000Z'),
      },
    });

    await prisma.scheduleSwapHistory.create({
      data: {
        fromScheduleId: receptionSchedule.id,
        toScheduleId: swappedTo.id,
        reason: 'Troca aprovada por indisponibilidade de última hora',
        swappedByUserId: createdMinistries[0].coordinatorUser.id,
      },
    });

    await prisma.scheduleResponseHistory.createMany({
      data: [
        {
          scheduleId: receptionSchedule.id,
          responseStatus: ScheduleResponseStatus.DECLINED,
          declineReason: 'Imprevisto familiar',
          respondedByUserId: createdMinistries[0].coordinatorUser.id,
          respondedAt: new Date('2026-03-14T12:00:00.000Z'),
        },
        {
          scheduleId: swappedTo.id,
          responseStatus: ScheduleResponseStatus.CONFIRMED,
          respondedByUserId: mediaMinistry.coordinatorUser.id,
          respondedAt: new Date('2026-03-14T14:30:00.000Z'),
        },
      ],
    });
  }

  for (const item of createdMinistries) {
    const template = await prisma.ministryTaskTemplate.create({
      data: {
        churchId: church.id,
        ministryId: item.ministry.id,
        name: `Checklist Pré-Culto - ${item.ministry.name}`,
        description: `Checklist principal do ministério ${item.ministry.name}`,
        recurrenceType: MinistryTaskRecurrenceType.EVERY_SERVICE,
        assigneeMode: MinistryTaskAssigneeMode.REQUIRED,
        reallocationMode: MinistryTaskReallocationMode.MANUAL,
        createdBy: item.coordinatorUser.id,
        active: true,
      },
    });

    await prisma.ministryTaskTemplateChecklistItem.createMany({
      data: [
        {
          templateId: template.id,
          label: 'Checar presença da equipe',
          position: 1,
          required: true,
        },
        {
          templateId: template.id,
          label: 'Organizar área de atuação',
          position: 2,
          required: true,
        },
        {
          templateId: template.id,
          label: 'Alinhar com coordenação',
          position: 3,
          required: true,
        },
      ],
      skipDuplicates: true,
    });

    for (const [serviceIndex, service] of createdServices.entries()) {
      const assignedServant = item.servants[(serviceIndex + 1) % item.servants.length];
      const occurrenceStatus =
        serviceIndex === 0
          ? MinistryTaskOccurrenceStatus.COMPLETED
          : serviceIndex === 1
          ? MinistryTaskOccurrenceStatus.OVERDUE
          : serviceIndex === 2
          ? MinistryTaskOccurrenceStatus.ASSIGNED
          : serviceIndex === 3
          ? MinistryTaskOccurrenceStatus.PENDING
          : MinistryTaskOccurrenceStatus.IN_PROGRESS;

      const occurrence = await prisma.ministryTaskOccurrence.create({
        data: {
          churchId: church.id,
          templateId: template.id,
          ministryId: item.ministry.id,
          serviceId: service.id,
          scheduledFor: service.serviceDate,
          assignedServantId: assignedServant?.id,
          originAssignedServantId: assignedServant?.id,
          status: occurrenceStatus,
          reallocationMode: MinistryTaskReallocationMode.MANUAL,
          reallocationStatus: 'NONE',
          priority:
            occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE
              ? MinistryTaskOccurrencePriority.HIGH
              : MinistryTaskOccurrencePriority.MEDIUM,
          criticality:
            occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE
              ? MinistryTaskOccurrenceCriticality.HIGH
              : MinistryTaskOccurrenceCriticality.MEDIUM,
          progressPercent:
            occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED
              ? 100
              : occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE
              ? 60
              : occurrenceStatus === MinistryTaskOccurrenceStatus.IN_PROGRESS
              ? 40
              : 0,
          dueAt: new Date(service.serviceDate.getTime() - 60 * 60 * 1000),
          startedAt:
            occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED ||
            occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE ||
            occurrenceStatus === MinistryTaskOccurrenceStatus.IN_PROGRESS
              ? new Date(service.serviceDate.getTime() - 90 * 60 * 1000)
              : null,
          completedAt:
            occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED
              ? new Date(service.serviceDate.getTime() - 10 * 60 * 1000)
              : null,
          completedBy:
            occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED
              ? item.coordinatorUser.id
              : null,
          lastProgressAt:
            occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE ||
            occurrenceStatus === MinistryTaskOccurrenceStatus.IN_PROGRESS
              ? new Date(service.serviceDate.getTime() - 30 * 60 * 1000)
              : null,
          notes:
            occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE
              ? 'Tarefa atrasou por ausência parcial da equipe.'
              : occurrenceStatus === MinistryTaskOccurrenceStatus.IN_PROGRESS
              ? 'Execução em andamento.'
              : null,
        },
      });

      await prisma.ministryTaskOccurrenceAssignee.create({
        data: {
          occurrenceId: occurrence.id,
          servantId: assignedServant.id,
          role: 'PRIMARY',
          active: true,
          createdBy: item.coordinatorUser.id,
        },
      }).catch(() => null);

      const supportServant = item.servants[(serviceIndex + 2) % item.servants.length];
      await prisma.ministryTaskOccurrenceAssignee.create({
        data: {
          occurrenceId: occurrence.id,
          servantId: supportServant.id,
          role: 'SUPPORT',
          active: occurrenceStatus !== MinistryTaskOccurrenceStatus.PENDING,
          createdBy: item.coordinatorUser.id,
        },
      }).catch(() => null);

      const templateItems = await prisma.ministryTaskTemplateChecklistItem.findMany({
        where: { templateId: template.id },
        orderBy: { position: 'asc' },
      });

      for (const checklistItem of templateItems) {
        await prisma.ministryTaskOccurrenceChecklistItem.create({
          data: {
            occurrenceId: occurrence.id,
            templateChecklistItemId: checklistItem.id,
            label: checklistItem.label,
            description: checklistItem.description,
            position: checklistItem.position,
            required: checklistItem.required,
            status:
              occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED
                ? 'DONE'
                : occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE && checklistItem.position === 1
                ? 'DONE'
                : occurrenceStatus === MinistryTaskOccurrenceStatus.IN_PROGRESS && checklistItem.position <= 2
                ? 'DONE'
                : 'PENDING',
            checkedAt:
              occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED
                ? new Date()
                : occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE && checklistItem.position === 1
                ? new Date()
                : occurrenceStatus === MinistryTaskOccurrenceStatus.IN_PROGRESS && checklistItem.position <= 2
                ? new Date()
                : null,
            checkedBy:
              occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED
                ? item.coordinatorUser.id
                : occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE && checklistItem.position === 1
                ? item.coordinatorUser.id
                : occurrenceStatus === MinistryTaskOccurrenceStatus.IN_PROGRESS && checklistItem.position <= 2
                ? item.coordinatorUser.id
                : null,
            notes:
              occurrenceStatus === MinistryTaskOccurrenceStatus.OVERDUE &&
              checklistItem.position > 1
                ? 'Item ainda pendente.'
                : null,
          },
        }).catch(() => null);
      }
    }
  }

  const receptionMinistry = createdMinistries[0];
  const intercessionMinistry = createdMinistries[2];

  await prisma.pastoralVisit.createMany({
    data: [
      {
        churchId: church.id,
        servantId: receptionMinistry.servants[2].id,
        reason: 'Acompanhamento por adaptação no ministério',
        status: PastoralVisitStatus.ABERTA,
        createdByUserId: pastor.id,
      },
      {
        churchId: church.id,
        servantId: mediaMinistry.servants[3].id,
        reason: 'Conversa pastoral após sequência de atrasos',
        status: PastoralVisitStatus.EM_ANDAMENTO,
        createdByUserId: pastor.id,
      },
      {
        churchId: church.id,
        servantId: intercessionMinistry.servants[1].id,
        reason: 'Retorno após período de ausência',
        status: PastoralVisitStatus.RESOLVIDA,
        createdByUserId: pastor.id,
        resolvedByUserId: pastor.id,
        resolvedAt: new Date('2026-03-16T18:00:00.000Z'),
        notes: 'Acompanhamento concluído com sucesso.',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.pastoralAlert.createMany({
    data: [
      {
        churchId: church.id,
        servantId: intercessionMinistry.servants[1].id,
        trigger: 'FOLLOW_UP',
        message: 'Servo precisa de acompanhamento pastoral nas próximas semanas.',
        status: AlertStatus.OPEN,
        createdByUserId: pastor.id,
      },
      {
        churchId: church.id,
        servantId: mediaMinistry.servants[0].id,
        trigger: 'TASK_OVERLOAD',
        message: 'Servo acumulando muitas responsabilidades técnicas.',
        status: AlertStatus.OPEN,
        createdByUserId: pastor.id,
      },
      {
        churchId: church.id,
        servantId: receptionMinistry.servants[5].id,
        trigger: 'RECENT_ABSENCE',
        message: 'Acompanhar faltas recentes.',
        status: AlertStatus.RESOLVED,
        createdByUserId: pastor.id,
        resolvedByUserId: pastor.id,
        resolvedAt: new Date('2026-03-18T12:00:00.000Z'),
      },
    ],
    skipDuplicates: true,
  });

  for (const servant of allServants) {
    await prisma.servantJourney.upsert({
      where: { servantId: servant.id },
      update: {
        churchId: church.id,
        startedAt: servant.joinedAt ?? servant.createdAt,
        totalServices: 4,
        totalTasksCompleted: 3,
        totalTrainingsCompleted:
          servant.trainingStatus === TrainingStatus.COMPLETED ? 1 : 0,
        totalEventsServed: 2,
        monthsServing: 12,
        lastActivityAt: new Date('2026-03-22T21:00:00.000Z'),
      },
      create: {
        servantId: servant.id,
        churchId: church.id,
        startedAt: servant.joinedAt ?? servant.createdAt,
        totalServices: 4,
        totalTasksCompleted: 3,
        totalTrainingsCompleted:
          servant.trainingStatus === TrainingStatus.COMPLETED ? 1 : 0,
        totalEventsServed: 2,
        monthsServing: 12,
        lastActivityAt: new Date('2026-03-22T21:00:00.000Z'),
      },
    });
  }

  const milestoneWelcome = await prisma.journeyMilestone.upsert({
    where: { code: 'primeiro_culto_servido' },
    update: {
      churchId: church.id,
      name: 'Primeiro Culto Servido',
      description: 'Participou do primeiro culto em escala.',
      category: 'INÍCIO',
    },
    create: {
      churchId: church.id,
      code: 'primeiro_culto_servido',
      name: 'Primeiro Culto Servido',
      description: 'Participou do primeiro culto em escala.',
      category: 'INÍCIO',
    },
  });

  const milestoneTraining = await prisma.journeyMilestone.upsert({
    where: { code: 'treinamento_concluido' },
    update: {
      churchId: church.id,
      name: 'Treinamento Concluído',
      description: 'Concluiu treinamento ministerial.',
      category: 'FORMAÇÃO',
    },
    create: {
      churchId: church.id,
      code: 'treinamento_concluido',
      name: 'Treinamento Concluído',
      description: 'Concluiu treinamento ministerial.',
      category: 'FORMAÇÃO',
    },
  });

  await prisma.servantMilestone.createMany({
    data: allServants.slice(0, 12).flatMap((servant, index) => {
      const rows = [
        {
          churchId: church.id,
          servantId: servant.id,
          milestoneId: milestoneWelcome.id,
        },
      ];
      if (index % 2 === 0 && servant.trainingStatus === TrainingStatus.COMPLETED) {
        rows.push({
          churchId: church.id,
          servantId: servant.id,
          milestoneId: milestoneTraining.id,
        });
      }
      return rows;
    }),
    skipDuplicates: true,
  });

  await prisma.journeyLog.createMany({
    data: [
      {
        churchId: church.id,
        servantId: receptionMinistry.servants[0].id,
        type: 'SERVICE',
        title: 'Serviu no Culto Domingo Manhã',
        description: 'Atuou na recepção principal.',
        occurredAt: new Date('2026-03-08T10:00:00.000Z'),
      },
      {
        churchId: church.id,
        servantId: mediaMinistry.servants[0].id,
        type: 'TASK',
        title: 'Concluiu checklist técnico',
        description: 'Finalizou checklist da mídia antes do culto.',
        occurredAt: new Date('2026-03-12T19:00:00.000Z'),
      },
      {
        churchId: church.id,
        servantId: intercessionMinistry.servants[2].id,
        type: 'TRAINING',
        title: 'Treinamento de intercessão concluído',
        description: 'Finalizou a trilha inicial do ministério.',
        occurredAt: new Date('2026-03-10T20:00:00.000Z'),
      },
      {
        churchId: church.id,
        servantId: createdMinistries[3].servants[0].id,
        type: 'EVENT',
        title: 'Participou de evento especial',
        description: 'Atuação em culto especial de domingo à noite.',
        occurredAt: new Date('2026-03-15T22:00:00.000Z'),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.timelineEntry.createMany({
    data: [
      {
        churchId: church.id,
        scope: TimelineScope.CHURCH,
        type: TimelineEntryType.SCHEDULE_PUBLISHED,
        title: 'Escalas publicadas',
        description: 'Escalas principais da semana foram publicadas.',
        actorUserId: admin.id,
        occurredAt: new Date('2026-03-07T15:00:00.000Z'),
      },
      {
        churchId: church.id,
        ministryId: receptionMinistry.ministry.id,
        scope: TimelineScope.MINISTRY,
        type: TimelineEntryType.TASK_COMPLETED,
        title: 'Checklist da Recepção concluído',
        description: 'Checklist pré-culto concluído com sucesso.',
        servantId: receptionMinistry.servants[1].id,
        actorUserId: receptionMinistry.coordinatorUser.id,
        occurredAt: new Date('2026-03-08T09:20:00.000Z'),
      },
      {
        churchId: church.id,
        servantId: intercessionMinistry.servants[2].id,
        scope: TimelineScope.SERVANT,
        type: TimelineEntryType.TRAINING_COMPLETED,
        title: 'Treinamento concluído',
        description: 'Servo concluiu treinamento ministerial.',
        actorUserId: intercessionMinistry.coordinatorUser.id,
        occurredAt: new Date('2026-03-10T20:00:00.000Z'),
      },
      {
        churchId: church.id,
        ministryId: mediaMinistry.ministry.id,
        scope: TimelineScope.MINISTRY,
        type: TimelineEntryType.TASK_OVERDUE,
        title: 'Tarefa atrasada na mídia',
        description: 'Ocorrência ultrapassou o horário previsto.',
        actorUserId: mediaMinistry.coordinatorUser.id,
        occurredAt: new Date('2026-03-12T19:40:00.000Z'),
      },
      {
        churchId: church.id,
        scope: TimelineScope.CHURCH,
        type: TimelineEntryType.PASTORAL_ALERT,
        title: 'Alerta pastoral registrado',
        description: 'Novo alerta pastoral aberto para acompanhamento.',
        actorUserId: pastor.id,
        occurredAt: new Date('2026-03-16T18:10:00.000Z'),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.automationRule.createMany({
    data: [
      {
        churchId: church.id,
        name: 'Notificar tarefas próximas do vencimento',
        description: 'Dispara alerta para tarefas perto do horário limite.',
        triggerType: 'TIME',
        triggerConfig: { everyMinutes: 30 },
        actionType: 'TASK_NOTIFY_DUE_SOON',
        actionConfig: { notifyCoordinator: true },
        enabled: true,
        createdBy: admin.id,
      },
      {
        churchId: church.id,
        name: 'Marcar tarefa atrasada',
        description: 'Marca ocorrências em atraso automaticamente.',
        triggerType: 'CONDITION',
        triggerConfig: { field: 'dueAt', operator: 'lt_now' },
        actionType: 'TASK_MARK_OVERDUE',
        actionConfig: { updateStatus: 'OVERDUE' },
        enabled: true,
        createdBy: admin.id,
      },
      {
        churchId: church.id,
        name: 'Alertar escala incompleta',
        description: 'Dispara aviso para ministérios com escala incompleta.',
        triggerType: 'EVENT',
        triggerConfig: { event: 'schedule_incomplete' },
        actionType: 'SCHEDULE_ALERT_INCOMPLETE',
        actionConfig: { notifyCoordinator: true },
        enabled: true,
        createdBy: admin.id,
      },
    ],
    skipDuplicates: true,
  });

  const automationRules = await prisma.automationRule.findMany({
    where: { churchId: church.id },
    orderBy: { createdAt: 'asc' },
  });

  for (const [index, rule] of automationRules.entries()) {
    await prisma.automationExecutionLog.create({
      data: {
        churchId: church.id,
        ruleId: rule.id,
        dedupeKey: `seed-rule-${index + 1}`,
        status: index === 1 ? 'SUCCESS_WITH_ALERT' : 'SUCCESS',
        message: 'Execução simulada criada pelo seed.',
        processed: index + 1,
        metadata: { source: 'seed', rule: rule.name },
      },
    }).catch(() => null);
  }

  await prisma.auditLog.createMany({
    data: [
      {
        churchId: church.id,
        action: AuditAction.CREATE_MINISTRY,
        entity: 'Ministry',
        entityId: createdMinistries[0].ministry.id,
        metadata: { source: 'seed', name: createdMinistries[0].ministry.name },
        userId: admin.id,
      },
      {
        churchId: church.id,
        action: AuditAction.GENERATE_SCHEDULE,
        entity: 'WorshipService',
        entityId: createdServices[0].id,
        metadata: { source: 'seed', service: createdServices[0].title },
        userId: admin.id,
      },
      {
        churchId: church.id,
        action: AuditAction.SCHEDULE_SWAP,
        entity: 'Schedule',
        entityId: receptionSchedule?.id ?? createdServices[2].id,
        metadata: { source: 'seed', reason: 'Troca simulada para teste' },
        userId: receptionMinistry.coordinatorUser.id,
      },
      {
        churchId: church.id,
        action: AuditAction.MINISTRY_TASK_OCCURRENCE_CREATED,
        entity: 'MinistryTaskOccurrence',
        entityId: createdMinistries[0].ministry.id,
        metadata: { source: 'seed' },
        userId: createdMinistries[0].coordinatorUser.id,
      },
      {
        churchId: church.id,
        action: AuditAction.PASTORAL_ACTION,
        entity: 'PastoralVisit',
        entityId: receptionMinistry.servants[2].id,
        metadata: { source: 'seed', action: 'follow_up_opened' },
        userId: pastor.id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.notification.createMany({
    data: [
      {
        churchId: church.id,
        userId: admin.id,
        type: 'SYSTEM',
        title: 'Seed executado',
        message: 'Base de testes carregada com sucesso.',
      },
      {
        churchId: church.id,
        userId: pastor.id,
        type: 'PASTORAL',
        title: 'Acompanhamentos pendentes',
        message: 'Existem acompanhamentos pastorais em aberto para revisão.',
      },
      {
        churchId: church.id,
        userId: receptionMinistry.coordinatorUser.id,
        type: 'TASK',
        title: 'Tarefas do ministério',
        message: 'Existem tarefas próximas do vencimento no seu ministério.',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.notificationPreference.createMany({
    data: [
      {
        userId: admin.id,
        channel: NotificationChannel.IN_APP,
        enabled: true,
      },
      {
        userId: pastor.id,
        channel: NotificationChannel.IN_APP,
        enabled: true,
      },
      {
        userId: receptionMinistry.coordinatorUser.id,
        channel: NotificationChannel.WHATSAPP,
        enabled: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.refreshToken.create({
    data: {
      userId: admin.id,
      tokenHash: await bcrypt.hash('seed-refresh-admin', 10),
      expiresAt: new Date('2026-04-01T00:00:00.000Z'),
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: pastor.id,
      tokenHash: await bcrypt.hash('seed-reset-pastor', 10),
      expiresAt: new Date('2026-04-02T00:00:00.000Z'),
    },
  });

  console.log('Seed completed successfully.');
  console.log(`Senha padrão: ${DEFAULT_PASSWORD}`);
  console.log('Logins principais:');
  console.log('- superadmin@servos.local');
  console.log('- admin@servos.local');
  console.log('- pastor@servos.local');
  console.log('- caique@servos.local');
  console.log('- maria.eduarda@servos.local');
  console.log('- ruan.oliveira@servos.local');
  console.log('- ana.paula@servos.local');
  console.log('- fernanda@servos.local');
  console.log('- joao.marcos@servos.local');
  console.log(`Super admin id: ${superAdmin.id}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });