import {
  Aptitude,
  AlertStatus,
  AuditAction,
  AttendanceStatus,
  Gender,
  ScheduleStatus,
  TrainingStatus,
  PrismaClient,
  Role,
  ServantStatus,
  TeamStatus,
  TalentStage,
  UserStatus,
  UserScope,
  WorshipServiceStatus,
  WorshipServiceType,
  PastoralVisitStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const prismaAny = prisma as any;
const DEFAULT_PASSWORD = '123456';
const SCHEDULE_RESPONSE = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  DECLINED: 'DECLINED',
} as const;
const AVAILABILITY_SHIFT = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  EVENING: 'EVENING',
} as const;
const MINISTRY_SCOPE = (UserScope as unknown as { MINISTRY?: UserScope }).MINISTRY ?? UserScope.MINISTRY;

async function upsertUserByEmail(params: {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  scope?: UserScope;
  status?: UserStatus;
  phone?: string | null;
  servantId?: string | null;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      passwordHash: params.passwordHash,
      role: params.role,
      scope: params.scope,
      status: params.status,
      phone: params.phone ?? null,
      servantId: params.servantId ?? null,
    },
    create: {
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      role: params.role,
      scope: params.scope,
      status: params.status,
      phone: params.phone ?? null,
      servantId: params.servantId ?? null,
    },
  });
}

async function clearServantLinks(servantIds: string[], exceptUserIds: string[]) {
  if (!servantIds.length) {
    return;
  }

  await prisma.user.updateMany({
    where: {
      servantId: { in: servantIds },
      id: { notIn: exceptUserIds },
    },
    data: { servantId: null },
  });
}

async function upsertServantByName(params: {
  name: string;
  phone?: string;
  gender?: Gender;
  birthDate?: Date;
  status?: ServantStatus;
  trainingStatus?: TrainingStatus;
  aptitude?: Aptitude;
  teamId?: string;
  mainMinistryId?: string;
  notes?: string;
  consecutiveAbsences?: number;
  monthlyAbsences?: number;
  joinedAt?: Date;
}) {
  const existing = await prisma.servant.findFirst({
    where: { name: params.name },
    select: { id: true },
  });

  if (existing) {
    return prisma.servant.update({
      where: { id: existing.id },
      data: {
        phone: params.phone,
        gender: params.gender,
        birthDate: params.birthDate,
        status: params.status,
        trainingStatus: params.trainingStatus,
        aptitude: params.aptitude,
        teamId: params.teamId,
        mainMinistryId: params.mainMinistryId,
        notes: params.notes,
        consecutiveAbsences: params.consecutiveAbsences,
        monthlyAbsences: params.monthlyAbsences,
        joinedAt: params.joinedAt,
      },
    });
  }

  return prisma.servant.create({
    data: {
      name: params.name,
      phone: params.phone,
      gender: params.gender,
      birthDate: params.birthDate,
      status: params.status,
      trainingStatus: params.trainingStatus,
      aptitude: params.aptitude,
      teamId: params.teamId,
      mainMinistryId: params.mainMinistryId,
      notes: params.notes,
      consecutiveAbsences: params.consecutiveAbsences,
      monthlyAbsences: params.monthlyAbsences,
      joinedAt: params.joinedAt,
    },
  });
}

