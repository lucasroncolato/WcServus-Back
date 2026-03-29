import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { DashboardController } from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E dashboards by profile', () => {
  const metrics = {
    totalServants: 12,
    activeServants: 10,
    attendances: 40,
    absences: 4,
    tasksCompleted: 18,
    tasksOverdue: 2,
  };

  async function createApp(actor: Actor): Promise<INestApplication> {
    const dashboardServiceMock = {
      summary: jest.fn(() => ({
        totals: {
          servants: metrics.totalServants,
          activeServants: metrics.activeServants,
          attendances: metrics.attendances,
          absences: metrics.absences,
          tasksCompleted: metrics.tasksCompleted,
        },
      })),
      alerts: jest.fn(() => [{ code: 'OVERDUE_TASKS', count: metrics.tasksOverdue }]),
    };

    const gamificationServiceMock = {
      dashboardAdmin: jest.fn(() => ({
        totalServants: metrics.totalServants,
        activeServants: metrics.activeServants,
        tasksOverdue: metrics.tasksOverdue,
        rankingTop: [{ servantId: 'servant-1', points: 200 }],
      })),
      dashboardPastor: jest.fn(() => ({
        ministryHealth: [{ ministryId: 'm1', attendanceRate: 0.9 }],
        criticalTasks: metrics.tasksOverdue,
        alerts: [{ code: 'PASTORAL_ALERT', count: 1 }],
      })),
      dashboardCoordinator: jest.fn(() => ({
        ministryTasksPending: 5,
        ministryTasksOverdue: metrics.tasksOverdue,
        ministryRanking: [{ servantId: 'servant-1', points: 120 }],
      })),
      dashboardServo: jest.fn(() => ({
        myTasks: 3,
        mySchedules: 2,
        myPoints: 120,
        myLevel: 2,
        myRanking: 4,
        myAchievements: 5,
      })),
      analyticsChurch: jest.fn(() => ({
        totalActiveServants: metrics.activeServants,
        attendanceRate: 0.91,
        tasksCompleted: metrics.tasksCompleted,
      })),
      analyticsMinistry: jest.fn((_user: Actor, ministryId: string) => ({
        ministryId,
        attendanceRate: 0.92,
        tasksCompleted: 8,
        overdue: 1,
      })),
      analyticsServant: jest.fn((_user: Actor, servantId: string) => ({
        servantId,
        attendance: 8,
        tasksCompleted: 6,
        points: 120,
      })),
      analyticsMe: jest.fn(() => ({
        servantId: actor.servantId,
        points: 120,
      })),
      ranking: jest.fn(),
      rankingMonthly: jest.fn(),
      rankingYearly: jest.fn(),
      rankingByMetric: jest.fn(),
      getServantProgress: jest.fn(),
      dashboard: jest.fn(),
      awardPoints: jest.fn(),
      recomputeServantProfile: jest.fn(),
      recomputeAllProfiles: jest.fn(),
      myGrowthTracks: jest.fn(),
      listAchievementsCatalog: jest.fn(),
      syncDefaultAchievementsCatalog: jest.fn(),
      listGrowthTracks: jest.fn(),
      getGrowthTrack: jest.fn(),
      createGrowthTrack: jest.fn(),
      addGrowthTrackStep: jest.fn(),
      assignServantToTrack: jest.fn(),
      updateGrowthTrackProgress: jest.fn(),
      approveGrowthTrackStep: jest.fn(),
      buildMonthlyStats: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController, GamificationController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
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

  it('validates dashboard payloads and data consistency across profiles', async () => {
    const admin = await createApp({ sub: 'admin', role: Role.ADMIN, churchId: 'church-a' });
    const pastor = await createApp({ sub: 'pastor', role: Role.PASTOR, churchId: 'church-a' });
    const coordinator = await createApp({ sub: 'coord', role: Role.COORDENADOR, churchId: 'church-a' });
    const servo = await createApp({ sub: 'servo', role: Role.SERVO, churchId: 'church-a', servantId: 'servant-1' });

    const summary = await request(admin.getHttpServer()).get('/dashboard/summary').expect(200);
    expect(summary.body.totals.servants).toBe(metrics.totalServants);

    await request(admin.getHttpServer())
      .get('/gamification/dashboard/admin')
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalServants).toBe(summary.body.totals.servants);
        expect(body.tasksOverdue).toBe(metrics.tasksOverdue);
      });

    await request(pastor.getHttpServer())
      .get('/gamification/dashboard/pastor')
      .expect(200)
      .expect(({ body }) => {
        expect(body.ministryHealth).toBeInstanceOf(Array);
        expect(body.alerts).toBeInstanceOf(Array);
      });

    await request(coordinator.getHttpServer())
      .get('/gamification/dashboard/coordinator')
      .expect(200)
      .expect(({ body }) => {
        expect(body.ministryTasksOverdue).toBe(metrics.tasksOverdue);
      });

    await request(servo.getHttpServer())
      .get('/gamification/dashboard/servo')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ myTasks: expect.any(Number), myPoints: expect.any(Number) }));
      });

    await request(admin.getHttpServer()).get('/gamification/analytics/church').expect(200);
    await request(admin.getHttpServer()).get('/gamification/analytics/ministry/m1').expect(200);
    await request(admin.getHttpServer()).get('/gamification/analytics/servant/servant-1').expect(200);
    await request(servo.getHttpServer()).get('/gamification/analytics/me').expect(200);

    await Promise.all([admin.close(), pastor.close(), coordinator.close(), servo.close()]);
  });
});
