import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuthController } from 'src/modules/auth/auth.controller';
import { AuthService } from 'src/modules/auth/auth.service';
import { MeController } from 'src/modules/me/me.controller';
import { MeService } from 'src/modules/me/me.service';
import { UsersController } from 'src/modules/users/users.controller';
import { UsersService } from 'src/modules/users/users.service';
import { ServantsController } from 'src/modules/servants/servants.controller';
import { ServantsService } from 'src/modules/servants/servants.service';
import { MinistriesController } from 'src/modules/ministries/ministries.controller';
import { MinistriesService } from 'src/modules/ministries/ministries.service';
import { TeamsController } from 'src/modules/teams/teams.controller';
import { TeamsService } from 'src/modules/teams/teams.service';
import { SchedulesController } from 'src/modules/schedules/schedules.controller';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { PastoralVisitsController } from 'src/modules/pastoral-visits/pastoral-visits.controller';
import { PastoralVisitsService } from 'src/modules/pastoral-visits/pastoral-visits.service';
import { NotificationsController } from 'src/modules/notifications/notifications.controller';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { AttendancesController } from 'src/modules/attendances/attendances.controller';
import { AttendancesService } from 'src/modules/attendances/attendances.service';
import { DashboardController } from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';

async function createControllerApp(controller: any, providerToken: any, providerValue: any) {
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [
      {
        provide: providerToken,
        useValue: providerValue,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req: any, _res: any, next: () => void) => {
    req.user = {
      sub: 'user-1',
      email: 'admin@church.local',
      role: 'ADMIN',
      servantId: 'servant-1',
    };
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
}

describe('API contracts (front x back)', () => {
  let apps: INestApplication[] = [];

  afterEach(async () => {
    for (const app of apps) {
      await app.close();
    }
    apps = [];
  });

  it('auth/login valida payload e estrutura de resposta', async () => {
    const authServiceMock = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: { id: 'u1', role: 'ADMIN' },
      }),
      refresh: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      me: jest.fn(),
      changePassword: jest.fn(),
    };

    const app = await createControllerApp(AuthController, AuthService, authServiceMock);
    apps.push(app);

    await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@church.local', password: '123456' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            user: expect.objectContaining({ role: expect.any(String) }),
          }),
        );
      });
  });

  it('me retorna contrato basico de perfil', async () => {
    const meServiceMock = {
      getProfile: jest.fn().mockResolvedValue({ id: 'u1', email: 'admin@church.local', role: 'ADMIN' }),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      getMyServant: jest.fn(),
      updateMyServant: jest.fn(),
      listMySchedules: jest.fn(),
      listMyAttendance: jest.fn(),
      listMyNotifications: jest.fn(),
      readMyNotification: jest.fn(),
      getMyAvailability: jest.fn(),
      putMyAvailability: jest.fn(),
      respondMySchedule: jest.fn(),
    };

    const app = await createControllerApp(MeController, MeService, meServiceMock);
    apps.push(app);

    await request(app.getHttpServer())
      .get('/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            email: expect.any(String),
            role: expect.any(String),
          }),
        );
      });
  });

  it('users valida DTO de criacao e resposta', async () => {
    const usersServiceMock = {
      findAll: jest.fn(),
      findEligible: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'u2', email: 'coordenador@church.local', role: 'COORDENADOR' }),
      update: jest.fn(),
      updateStatus: jest.fn(),
      resetPassword: jest.fn(),
      updateRole: jest.fn(),
      updateScope: jest.fn(),
      setServantLink: jest.fn(),
      remove: jest.fn(),
    };

    const app = await createControllerApp(UsersController, UsersService, usersServiceMock);
    apps.push(app);

    await request(app.getHttpServer()).post('/users').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Coord', email: 'coordenador@church.local', role: 'COORDENADOR', password: 'Abc@12345' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            email: expect.any(String),
            role: expect.any(String),
          }),
        );
      });
  });

  it('servants/with-user valida obrigatorios e tipos', async () => {
    const servantsServiceMock = {
      findAll: jest.fn(),
      findEligible: jest.fn(),
      getCreateFormMetadata: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      createWithUser: jest.fn().mockResolvedValue({ id: 's1', name: 'Servo 1', ministryIds: ['m1'] }),
      update: jest.fn(),
      updateStatus: jest.fn(),
      linkUser: jest.fn(),
      createUserAccess: jest.fn(),
      history: jest.fn(),
      completeTraining: jest.fn(),
      updateApproval: jest.fn(),
    };

    const app = await createControllerApp(ServantsController, ServantsService, servantsServiceMock);
    apps.push(app);

    await request(app.getHttpServer()).post('/servants/with-user').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/servants/with-user')
      .send({
        name: 'Servo 1',
        ministryIds: ['m1'],
        user: { email: 'servo1@church.local' },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
      });
  });

  it('ministries valida enum/estrutura basica', async () => {
    const ministriesServiceMock = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'm1', name: 'Louvor' }),
      update: jest.fn(),
      listServants: jest.fn(),
      listResponsibilities: jest.fn(),
      createResponsibility: jest.fn(),
      updateResponsibility: jest.fn(),
    };

    const app = await createControllerApp(MinistriesController, MinistriesService, ministriesServiceMock);
    apps.push(app);

    await request(app.getHttpServer()).post('/ministries').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/ministries')
      .send({ name: 'Louvor', color: '#112233' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ id: expect.any(String), name: 'Louvor' }));
      });
  });

  it('teams cria e retorna contrato de time', async () => {
    const teamsServiceMock = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 't1', name: 'Vozes', ministryId: 'm1' }),
      update: jest.fn(),
      remove: jest.fn(),
      members: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      updateLeader: jest.fn(),
    };

    const app = await createControllerApp(TeamsController, TeamsService, teamsServiceMock);
    apps.push(app);

    await request(app.getHttpServer()).post('/teams').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/teams')
      .send({ name: 'Vozes', ministryId: 'm1' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ id: 't1', ministryId: 'm1' }));
      });
  });

  it('schedules/mobile-context retorna estrutura de board/context', async () => {
    const schedulesServiceMock = {
      findAll: jest.fn(),
      listEligibleServants: jest.fn(),
      mobileContext: jest.fn().mockResolvedValue({
        filters: { daysAhead: 30, ministryId: 'm1', serviceId: 'ws1' },
        ministries: [{ id: 'm1', name: 'Louvor' }],
        teams: [],
        services: [],
        servants: [],
        shifts: ['MORNING'],
      }),
      operationModes: jest.fn(),
      periodSummary: jest.fn(),
      servicesOperationalStatus: jest.fn(),
      serviceBoard: jest.fn(),
      createSlot: jest.fn(),
      assignSlot: jest.fn(),
      contextualSwapSlot: jest.fn(),
      fillSlot: jest.fn(),
      autoGenerateExplained: jest.fn(),
      history: jest.fn(),
      create: jest.fn(),
      generateMonth: jest.fn(),
      generatePeriod: jest.fn(),
      generateService: jest.fn(),
      generateServices: jest.fn(),
      generateYear: jest.fn(),
      swap: jest.fn(),
      update: jest.fn(),
      duplicate: jest.fn(),
      swapHistory: jest.fn(),
    };

    const app = await createControllerApp(SchedulesController, SchedulesService, schedulesServiceMock);
    apps.push(app);

    await request(app.getHttpServer())
      .get('/schedules/mobile-context?ministryId=m1&serviceId=ws1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            filters: expect.any(Object),
            ministries: expect.any(Array),
            teams: expect.any(Array),
            services: expect.any(Array),
            servants: expect.any(Array),
          }),
        );
      });
  });

  it('schedules/services/:id/board retorna contrato canonico do board', async () => {
    const schedulesServiceMock = {
      findAll: jest.fn(),
      listEligibleServants: jest.fn(),
      mobileContext: jest.fn(),
      operationModes: jest.fn(),
      periodSummary: jest.fn(),
      servicesOperationalStatus: jest.fn(),
      serviceBoard: jest.fn().mockResolvedValue({
        service: { id: 'ws1', title: 'Culto Domingo' },
        ministryId: 'm1',
        operationalStatus: 'PENDENTE',
        summary: {
          missingRequiredSlots: 1,
          pendingCount: 1,
          conflictCount: 0,
          needsSwap: false,
          alerts: [],
        },
        slots: [],
        legacyAssignments: [],
      }),
      createSlot: jest.fn(),
      assignSlot: jest.fn(),
      contextualSwapSlot: jest.fn(),
      fillSlot: jest.fn(),
      autoGenerateExplained: jest.fn(),
      history: jest.fn(),
      create: jest.fn(),
      generateMonth: jest.fn(),
      generatePeriod: jest.fn(),
      generateService: jest.fn(),
      generateServices: jest.fn(),
      generateYear: jest.fn(),
      swap: jest.fn(),
      update: jest.fn(),
      duplicate: jest.fn(),
      swapHistory: jest.fn(),
    };

    const app = await createControllerApp(SchedulesController, SchedulesService, schedulesServiceMock);
    apps.push(app);

    await request(app.getHttpServer())
      .get('/schedules/services/ws1/board?ministryId=m1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            service: expect.any(Object),
            ministryId: expect.any(String),
            operationalStatus: expect.any(String),
            summary: expect.any(Object),
            slots: expect.any(Array),
          }),
        );
      });
  });
  it('pastoral-visits valida create contract', async () => {
    const pastoralServiceMock = {
      findAll: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'pv1', servantId: 's1', status: 'ABERTA' }),
      resolve: jest.fn(),
      historyByServant: jest.fn(),
    };

    const app = await createControllerApp(PastoralVisitsController, PastoralVisitsService, pastoralServiceMock);
    apps.push(app);

    await request(app.getHttpServer()).post('/pastoral-visits').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/pastoral-visits')
      .send({ servantId: 's1', reason: 'Acompanhamento pastoral' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ id: expect.any(String), status: expect.any(String) }));
      });
  });

  it('notifications e attendance mantem estrutura canonica', async () => {
    const notificationsServiceMock = {
      findAll: jest.fn().mockResolvedValue({ data: [{ id: 'n1', type: 'SCHEDULE' }] }),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    const attendancesServiceMock = {
      findAll: jest.fn(),
      checkIn: jest.fn().mockResolvedValue({ id: 'a1', serviceId: 'ws1', servantId: 's1', status: 'PRESENTE' }),
      batch: jest.fn(),
      update: jest.fn(),
    };

    const notificationsApp = await createControllerApp(
      NotificationsController,
      NotificationsService,
      notificationsServiceMock,
    );
    const attendancesApp = await createControllerApp(
      AttendancesController,
      AttendancesService,
      attendancesServiceMock,
    );
    apps.push(notificationsApp, attendancesApp);

    await request(notificationsApp.getHttpServer())
      .get('/notifications')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ data: expect.any(Array) }));
      });

    await request(attendancesApp.getHttpServer()).post('/attendances/check-in').send({}).expect(400);

    await request(attendancesApp.getHttpServer())
      .post('/attendances/check-in')
      .send({ serviceId: 'ws1', servantId: 's1', status: 'PRESENTE' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ id: expect.any(String), status: expect.any(String) }));
      });
  });

  it('dashboard expõe contratos de summary e alerts', async () => {
    const dashboardServiceMock = {
      summary: jest.fn().mockResolvedValue({ totals: { servants: 10, ministries: 3 } }),
      alerts: jest.fn().mockResolvedValue([{ code: 'PENDING_PASTORAL', count: 2 }]),
    };

    const app = await createControllerApp(DashboardController, DashboardService, dashboardServiceMock);
    apps.push(app);

    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ totals: expect.any(Object) }));
      });

    await request(app.getHttpServer())
      .get('/dashboard/alerts')
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBe(true);
      });
  });
});
