import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, ScheduleResponseStatus } from '@prisma/client';
import request = require('supertest');
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';
import { MeController } from 'src/modules/me/me.controller';
import { MeService } from 'src/modules/me/me.service';
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E mobile servo flow', () => {
  const state = {
    servantId: 'servant-1',
    taskId: 'occ-1',
    taskProgress: 0,
    taskCompleted: false,
    scheduleId: 'slot-1',
    scheduleConfirmed: false,
    points: 0,
  };

  async function createApp(actor: Actor): Promise<INestApplication> {
    const meServiceMock = {
      getProfile: jest.fn(() => ({ id: actor.sub, role: actor.role, servantId: actor.servantId })),
      listMySchedules: jest.fn(() => [{ id: state.scheduleId, status: state.scheduleConfirmed ? 'CONFIRMED' : 'ASSIGNED' }]),
      respondMySchedule: jest.fn((_user: Actor, scheduleId: string, dto: { responseStatus: ScheduleResponseStatus }) => {
        if (scheduleId !== state.scheduleId || actor.servantId !== state.servantId) throw new ForbiddenException('not owner');
        state.scheduleConfirmed = dto.responseStatus === ScheduleResponseStatus.CONFIRMED;
        return { id: state.scheduleId, status: state.scheduleConfirmed ? 'CONFIRMED' : 'DECLINED' };
      }),
      getMyServant: jest.fn(() => ({ id: state.servantId, name: 'Servo Mobile' })),
      listMyAttendance: jest.fn(() => []),
      listMyNotifications: jest.fn(() => [{ id: 'n1', title: 'Nova tarefa' }]),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      updateMyServant: jest.fn(),
      readMyNotification: jest.fn(),
      getMyAvailability: jest.fn(),
      putMyAvailability: jest.fn(),
    };

    const ministryTasksServiceMock = {
      listOccurrences: jest.fn(() => ({ data: [{ id: state.taskId, status: state.taskCompleted ? 'COMPLETED' : 'ASSIGNED', progressPercent: state.taskProgress, assignedServantId: state.servantId }] })),
      getOccurrence: jest.fn(() => ({ id: state.taskId, checklistItems: [{ id: 'item-1', status: state.taskProgress > 0 ? 'DONE' : 'PENDING' }] })),
      updateChecklist: jest.fn(() => {
        if (actor.servantId !== state.servantId) throw new ForbiddenException('not owner');
        state.taskProgress = 100;
        return { data: { id: state.taskId, progressPercent: state.taskProgress } };
      }),
      completeOccurrence: jest.fn(() => {
        if (actor.servantId !== state.servantId) throw new ForbiddenException('not owner');
        state.taskCompleted = true;
        state.points += 20;
        return { data: { id: state.taskId, status: 'COMPLETED', progressPercent: 100 } };
      }),
      listTemplates: jest.fn(),
      getTemplate: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      removeTemplate: jest.fn(),
      generateOccurrences: jest.fn(),
      createOccurrence: jest.fn(),
      assignOccurrence: jest.fn(),
      reassignOccurrence: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      cancelOccurrence: jest.fn(),
      reallocateFromRemovedServant: jest.fn(),
      dashboard: jest.fn(() => ({ totalPending: state.taskCompleted ? 0 : 1 })),
      runRecurringGenerationJob: jest.fn(),
    };

    const gamificationServiceMock = {
      dashboardServo: jest.fn(() => ({ myTasks: state.taskCompleted ? 0 : 1, myPoints: state.points, myRanking: 1 })),
      ranking: jest.fn(() => [{ servantId: state.servantId, points: state.points, position: 1 }]),
      listAchievementsCatalog: jest.fn((_user: Actor, servantId?: string) => {
        if (!servantId) return [{ code: 'FIRST_TASK' }];
        return [{ code: 'FIRST_TASK', unlocked: state.taskCompleted, progress: state.taskCompleted ? 1 : 0, target: 1 }];
      }),
      myGrowthTracks: jest.fn(() => [{ trackId: 'track-1', progressPercent: state.taskCompleted ? 50 : 10 }]),
      getServantProgress: jest.fn(() => ({ profile: { totalPoints: state.points }, rankingPosition: 1 })),
      rankingMonthly: jest.fn(),
      rankingYearly: jest.fn(),
      rankingByMetric: jest.fn(),
      dashboardAdmin: jest.fn(),
      dashboardPastor: jest.fn(),
      dashboardCoordinator: jest.fn(),
      dashboard: jest.fn(),
      awardPoints: jest.fn(),
      recomputeServantProfile: jest.fn(),
      recomputeAllProfiles: jest.fn(),
      syncDefaultAchievementsCatalog: jest.fn(),
      listGrowthTracks: jest.fn(),
      getGrowthTrack: jest.fn(),
      createGrowthTrack: jest.fn(),
      addGrowthTrackStep: jest.fn(),
      assignServantToTrack: jest.fn(),
      updateGrowthTrackProgress: jest.fn(),
      approveGrowthTrackStep: jest.fn(),
      analyticsChurch: jest.fn(),
      analyticsMinistry: jest.fn(),
      analyticsServant: jest.fn(),
      analyticsMe: jest.fn(),
      buildMonthlyStats: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MeController, MinistryTasksController, GamificationController],
      providers: [
        { provide: MeService, useValue: meServiceMock },
        { provide: MinistryTasksService, useValue: ministryTasksServiceMock },
        { provide: GamificationService, useValue: gamificationServiceMock },
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

  it('allows servo to operate core mobile flow end-to-end', async () => {
    const servo = await createApp({ sub: 'mobile-servo', role: Role.SERVO, churchId: 'church-a', servantId: state.servantId });

    await request(servo.getHttpServer()).get('/me').expect(200);
    await request(servo.getHttpServer()).get('/gamification/dashboard/servo').expect(200);
    await request(servo.getHttpServer()).get('/ministry-tasks/occurrences').expect(200);
    await request(servo.getHttpServer()).get(`/ministry-tasks/occurrences/${state.taskId}`).expect(200);

    await request(servo.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.taskId}/checklist`)
      .send({ items: [{ itemId: 'item-1', status: 'DONE' }] })
      .expect(200);

    await request(servo.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.taskId}/complete`)
      .send({})
      .expect(200);

    await request(servo.getHttpServer()).get('/gamification/ranking').expect(200);
    await request(servo.getHttpServer()).get('/gamification/achievements/me').expect(200);
    await request(servo.getHttpServer()).get('/gamification/growth-tracks/my').expect(200);
    await request(servo.getHttpServer()).get('/me/schedules').expect(200);

    await request(servo.getHttpServer())
      .patch(`/me/schedule-assignments/${state.scheduleId}/respond`)
      .send({ responseStatus: 'CONFIRMED' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('CONFIRMED');
      });

    await servo.close();
  });
});
