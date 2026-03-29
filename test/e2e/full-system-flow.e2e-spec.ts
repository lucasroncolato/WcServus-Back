import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AttendanceStatus, MinistryTaskChecklistItemStatus, Role, ScheduleResponseStatus } from '@prisma/client';
import request = require('supertest');
import { AttendancesController } from 'src/modules/attendances/attendances.controller';
import { AttendancesService } from 'src/modules/attendances/attendances.service';
import { DashboardController } from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';
import { MeController } from 'src/modules/me/me.controller';
import { MeService } from 'src/modules/me/me.service';
import { MinistriesController } from 'src/modules/ministries/ministries.controller';
import { MinistriesService } from 'src/modules/ministries/ministries.service';
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';
import { SchedulesController } from 'src/modules/schedules/schedules.controller';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { ServantsController } from 'src/modules/servants/servants.controller';
import { ServantsService } from 'src/modules/servants/servants.service';
import { WorshipServicesController } from 'src/modules/worship-services/worship-services.controller';
import { WorshipServicesService } from 'src/modules/worship-services/worship-services.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E full system operational flow', () => {
  const state = {
    ministryId: '',
    responsibilityId: '',
    serviceId: '',
    slotId: '',
    templateId: '',
    occurrenceId: '',
    checklistItemId: '',
    trackId: '',
    stepId: '',
    servantId: 'servant-1',
    points: 0,
    attendance: 0,
    taskDone: false,
    trainingDone: false,
    trackDone: false,
    scheduleConfirmed: false,
  };
  let seq = 1;
  const id = (prefix: string): string => `${prefix}-${seq++}`;

  async function createApp(actor: Actor): Promise<INestApplication> {
    const ministriesServiceMock = {
      create: jest.fn((dto: { name: string }) => {
        state.ministryId = id('ministry');
        return { id: state.ministryId, name: dto.name };
      }),
      createResponsibility: jest.fn(() => {
        state.responsibilityId = id('resp');
        return { id: state.responsibilityId, ministryId: state.ministryId };
      }),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      listServants: jest.fn(),
      listResponsibilities: jest.fn(),
      updateResponsibility: jest.fn(),
    };
    const worshipServicesServiceMock = {
      create: jest.fn((dto: { title: string; serviceDate: string }) => {
        state.serviceId = id('service');
        return { id: state.serviceId, title: dto.title, serviceDate: dto.serviceDate };
      }),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    const schedulesServiceMock = {
      createSlot: jest.fn(() => {
        state.slotId = id('slot');
        return { id: state.slotId, serviceId: state.serviceId, status: 'OPEN' };
      }),
      assignSlot: jest.fn((_slotId: string, dto: { servantId: string }) => ({ id: state.slotId, assignedServantId: dto.servantId, status: 'ASSIGNED' })),
      serviceBoard: jest.fn(() => ({ slots: [{ id: state.slotId, status: state.scheduleConfirmed ? 'CONFIRMED' : 'ASSIGNED' }] })),
      findAll: jest.fn(),
      listEligibleServants: jest.fn(),
      mobileContext: jest.fn(),
      operationModes: jest.fn(),
      periodSummary: jest.fn(),
      servicesOperationalStatus: jest.fn(),
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
      listVersions: jest.fn(),
      createDraftVersion: jest.fn(),
      publishVersion: jest.fn(),
    };
    const meServiceMock = {
      respondMySchedule: jest.fn((_user: Actor, idSchedule: string, dto: { responseStatus: ScheduleResponseStatus }) => {
        if (idSchedule !== state.slotId) throw new ForbiddenException('slot mismatch');
        state.scheduleConfirmed = dto.responseStatus === ScheduleResponseStatus.CONFIRMED;
        return { id: idSchedule, status: state.scheduleConfirmed ? 'CONFIRMED' : 'DECLINED' };
      }),
      listMySchedules: jest.fn(() => [{ id: state.slotId, status: state.scheduleConfirmed ? 'CONFIRMED' : 'ASSIGNED' }]),
      getProfile: jest.fn(() => ({ id: actor.sub, role: actor.role, servantId: actor.servantId })),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      getMyServant: jest.fn(),
      updateMyServant: jest.fn(),
      listMyAttendance: jest.fn(),
      listMyNotifications: jest.fn(),
      readMyNotification: jest.fn(),
      getMyAvailability: jest.fn(),
      putMyAvailability: jest.fn(),
    };
    const attendancesServiceMock = {
      checkIn: jest.fn((dto: { status: AttendanceStatus }) => {
        if (dto.status === AttendanceStatus.PRESENTE) {
          state.attendance += 1;
          state.points += 10;
        }
        return { id: id('att'), status: dto.status };
      }),
      findAll: jest.fn(),
      batch: jest.fn(),
      update: jest.fn(),
    };
    const ministryTasksServiceMock = {
      createTemplate: jest.fn(() => {
        state.templateId = id('template');
        state.checklistItemId = id('item');
        return { data: { id: state.templateId, checklistItems: [{ id: state.checklistItemId }] } };
      }),
      createOccurrence: jest.fn(() => {
        state.occurrenceId = id('occ');
        return { data: { id: state.occurrenceId, progressPercent: 0, status: 'PENDING' } };
      }),
      assignOccurrence: jest.fn(() => ({ data: { id: state.occurrenceId, assignedServantId: state.servantId } })),
      updateChecklist: jest.fn((_id: string, dto: { items: Array<{ status: MinistryTaskChecklistItemStatus }> }) => {
        if (dto.items.every((item) => item.status === 'DONE')) return { data: { id: state.occurrenceId, progressPercent: 100, status: 'IN_PROGRESS' } };
        return { data: { id: state.occurrenceId, progressPercent: 50, status: 'IN_PROGRESS' } };
      }),
      completeOccurrence: jest.fn(() => {
        state.taskDone = true;
        state.points += 20;
        return { data: { id: state.occurrenceId, status: 'COMPLETED', progressPercent: 100 } };
      }),
      listOccurrences: jest.fn(() => ({ data: [{ id: state.occurrenceId, status: state.taskDone ? 'COMPLETED' : 'ASSIGNED' }] })),
      dashboard: jest.fn(() => ({ totalPending: state.taskDone ? 0 : 1 })),
      listTemplates: jest.fn(),
      getTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      removeTemplate: jest.fn(),
      generateOccurrences: jest.fn(),
      getOccurrence: jest.fn(),
      reassignOccurrence: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      cancelOccurrence: jest.fn(),
      reallocateFromRemovedServant: jest.fn(),
      runRecurringGenerationJob: jest.fn(),
    };
    const servantsServiceMock = {
      completeTraining: jest.fn(() => {
        state.trainingDone = true;
        state.points += 20;
        return { id: state.servantId, trainings: 1 };
      }),
      findAll: jest.fn(),
      findEligible: jest.fn(),
      getCreateFormMetadata: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      createWithUser: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      linkUser: jest.fn(),
      createUserAccess: jest.fn(),
      history: jest.fn(),
      updateApproval: jest.fn(),
    };
    const gamificationServiceMock = {
      createGrowthTrack: jest.fn(() => {
        state.trackId = id('track');
        return { id: state.trackId };
      }),
      addGrowthTrackStep: jest.fn(() => {
        state.stepId = id('step');
        return { id: state.stepId };
      }),
      assignServantToTrack: jest.fn(() => ({ trackId: state.trackId, servantId: state.servantId })),
      updateGrowthTrackProgress: jest.fn(() => ({ trackId: state.trackId, completedStepIds: [state.stepId] })),
      approveGrowthTrackStep: jest.fn(() => {
        state.trackDone = true;
        state.points += 20;
        return { trackId: state.trackId, approvedStepIds: [state.stepId] };
      }),
      listAchievementsCatalog: jest.fn((_user: Actor, servantId?: string) => {
        if (!servantId) return [{ code: 'FIRST_PRESENCE' }, { code: 'FIRST_TASK' }, { code: 'TRACK_COMPLETED' }];
        return [
          { code: 'FIRST_PRESENCE', unlocked: state.attendance >= 1 },
          { code: 'FIRST_TASK', unlocked: state.taskDone },
          { code: 'TRACK_COMPLETED', unlocked: state.trackDone },
        ];
      }),
      ranking: jest.fn(() => [{ servantId: state.servantId, points: state.points, position: 1 }]),
      getServantProgress: jest.fn(() => ({ profile: { servantId: state.servantId, totalPoints: state.points }, rankingPosition: 1 })),
      dashboardAdmin: jest.fn(() => ({ totalServants: 1, tasksOverdue: 0, rankingTop: [{ servantId: state.servantId, points: state.points }] })),
      dashboardPastor: jest.fn(() => ({ ministryHealth: [{ ministryId: state.ministryId, growthProgress: state.trackDone ? 100 : 0 }] })),
      dashboardCoordinator: jest.fn(() => ({ ministryTasksPending: state.taskDone ? 0 : 1, growthTracksCompleted: state.trackDone ? 1 : 0 })),
      dashboardServo: jest.fn(() => ({ myTasks: state.taskDone ? 0 : 1, myPoints: state.points })),
      analyticsChurch: jest.fn(() => ({ totalActiveServants: 1, tasksCompleted: state.taskDone ? 1 : 0 })),
      analyticsMinistry: jest.fn(() => ({ ministryId: state.ministryId, tasksCompleted: state.taskDone ? 1 : 0 })),
      analyticsServant: jest.fn(() => ({ servantId: state.servantId, points: state.points })),
      analyticsMe: jest.fn(() => ({ servantId: state.servantId, points: state.points })),
      myGrowthTracks: jest.fn(() => [{ trackId: state.trackId, approvedStepIds: state.trackDone ? [state.stepId] : [] }]),
      dashboard: jest.fn(() => ({ points: state.points })),
      rankingMonthly: jest.fn(),
      rankingYearly: jest.fn(),
      rankingByMetric: jest.fn(),
      awardPoints: jest.fn(),
      recomputeServantProfile: jest.fn(),
      recomputeAllProfiles: jest.fn(),
      syncDefaultAchievementsCatalog: jest.fn(),
      listGrowthTracks: jest.fn(),
      getGrowthTrack: jest.fn(),
      buildMonthlyStats: jest.fn(),
    };
    const dashboardServiceMock = {
      summary: jest.fn(() => ({ totals: { attendances: state.attendance, tasksCompleted: state.taskDone ? 1 : 0 } })),
      alerts: jest.fn(() => []),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [
        MinistriesController,
        WorshipServicesController,
        SchedulesController,
        MeController,
        AttendancesController,
        MinistryTasksController,
        ServantsController,
        GamificationController,
        DashboardController,
      ],
      providers: [
        { provide: MinistriesService, useValue: ministriesServiceMock },
        { provide: WorshipServicesService, useValue: worshipServicesServiceMock },
        { provide: SchedulesService, useValue: schedulesServiceMock },
        { provide: MeService, useValue: meServiceMock },
        { provide: AttendancesService, useValue: attendancesServiceMock },
        { provide: MinistryTasksService, useValue: ministryTasksServiceMock },
        { provide: ServantsService, useValue: servantsServiceMock },
        { provide: GamificationService, useValue: gamificationServiceMock },
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.use((req: { user?: Actor }, _res: unknown, next: () => void) => {
      req.user = actor;
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    return app;
  }

  it('executes macro flow from scale to gamification and dashboards', async () => {
    const admin = await createApp({ sub: 'admin', role: Role.ADMIN, churchId: 'church-a' });
    const coord = await createApp({ sub: 'coord', role: Role.COORDENADOR, churchId: 'church-a' });
    const pastor = await createApp({ sub: 'pastor', role: Role.PASTOR, churchId: 'church-a' });
    const servo = await createApp({ sub: 'servo-user', role: Role.SERVO, churchId: 'church-a', servantId: state.servantId });

    await request(admin.getHttpServer()).post('/ministries').send({ name: 'Midia' }).expect(201);
    await request(admin.getHttpServer())
      .post(`/ministries/${state.ministryId}/responsibilities`)
      .send({ title: 'Transmissao' })
      .expect(201);
    await request(admin.getHttpServer())
      .post('/worship-services')
      .send({ type: 'DOMINGO', title: 'Culto Noite', serviceDate: '2026-04-12T19:00:00.000Z', startTime: '19:00' })
      .expect(201);
    await request(coord.getHttpServer())
      .post(`/schedules/services/${state.serviceId}/slots`)
      .send({ ministryId: state.ministryId, responsibilityId: state.responsibilityId, functionName: 'Operador' })
      .expect(201);
    await request(coord.getHttpServer())
      .patch(`/schedules/slots/${state.slotId}/assign`)
      .send({ servantId: state.servantId })
      .expect(200);
    await request(servo.getHttpServer())
      .patch(`/me/schedule-assignments/${state.slotId}/respond`)
      .send({ responseStatus: 'CONFIRMED' })
      .expect(200);

    await request(coord.getHttpServer())
      .post('/attendances/check-in')
      .send({ serviceId: state.serviceId, servantId: state.servantId, status: 'PRESENTE' })
      .expect(201);

    await request(admin.getHttpServer())
      .post('/ministry-tasks/templates')
      .send({ ministryId: state.ministryId, name: 'Checklist live', recurrenceType: 'MANUAL', checklistItems: [{ label: 'Audio OK' }] })
      .expect(201);
    await request(admin.getHttpServer())
      .post('/ministry-tasks/occurrences')
      .send({ templateId: state.templateId, serviceId: state.serviceId, scheduledFor: '2026-04-12T17:30:00.000Z' })
      .expect(201);
    await request(admin.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.occurrenceId}/assign`)
      .send({ servantId: state.servantId })
      .expect(200);
    await request(servo.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.occurrenceId}/checklist`)
      .send({ items: [{ itemId: state.checklistItemId, status: 'DONE' }] })
      .expect(200);
    await request(servo.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.occurrenceId}/complete`)
      .send({})
      .expect(200);

    await request(admin.getHttpServer())
      .patch(`/servants/${state.servantId}/training/complete`)
      .send({})
      .expect(200);
    await request(admin.getHttpServer())
      .post('/gamification/growth-tracks')
      .send({ name: 'Trilha Midia', ministryId: state.ministryId })
      .expect(201);
    await request(admin.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/steps`)
      .send({ title: 'Etapa 1', stepOrder: 1, manualReview: true })
      .expect(201);
    await request(admin.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/assign`)
      .send({ servantId: state.servantId })
      .expect(201);
    await request(servo.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/progress/${state.servantId}`)
      .send({ stepId: state.stepId, completed: true })
      .expect(201);
    await request(coord.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/approve-step`)
      .send({ servantId: state.servantId, stepId: state.stepId })
      .expect(201);

    await request(servo.getHttpServer())
      .get('/gamification/achievements/me')
      .expect(200)
      .expect(({ body }) => {
        const unlocked = body.filter((item: { unlocked: boolean }) => item.unlocked).map((item: { code: string }) => item.code);
        expect(unlocked).toEqual(expect.arrayContaining(['FIRST_PRESENCE', 'FIRST_TASK', 'TRACK_COMPLETED']));
      });
    await request(admin.getHttpServer())
      .get('/gamification/ranking')
      .expect(200)
      .expect(({ body }) => expect(body[0].points).toBeGreaterThan(0));
    await request(admin.getHttpServer())
      .get('/dashboard/summary')
      .expect(200)
      .expect(({ body }) => {
        expect(body.totals).toEqual(expect.objectContaining({ attendances: 1, tasksCompleted: 1 }));
      });
    await request(pastor.getHttpServer()).get('/gamification/dashboard/pastor').expect(200);

    await Promise.all([admin.close(), coord.close(), pastor.close(), servo.close()]);
  });
});