async function main() {
  console.log('Starting seed...');

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    console.log('Upserting users...');
    const superAdmin = await upsertUserByEmail({
      email: 'superadmin@servos.local',
      name: 'Super Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
      scope: UserScope.GLOBAL,
      status: UserStatus.ACTIVE,
      phone: '11999990000',
    });

    const admin = await upsertUserByEmail({
      email: 'admin@servos.local',
      name: 'Admin Geral',
      passwordHash,
      role: Role.ADMIN,
      scope: UserScope.GLOBAL,
      status: UserStatus.ACTIVE,
      phone: '11999990010',
    });

    const pastor = await upsertUserByEmail({
      email: 'pastor@servos.local',
      name: 'Pr. Elias',
      passwordHash,
      role: Role.PASTOR,
      scope: UserScope.GLOBAL,
      status: UserStatus.ACTIVE,
    });

    const coordenador = await upsertUserByEmail({
      email: 'coordenador@servos.local',
      name: 'Coord. Joao',
      passwordHash,
      role: Role.COORDENADOR,
      scope: MINISTRY_SCOPE,
      status: UserStatus.ACTIVE,
    });

    const coordenadorApoio = await upsertUserByEmail({
      email: 'coordenador.apoio@servos.local',
      name: 'Coord. Maria',
      passwordHash,
      role: Role.COORDENADOR,
      scope: MINISTRY_SCOPE,
      status: UserStatus.ACTIVE,
    });

    const servo = await upsertUserByEmail({
      email: 'apoio@servos.local',
      name: 'Servo Pedro',
      passwordHash,
      role: Role.SERVO,
      scope: UserScope.SELF,
      status: UserStatus.ACTIVE,
    });

    console.log('Upserting ministries...');
    const recepcao = await prisma.ministry.upsert({
      where: { name: 'Recepcao' },
      update: {
        description: 'Primeiro contato e acolhimento',
        color: '#1D4ED8',
        icon: 'door-open',
        popText: 'Sorriso e organizacao na entrada',
        coordinatorUserId: coordenador.id,
      },
      create: {
        name: 'Recepcao',
        description: 'Primeiro contato e acolhimento',
        color: '#1D4ED8',
        icon: 'door-open',
        popText: 'Sorriso e organizacao na entrada',
        coordinatorUserId: coordenador.id,
      },
    });

    const midia = await prisma.ministry.upsert({
      where: { name: 'Midia' },
      update: {
        description: 'Som, projecao e transmissao',
        color: '#0F766E',
        icon: 'monitor',
        popText: 'Excelencia tecnica no culto',
      },
      create: {
        name: 'Midia',
        description: 'Som, projecao e transmissao',
        color: '#0F766E',
        icon: 'monitor',
        popText: 'Excelencia tecnica no culto',
      },
    });

    const intercessao = await prisma.ministry.upsert({
      where: { name: 'Intercessao' },
      update: {
        description: 'Cobertura espiritual e apoio pastoral',
        color: '#B45309',
        icon: 'hands-praying',
        popText: 'Base espiritual do ministerio',
      },
      create: {
        name: 'Intercessao',
        description: 'Cobertura espiritual e apoio pastoral',
        color: '#B45309',
        icon: 'hands-praying',
        popText: 'Base espiritual do ministerio',
      },
    });

    console.log('Upserting teams...');
    const recepcaoEquipeA = await prisma.team.upsert({
      where: { ministryId_name: { ministryId: recepcao.id, name: 'A' } },
      update: {
        slug: 'a',
        description: 'Equipe A da Recepcao',
        status: TeamStatus.ACTIVE,
      },
      create: {
        name: 'A',
        slug: 'a',
        description: 'Equipe A da Recepcao',
        ministryId: recepcao.id,
        status: TeamStatus.ACTIVE,
      },
    });

    const midiaEquipeB = await prisma.team.upsert({
      where: { ministryId_name: { ministryId: midia.id, name: 'B' } },
      update: {
        slug: 'b',
        description: 'Equipe B da Midia',
        status: TeamStatus.ACTIVE,
      },
      create: {
        name: 'B',
        slug: 'b',
        description: 'Equipe B da Midia',
        ministryId: midia.id,
        status: TeamStatus.ACTIVE,
      },
    });

    const intercessaoEquipeC = await prisma.team.upsert({
      where: { ministryId_name: { ministryId: intercessao.id, name: 'C' } },
      update: {
        slug: 'c',
        description: 'Equipe C da Intercessao',
        status: TeamStatus.ACTIVE,
      },
      create: {
        name: 'C',
        slug: 'c',
        description: 'Equipe C da Intercessao',
        ministryId: intercessao.id,
        status: TeamStatus.ACTIVE,
      },
    });

    console.log('Upserting servants...');
    const lucas = await upsertServantByName({
      name: 'Lucas Alves',
      phone: '11999990001',
      gender: Gender.MASCULINO,
      birthDate: new Date('1998-05-12T00:00:00Z'),
      status: ServantStatus.ATIVO,
      trainingStatus: TrainingStatus.COMPLETED,
      aptitude: Aptitude.SOCIAL,
      teamId: recepcaoEquipeA.id,
      mainMinistryId: recepcao.id,
      notes: 'Comunicativo e responsavel na recepcao.',
      joinedAt: new Date('2024-03-01T00:00:00Z'),
    });

    const carla = await upsertServantByName({
      name: 'Carla Menezes',
      phone: '11999990002',
      gender: Gender.FEMININO,
      birthDate: new Date('1995-09-01T00:00:00Z'),
      status: ServantStatus.ATIVO,
      trainingStatus: TrainingStatus.COMPLETED,
      aptitude: Aptitude.TECNICO,
      teamId: midiaEquipeB.id,
      mainMinistryId: midia.id,
      notes: 'Referencia em transmissao e projecao.',
      joinedAt: new Date('2023-08-20T00:00:00Z'),
    });

    const renato = await upsertServantByName({
      name: 'Renato Lima',
      phone: '11999990003',
      gender: Gender.MASCULINO,
      status: ServantStatus.RECICLAGEM,
      trainingStatus: TrainingStatus.PENDING,
      aptitude: Aptitude.APOIO,
      teamId: recepcaoEquipeA.id,
      mainMinistryId: recepcao.id,
      notes: 'Em processo de reciclagem.',
      consecutiveAbsences: 1,
      monthlyAbsences: 1,
    });

    const bruna = await upsertServantByName({
      name: 'Bruna Costa',
      phone: '11999990004',
      gender: Gender.FEMININO,
      status: ServantStatus.ATIVO,
      trainingStatus: TrainingStatus.COMPLETED,
      aptitude: Aptitude.LIDERANCA,
      teamId: intercessaoEquipeC.id,
      mainMinistryId: intercessao.id,
      notes: 'Perfil de lideranca e cuidado pastoral.',
    });

    const mateus = await upsertServantByName({
      name: 'Mateus Rocha',
      phone: '11999990005',
      gender: Gender.MASCULINO,
      status: ServantStatus.AFASTADO,
      trainingStatus: TrainingStatus.COMPLETED,
      aptitude: Aptitude.OPERACIONAL,
      teamId: midiaEquipeB.id,
      mainMinistryId: midia.id,
      notes: 'Afastado temporariamente por questoes pessoais.',
      consecutiveAbsences: 2,
      monthlyAbsences: 3,
    });

    console.log('Upserting servant linked users...');
    const renatoUser = await upsertUserByEmail({
      email: 'renato@servos.local',
      name: 'Renato Lima',
      passwordHash,
      role: Role.SERVO,
      scope: UserScope.SELF,
      status: UserStatus.ACTIVE,
      servantId: renato.id,
      phone: renato.phone ?? '11999990003',
    });

    const mateusUser = await upsertUserByEmail({
      email: 'mateus@servos.local',
      name: 'Mateus Rocha',
      passwordHash,
      role: Role.SERVO,
      scope: UserScope.SELF,
      status: UserStatus.ACTIVE,
      servantId: mateus.id,
      phone: mateus.phone ?? '11999990005',
    });

    console.log('Cleaning operational records to keep seed deterministic...');
    await prisma.scheduleSwapHistory.deleteMany();
    await prisma.scheduleResponseHistory.deleteMany();
    await prismaAny.servantAvailability.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.pastoralVisit.deleteMany();
    await prisma.pastoralAlert.deleteMany();
    await prisma.talent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.servantStatusHistory.deleteMany();
    await prisma.userMinistryBinding.deleteMany({
      where: { userId: { in: [coordenador.id, coordenadorApoio.id] } },
    });
    await prisma.servantMinistry.deleteMany({
      where: { servantId: { in: [lucas.id, carla.id, renato.id, bruna.id, mateus.id] } },
    });

    await prisma.servant.updateMany({
      where: { id: { in: [lucas.id, carla.id, renato.id, bruna.id, mateus.id] } },
      data: { trainingStatus: TrainingStatus.COMPLETED },
    });

    await prisma.servant.update({
      where: { id: renato.id },
      data: { trainingStatus: TrainingStatus.PENDING },
    });

    await prisma.servantMinistry.createMany({
      data: [
        { servantId: lucas.id, ministryId: recepcao.id },
        { servantId: lucas.id, ministryId: intercessao.id },
        { servantId: carla.id, ministryId: midia.id },
        { servantId: renato.id, ministryId: recepcao.id },
        { servantId: bruna.id, ministryId: intercessao.id },
        { servantId: mateus.id, ministryId: midia.id },
      ],
      skipDuplicates: true,
    });

    await clearServantLinks(
      [bruna.id, lucas.id, carla.id, renato.id, mateus.id],
      [coordenador.id, coordenadorApoio.id, servo.id, renatoUser.id, mateusUser.id],
    );

    await prisma.user.update({
      where: { id: coordenador.id },
      data: { servantId: bruna.id, scope: MINISTRY_SCOPE },
    });

    await prisma.user.update({
      where: { id: coordenadorApoio.id },
      data: { servantId: lucas.id, scope: MINISTRY_SCOPE },
    });

    await prisma.user.update({
      where: { id: servo.id },
      data: { servantId: carla.id, scope: UserScope.SELF, role: Role.SERVO },
    });

    await prisma.team.update({
      where: { id: recepcaoEquipeA.id },
      data: { leaderUserId: coordenadorApoio.id },
    });

    await prisma.userMinistryBinding.createMany({
      data: [
        {
          userId: coordenador.id,
          ministryId: recepcao.id,
          teamId: null,
        },
        {
          userId: coordenadorApoio.id,
          ministryId: recepcao.id,
          teamId: recepcaoEquipeA.id,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.servantStatusHistory.createMany({
      data: [lucas, carla, renato, bruna, mateus].map((servant) => ({
        servantId: servant.id,
        toStatus: servant.status,
        reason: 'Carga inicial seed',
      })),
    });

    console.log('Upserting worship services...');
    const cultoDomingoManha = await prisma.worshipService.upsert({
      where: {
        serviceDate_startTime_title: {
          serviceDate: new Date('2026-03-08T10:00:00Z'),
          startTime: '10:00',
          title: 'Culto Domingo Manha',
        },
      },
      update: {
        type: WorshipServiceType.DOMINGO,
        status: WorshipServiceStatus.FINALIZADO,
      },
      create: {
        type: WorshipServiceType.DOMINGO,
        title: 'Culto Domingo Manha',
        serviceDate: new Date('2026-03-08T10:00:00Z'),
        startTime: '10:00',
        status: WorshipServiceStatus.FINALIZADO,
      },
    });

    const cultoQuintaNoite = await prisma.worshipService.upsert({
      where: {
        serviceDate_startTime_title: {
          serviceDate: new Date('2026-03-12T22:30:00Z'),
          startTime: '19:30',
          title: 'Culto Quinta Noite',
        },
      },
      update: {
        type: WorshipServiceType.QUINTA,
        status: WorshipServiceStatus.FINALIZADO,
      },
      create: {
        type: WorshipServiceType.QUINTA,
        title: 'Culto Quinta Noite',
        serviceDate: new Date('2026-03-12T22:30:00Z'),
        startTime: '19:30',
        status: WorshipServiceStatus.FINALIZADO,
      },
    });

    const cultoDomingoNoite = await prisma.worshipService.upsert({
      where: {
        serviceDate_startTime_title: {
          serviceDate: new Date('2026-03-15T22:30:00Z'),
          startTime: '19:30',
          title: 'Culto Domingo Noite',
        },
      },
      update: {
        type: WorshipServiceType.DOMINGO,
        status: WorshipServiceStatus.CONFIRMADO,
      },
      create: {
        type: WorshipServiceType.DOMINGO,
        title: 'Culto Domingo Noite',
        serviceDate: new Date('2026-03-15T22:30:00Z'),
        startTime: '19:30',
        status: WorshipServiceStatus.CONFIRMADO,
      },
    });

    console.log('Upserting schedules and attendances...');
    const scheduleDomingoManhaLucas = await prisma.schedule.upsert({
      where: {
        serviceId_servantId_ministryId: {
          serviceId: cultoDomingoManha.id,
          servantId: lucas.id,
          ministryId: recepcao.id,
        },
      },
      update: {
        assignedByUserId: admin.id,
        responseStatus: SCHEDULE_RESPONSE.CONFIRMED,
        responseAt: new Date('2026-03-07T17:10:00Z'),
        declineReason: null,
      } as any,
      create: {
        serviceId: cultoDomingoManha.id,
        servantId: lucas.id,
        ministryId: recepcao.id,
        assignedByUserId: admin.id,
        responseStatus: SCHEDULE_RESPONSE.CONFIRMED,
        responseAt: new Date('2026-03-07T17:10:00Z'),
      } as any,
    });

    const scheduleQuintaNoiteCarla = await prisma.schedule.upsert({
      where: {
        serviceId_servantId_ministryId: {
          serviceId: cultoQuintaNoite.id,
          servantId: carla.id,
          ministryId: midia.id,
        },
      },
      update: {
        assignedByUserId: admin.id,
        responseStatus: SCHEDULE_RESPONSE.DECLINED,
        responseAt: new Date('2026-03-11T20:40:00Z'),
        declineReason: 'Plantao extraordinario no trabalho',
      } as any,
      create: {
        serviceId: cultoQuintaNoite.id,
        servantId: carla.id,
        ministryId: midia.id,
        assignedByUserId: admin.id,
        responseStatus: SCHEDULE_RESPONSE.DECLINED,
        responseAt: new Date('2026-03-11T20:40:00Z'),
        declineReason: 'Plantao extraordinario no trabalho',
      } as any,
    });

    await prisma.schedule.upsert({
      where: {
        serviceId_servantId_ministryId: {
          serviceId: cultoDomingoNoite.id,
          servantId: bruna.id,
          ministryId: intercessao.id,
        },
      },
      update: { assignedByUserId: admin.id },
      create: {
        serviceId: cultoDomingoNoite.id,
        servantId: bruna.id,
        ministryId: intercessao.id,
        assignedByUserId: admin.id,
      },
    });

    const scheduleDomingoNoiteLucas = await prisma.schedule.upsert({
      where: {
        serviceId_servantId_ministryId: {
          serviceId: cultoDomingoNoite.id,
          servantId: lucas.id,
          ministryId: recepcao.id,
        },
      },
      update: {
        assignedByUserId: admin.id,
        status: ScheduleStatus.SWAPPED,
        responseStatus: SCHEDULE_RESPONSE.PENDING,
        responseAt: null,
        declineReason: null,
      } as any,
      create: {
        serviceId: cultoDomingoNoite.id,
        servantId: lucas.id,
        ministryId: recepcao.id,
        assignedByUserId: admin.id,
        status: ScheduleStatus.SWAPPED,
        responseStatus: SCHEDULE_RESPONSE.PENDING,
      } as any,
    });

    const scheduleDomingoNoiteCarla = await prisma.schedule.upsert({
      where: {
        serviceId_servantId_ministryId: {
          serviceId: cultoDomingoNoite.id,
          servantId: carla.id,
          ministryId: midia.id,
        },
      },
      update: {
        assignedByUserId: admin.id,
        status: ScheduleStatus.SWAPPED,
        responseStatus: SCHEDULE_RESPONSE.CONFIRMED,
        responseAt: new Date('2026-03-14T14:30:00Z'),
        declineReason: null,
      } as any,
      create: {
        serviceId: cultoDomingoNoite.id,
        servantId: carla.id,
        ministryId: midia.id,
        assignedByUserId: admin.id,
        status: ScheduleStatus.SWAPPED,
        responseStatus: SCHEDULE_RESPONSE.CONFIRMED,
        responseAt: new Date('2026-03-14T14:30:00Z'),
      } as any,
    });

    await prisma.scheduleResponseHistory.createMany({
      data: [
        {
          scheduleId: scheduleDomingoManhaLucas.id,
          responseStatus: SCHEDULE_RESPONSE.CONFIRMED,
          respondedByUserId: coordenadorApoio.id,
          respondedAt: new Date('2026-03-07T17:10:00Z'),
        },
        {
          scheduleId: scheduleQuintaNoiteCarla.id,
          responseStatus: SCHEDULE_RESPONSE.DECLINED,
          declineReason: 'Plantao extraordinario no trabalho',
          respondedByUserId: servo.id,
          respondedAt: new Date('2026-03-11T20:40:00Z'),
        },
      ],
    });

    await prismaAny.servantAvailability.createMany({
      data: [
        {
          servantId: carla.id,
          dayOfWeek: 0,
          shift: AVAILABILITY_SHIFT.MORNING,
          available: true,
          notes: 'Disponivel para escala de domingo pela manha',
        },
        {
          servantId: carla.id,
          dayOfWeek: 0,
          shift: AVAILABILITY_SHIFT.EVENING,
          available: true,
        },
        {
          servantId: carla.id,
          dayOfWeek: 4,
          shift: AVAILABILITY_SHIFT.EVENING,
          available: false,
          notes: 'Curso fixo na quinta a noite',
        },
        {
          servantId: renato.id,
          dayOfWeek: 0,
          shift: AVAILABILITY_SHIFT.EVENING,
          available: true,
        },
        {
          servantId: mateus.id,
          dayOfWeek: 0,
          shift: AVAILABILITY_SHIFT.MORNING,
          available: false,
          notes: 'Em retorno gradual',
        },
      ],
      skipDuplicates: true,
    });

    const scheduleSwap = await prisma.scheduleSwapHistory.create({
      data: {
        fromScheduleId: scheduleDomingoNoiteLucas.id,
        toScheduleId: scheduleDomingoNoiteCarla.id,
        reason: 'Troca aprovada por indisponibilidade de ultima hora',
        swappedByUserId: coordenador.id,
      },
    });

    await prisma.attendance.upsert({
      where: {
        serviceId_servantId: {
          serviceId: cultoDomingoManha.id,
          servantId: lucas.id,
        },
      },
      update: { status: AttendanceStatus.PRESENTE, registeredByUserId: servo.id },
      create: {
        serviceId: cultoDomingoManha.id,
        servantId: lucas.id,
        status: AttendanceStatus.PRESENTE,
        registeredByUserId: servo.id,
      },
    });

    await prisma.attendance.upsert({
      where: {
        serviceId_servantId: {
          serviceId: cultoQuintaNoite.id,
          servantId: carla.id,
        },
      },
      update: {
        status: AttendanceStatus.FALTA,
        justification: 'Imprevisto no trabalho',
        registeredByUserId: servo.id,
      },
      create: {
        serviceId: cultoQuintaNoite.id,
        servantId: carla.id,
        status: AttendanceStatus.FALTA,
        justification: 'Imprevisto no trabalho',
        registeredByUserId: servo.id,
      },
    });

    await prisma.attendance.upsert({
      where: {
        serviceId_servantId: {
          serviceId: cultoDomingoNoite.id,
          servantId: bruna.id,
        },
      },
      update: {
        status: AttendanceStatus.FALTA_JUSTIFICADA,
        justification: 'Consulta medica',
        registeredByUserId: servo.id,
      },
      create: {
        serviceId: cultoDomingoNoite.id,
        servantId: bruna.id,
        status: AttendanceStatus.FALTA_JUSTIFICADA,
        justification: 'Consulta medica',
        registeredByUserId: servo.id,
      },
    });

    console.log('Creating operational domain records...');
    await prisma.pastoralVisit.createMany({
      data: [
        {
          servantId: carla.id,
          reason: 'Faltas recentes sem aviso previo',
          status: PastoralVisitStatus.ABERTA,
          createdByUserId: pastor.id,
        },
        {
          servantId: bruna.id,
          reason: 'Acompanhamento de transicao para lideranca',
          status: PastoralVisitStatus.EM_ANDAMENTO,
          createdByUserId: pastor.id,
        },
      ],
    });

    const resolvedVisit = await prisma.pastoralVisit.create({
      data: {
        servantId: mateus.id,
        reason: 'Reintegracao apos periodo afastado',
        status: PastoralVisitStatus.RESOLVIDA,
        createdByUserId: pastor.id,
        resolvedByUserId: pastor.id,
        resolvedAt: new Date('2026-03-16T18:00:00Z'),
        notes: 'Retorno liberado com acompanhamento.',
      },
    });

    await prisma.pastoralAlert.createMany({
      data: [
        {
          servantId: carla.id,
          trigger: 'CONSECUTIVE_ABSENCES',
          message: 'Servo com ausencias consecutivas acima do limite.',
          createdByUserId: pastor.id,
        },
        {
          servantId: bruna.id,
          trigger: 'MONTHLY_ABSENCES',
          message: 'Servo com faltas acumuladas no mes.',
          createdByUserId: pastor.id,
        },
        {
          servantId: mateus.id,
          trigger: 'PASTORAL_FOLLOWUP',
          message: 'Alerta encerrado apos reuniao pastoral.',
          status: AlertStatus.RESOLVED,
          createdByUserId: pastor.id,
          resolvedByUserId: pastor.id,
          resolvedAt: new Date('2026-03-16T18:30:00Z'),
        },
      ],
    });

    await prisma.talent.createMany({
      data: [
        {
          servantId: renato.id,
          stage: TalentStage.EM_TREINAMENTO,
          notes: 'Bom potencial operacional',
        },
        {
          servantId: lucas.id,
          stage: TalentStage.APROVADO,
          approvedAt: new Date('2025-07-10T00:00:00Z'),
          notes: 'Aprovado para liderar recepcao em eventos especiais',
        },
        {
          servantId: mateus.id,
          stage: TalentStage.EM_AVALIACAO,
          notes: 'Retorno gradual apos afastamento',
        },
        {
          servantId: carla.id,
          stage: TalentStage.RECRUTA,
          notes: 'Novo talento para mentoria tecnica interna.',
        },
      ],
    });

    await prisma.refreshToken.create({
      data: {
        userId: servo.id,
        tokenHash: await bcrypt.hash('seed-refresh-token-servo', 10),
        expiresAt: new Date('2026-04-01T00:00:00Z'),
      },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: coordenadorApoio.id,
        tokenHash: await bcrypt.hash('seed-reset-token-coordenador', 10),
        expiresAt: new Date('2026-03-24T00:00:00Z'),
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          action: AuditAction.CREATE,
          entity: 'Schedule',
          entityId: scheduleDomingoManhaLucas.id,
          metadata: { source: 'seed', service: 'Culto Domingo Manha' },
          userId: admin.id,
        },
        {
          action: AuditAction.SCHEDULE_SWAP,
          entity: 'ScheduleSwapHistory',
          entityId: scheduleSwap.id,
          metadata: {
            source: 'seed',
            fromScheduleId: scheduleDomingoNoiteLucas.id,
            toScheduleId: scheduleDomingoNoiteCarla.id,
          },
          userId: coordenador.id,
        },
        {
          action: AuditAction.VISIT_RESOLVED,
          entity: 'PastoralVisit',
          entityId: resolvedVisit.id,
          metadata: { source: 'seed', note: 'Visita pastoral resolvida no seed' },
          userId: pastor.id,
        },
      ],
    });

    console.log('Seed completed successfully.');
    console.log(`Default test password: ${DEFAULT_PASSWORD}`);
    console.log('Super admin login: superadmin@servos.local');
    console.log('Admin login: admin@servos.local');
    console.log(
      `Common users: ${pastor.email}, ${coordenador.email}, ${coordenadorApoio.email}, ${servo.email}, renato@servos.local, mateus@servos.local`,
    );
    console.log(`Super admin id: ${superAdmin.id}`);
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main();





