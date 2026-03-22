import {
  Aptitude,
  AttendanceStatus,
  TrainingStatus,
  PrismaClient,
  Role,
  ServantStatus,
  TalentStage,
  UserStatus,
  WorshipServiceStatus,
  WorshipServiceType,
  PastoralVisitStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = '123456';

async function upsertServantByName(params: {
  name: string;
  phone?: string;
  status?: ServantStatus;
  aptitude?: Aptitude;
  classGroup?: string;
  mainSectorId?: string;
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
        status: params.status,
        aptitude: params.aptitude,
        classGroup: params.classGroup,
        mainSectorId: params.mainSectorId,
        joinedAt: params.joinedAt,
      },
    });
  }

  return prisma.servant.create({
    data: {
      name: params.name,
      phone: params.phone,
      status: params.status,
      aptitude: params.aptitude,
      classGroup: params.classGroup,
      mainSectorId: params.mainSectorId,
      joinedAt: params.joinedAt,
    },
  });
}

async function main() {
  console.log('Starting seed...');

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    console.log('Upserting users...');
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@servos.local' },
      update: {
        name: 'Super Admin',
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      create: {
        name: 'Super Admin',
        email: 'superadmin@servos.local',
        passwordHash,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const admin = await prisma.user.upsert({
      where: { email: 'admin@servos.local' },
      update: {
        name: 'Admin Geral',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      create: {
        name: 'Admin Geral',
        email: 'admin@servos.local',
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const pastor = await prisma.user.upsert({
      where: { email: 'pastor@servos.local' },
      update: { name: 'Pr. Elias', role: Role.PASTOR, passwordHash },
      create: {
        name: 'Pr. Elias',
        email: 'pastor@servos.local',
        passwordHash,
        role: Role.PASTOR,
      },
    });

    const coordenador = await prisma.user.upsert({
      where: { email: 'coordenador@servos.local' },
      update: { name: 'Coord. Joao', role: Role.COORDENADOR, passwordHash },
      create: {
        name: 'Coord. Joao',
        email: 'coordenador@servos.local',
        passwordHash,
        role: Role.COORDENADOR,
      },
    });

    const lider = await prisma.user.upsert({
      where: { email: 'lider@servos.local' },
      update: { name: 'Lider Maria', role: Role.LIDER, passwordHash },
      create: {
        name: 'Lider Maria',
        email: 'lider@servos.local',
        passwordHash,
        role: Role.LIDER,
      },
    });

    const servo = await prisma.user.upsert({
      where: { email: 'apoio@servos.local' },
      update: { name: 'Servo Pedro', role: Role.SERVO, passwordHash },
      create: {
        name: 'Servo Pedro',
        email: 'apoio@servos.local',
        passwordHash,
        role: Role.SERVO,
      },
    });

    console.log('Upserting sectors...');
    const recepcao = await prisma.sector.upsert({
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

    const midia = await prisma.sector.upsert({
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

    const intercessao = await prisma.sector.upsert({
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

    console.log('Upserting servants...');
    const lucas = await upsertServantByName({
      name: 'Lucas Alves',
      phone: '11999990001',
      status: ServantStatus.ATIVO,
      aptitude: Aptitude.SOCIAL,
      classGroup: 'A',
      mainSectorId: recepcao.id,
      joinedAt: new Date('2024-03-01T00:00:00Z'),
    });

    const carla = await upsertServantByName({
      name: 'Carla Menezes',
      phone: '11999990002',
      status: ServantStatus.ATIVO,
      aptitude: Aptitude.TECNICO,
      classGroup: 'B',
      mainSectorId: midia.id,
      joinedAt: new Date('2023-08-20T00:00:00Z'),
    });

    const renato = await upsertServantByName({
      name: 'Renato Lima',
      phone: '11999990003',
      status: ServantStatus.RECICLAGEM,
      aptitude: Aptitude.APOIO,
      classGroup: 'A',
      mainSectorId: recepcao.id,
    });

    const bruna = await upsertServantByName({
      name: 'Bruna Costa',
      phone: '11999990004',
      status: ServantStatus.ATIVO,
      aptitude: Aptitude.LIDERANCA,
      classGroup: 'C',
      mainSectorId: intercessao.id,
    });

    const mateus = await upsertServantByName({
      name: 'Mateus Rocha',
      phone: '11999990005',
      status: ServantStatus.AFASTADO,
      aptitude: Aptitude.OPERACIONAL,
      classGroup: 'B',
      mainSectorId: midia.id,
    });

    console.log('Cleaning operational records to keep seed deterministic...');
    await prisma.scheduleSwapHistory.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.pastoralVisit.deleteMany();
    await prisma.pastoralAlert.deleteMany();
    await prisma.talent.deleteMany();
    await prisma.servantStatusHistory.deleteMany();
    await prisma.servantSector.deleteMany({
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

    await prisma.servantSector.createMany({
      data: [
        { servantId: lucas.id, sectorId: recepcao.id },
        { servantId: lucas.id, sectorId: intercessao.id },
        { servantId: carla.id, sectorId: midia.id },
        { servantId: renato.id, sectorId: recepcao.id },
        { servantId: bruna.id, sectorId: intercessao.id },
        { servantId: mateus.id, sectorId: midia.id },
      ],
      skipDuplicates: true,
    });

    await prisma.user.update({
      where: { id: coordenador.id },
      data: { servantId: bruna.id },
    });

    await prisma.user.update({
      where: { id: lider.id },
      data: { servantId: lucas.id },
    });

    await prisma.user.update({
      where: { id: servo.id },
      data: { servantId: carla.id },
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
    await prisma.schedule.upsert({
      where: {
        serviceId_servantId_sectorId: {
          serviceId: cultoDomingoManha.id,
          servantId: lucas.id,
          sectorId: recepcao.id,
        },
      },
      update: { classGroup: 'A', assignedByUserId: admin.id },
      create: {
        serviceId: cultoDomingoManha.id,
        servantId: lucas.id,
        sectorId: recepcao.id,
        classGroup: 'A',
        assignedByUserId: admin.id,
      },
    });

    await prisma.schedule.upsert({
      where: {
        serviceId_servantId_sectorId: {
          serviceId: cultoQuintaNoite.id,
          servantId: carla.id,
          sectorId: midia.id,
        },
      },
      update: { classGroup: 'B', assignedByUserId: admin.id },
      create: {
        serviceId: cultoQuintaNoite.id,
        servantId: carla.id,
        sectorId: midia.id,
        classGroup: 'B',
        assignedByUserId: admin.id,
      },
    });

    await prisma.schedule.upsert({
      where: {
        serviceId_servantId_sectorId: {
          serviceId: cultoDomingoNoite.id,
          servantId: bruna.id,
          sectorId: intercessao.id,
        },
      },
      update: { classGroup: 'C', assignedByUserId: admin.id },
      create: {
        serviceId: cultoDomingoNoite.id,
        servantId: bruna.id,
        sectorId: intercessao.id,
        classGroup: 'C',
        assignedByUserId: admin.id,
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
      ],
    });

    console.log('Seed completed successfully.');
    console.log(`Default test password: ${DEFAULT_PASSWORD}`);
    console.log('Super admin login: superadmin@servos.local');
    console.log('Admin login: admin@servos.local');
    console.log(`Common users: ${pastor.email}, ${coordenador.email}, ${lider.email}, ${servo.email}`);
    console.log(`Super admin id: ${superAdmin.id}`);
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
