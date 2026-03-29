import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';
import { ServantsController } from 'src/modules/servants/servants.controller';
import { ServantsService } from 'src/modules/servants/servants.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E training + growth track full flow', () => {
  const state = {
    trackId: '',
    stepId: '',
    servantId: 'servant-1',
    trainingCompleted: 0,
    points: 0,
    progressCompleted: false,
    progressApproved: false,
  };
  let seq = 1;
  const id = (prefix: string): string => `${prefix}-${seq++}`;

  async function createApp(actor: Actor): Promise<INestApplication> {
    const servantsServiceMock = {
      completeTraining: jest.fn(() => {
        state.trainingCompleted += 1;
        state.points += 20;
        return { id: state.servantId, trainingCompleted: state.trainingCompleted };
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
      createGrowthTrack: jest.fn((dto: { name: string }) => {
        state.trackId = id('track');
        return { id: state.trackId, name: dto.name };
      }),
      addGrowthTrackStep: jest.fn((_trackId: string, dto: { title: string }) => {
        state.stepId = id('step');
        return { id: state.stepId, title: dto.title };
      }),
      assignServantToTrack: jest.fn(() => ({ trackId: state.trackId, servantId: state.servantId })),
      updateGrowthTrackProgress: jest.fn((_trackId: string, servantId: string, dto: { stepId: string; completed?: boolean }, user: Actor) => {
        if (user.role === Role.SERVO && user.servantId !== servantId) throw new ForbiddenException('not owner');
        state.progressCompleted = dto.completed === true;
        return { trackId: state.trackId, servantId, completedStepIds: state.progressCompleted ? [dto.stepId] : [] };
      }),
      approveGrowthTrackStep: jest.fn(() => {
        state.progressApproved = true;
        state.points += 20;
        return { trackId: state.trackId, servantId: state.servantId, approvedStepIds: [state.stepId] };
      }),
      myGrowthTracks: jest.fn(() => [
        {
          trackId: state.trackId,
          servantId: state.servantId,
          completedStepIds: state.progressCompleted ? [state.stepId] : [],
          approvedStepIds: state.progressApproved ? [state.stepId] : [],
        },
      ]),
      getServantProgress: jest.fn(() => ({
        profile: { servantId: state.servantId, totalPoints: state.points },
        rankingPosition: 1,
      })),
      listAchievementsCatalog: jest.fn((_user: Actor, servantId?: string) => {
        if (!servantId) return [{ code: 'TRACK_COMPLETED' }];
        return [{ code: 'TRACK_COMPLETED', unlocked: state.progressApproved, progress: state.progressApproved ? 1 : 0, target: 1 }];
      }),
      dashboardCoordinator: jest.fn(() => ({ growthTracksInProgress: state.progressCompleted ? 1 : 0, growthTracksCompleted: state.progressApproved ? 1 : 0 })),
      ranking: jest.fn(() => [{ servantId: state.servantId, points: state.points, position: 1 }]),
      rankingMonthly: jest.fn(),
      rankingYearly: jest.fn(),
      rankingByMetric: jest.fn(),
      dashboard: jest.fn(),
      dashboardAdmin: jest.fn(),
      dashboardPastor: jest.fn(),
      dashboardServo: jest.fn(),
      awardPoints: jest.fn(),
      recomputeServantProfile: jest.fn(),
      recomputeAllProfiles: jest.fn(),
      listGrowthTracks: jest.fn(() => [{ id: state.trackId, steps: [{ id: state.stepId }] }]),
      getGrowthTrack: jest.fn(() => ({ id: state.trackId, steps: [{ id: state.stepId }] })),
      analyticsChurch: jest.fn(),
      analyticsMinistry: jest.fn(),
      analyticsServant: jest.fn(),
      analyticsMe: jest.fn(),
      buildMonthlyStats: jest.fn(),
      syncDefaultAchievementsCatalog: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ServantsController, GamificationController],
      providers: [
        { provide: ServantsService, useValue: servantsServiceMock },
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

  it('runs training + track + approval + achievement flow', async () => {
    const admin = await createApp({ sub: 'admin', role: Role.ADMIN, churchId: 'church-a' });
    const coordinator = await createApp({ sub: 'coord', role: Role.COORDENADOR, churchId: 'church-a' });
    const servo = await createApp({ sub: 'servo-user', role: Role.SERVO, churchId: 'church-a', servantId: state.servantId });

    await request(admin.getHttpServer())
      .post('/gamification/growth-tracks')
      .send({ name: 'Trilha Lideranca', ministryId: 'm1' })
      .expect(201);

    await request(admin.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/steps`)
      .send({ title: 'Curso basico', stepOrder: 1, manualReview: true })
      .expect(201);

    await request(admin.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/assign`)
      .send({ servantId: state.servantId })
      .expect(201);

    await request(admin.getHttpServer())
      .patch(`/servants/${state.servantId}/training/complete`)
      .send({})
      .expect(200);

    await request(servo.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/progress/${state.servantId}`)
      .send({ stepId: state.stepId, completed: true })
      .expect(201);

    await request(coordinator.getHttpServer())
      .post(`/gamification/growth-tracks/${state.trackId}/approve-step`)
      .send({ servantId: state.servantId, stepId: state.stepId })
      .expect(201);

    await request(servo.getHttpServer())
      .get('/gamification/growth-tracks/my')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0].completedStepIds).toContain(state.stepId);
        expect(body[0].approvedStepIds).toContain(state.stepId);
      });

    await request(servo.getHttpServer())
      .get('/gamification/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body.profile.totalPoints).toBeGreaterThanOrEqual(40);
      });

    await request(servo.getHttpServer())
      .get('/gamification/achievements/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0]).toEqual(expect.objectContaining({ code: 'TRACK_COMPLETED', unlocked: true }));
      });

    await request(coordinator.getHttpServer())
      .get('/gamification/dashboard/coordinator')
      .expect(200)
      .expect(({ body }) => {
        expect(body.growthTracksCompleted).toBe(1);
      });

    await Promise.all([admin.close(), coordinator.close(), servo.close()]);
  });
});
