import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';

describe('Phase 4 gamification analytics contracts', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const serviceMock = {
      getServantProgress: jest.fn().mockResolvedValue({ profile: { totalPoints: 100 }, rankingPosition: 2 }),
      ranking: jest.fn().mockResolvedValue([]),
      dashboard: jest.fn().mockResolvedValue({ mode: 'LEADERSHIP' }),
      dashboardAdmin: jest.fn().mockResolvedValue({ profile: 'ADMIN' }),
      dashboardPastor: jest.fn().mockResolvedValue({ profile: 'PASTOR' }),
      dashboardCoordinator: jest.fn().mockResolvedValue({ profile: 'COORDENADOR' }),
      dashboardServo: jest.fn().mockResolvedValue({ profile: 'SERVO' }),
      rankingMonthly: jest.fn().mockResolvedValue({ metric: 'points', data: [] }),
      rankingYearly: jest.fn().mockResolvedValue({ metric: 'points', data: [] }),
      rankingByMetric: jest.fn().mockResolvedValue({ metric: 'tasks', data: [] }),
      awardPoints: jest.fn().mockResolvedValue({}),
      recomputeServantProfile: jest.fn().mockResolvedValue({}),
      recomputeAllProfiles: jest.fn().mockResolvedValue({ processed: 1 }),
      myGrowthTracks: jest.fn().mockResolvedValue([]),
      listGrowthTracks: jest.fn().mockResolvedValue([]),
      getGrowthTrack: jest.fn().mockResolvedValue({ id: 'gt-1' }),
      createGrowthTrack: jest.fn().mockResolvedValue({ id: 'gt-1' }),
      addGrowthTrackStep: jest.fn().mockResolvedValue({ id: 'step-1' }),
      assignServantToTrack: jest.fn().mockResolvedValue({ id: 'gt-1' }),
      updateGrowthTrackProgress: jest.fn().mockResolvedValue({ id: 'progress-1' }),
      approveGrowthTrackStep: jest.fn().mockResolvedValue({ id: 'progress-1' }),
      analyticsChurch: jest.fn().mockResolvedValue({ totalActiveServants: 10 }),
      analyticsMinistry: jest.fn().mockResolvedValue({ ministryId: 'm1' }),
      analyticsServant: jest.fn().mockResolvedValue({ servantId: 's1' }),
      analyticsMe: jest.fn().mockResolvedValue({ servantId: 's-me' }),
      buildMonthlyStats: jest.fn().mockResolvedValue({ processed: 1 }),
      listAchievementsCatalog: jest.fn().mockResolvedValue([]),
      syncDefaultAchievementsCatalog: jest.fn().mockResolvedValue({ synchronized: 1 }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [
        {
          provide: GamificationService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.user = {
        sub: 'u-1',
        role: 'ADMIN',
        churchId: 'church-1',
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes ranking and analytics phase 4 endpoints', async () => {
    await request(app.getHttpServer()).get('/gamification/ranking').expect(200);
    await request(app.getHttpServer()).get('/gamification/ranking/monthly').expect(200);
    await request(app.getHttpServer()).get('/gamification/ranking/yearly').expect(200);
    await request(app.getHttpServer()).get('/gamification/ranking/tasks').expect(200);
    await request(app.getHttpServer()).get('/gamification/ranking/attendance').expect(200);
    await request(app.getHttpServer()).get('/gamification/ranking/checklist').expect(200);
    await request(app.getHttpServer()).get('/gamification/ranking/growth').expect(200);
    await request(app.getHttpServer()).get('/gamification/dashboard/admin').expect(200);
    await request(app.getHttpServer()).get('/gamification/dashboard/pastor').expect(200);
    await request(app.getHttpServer()).get('/gamification/dashboard/coordinator').expect(200);
    await request(app.getHttpServer()).get('/gamification/dashboard/servo').expect(200);
    await request(app.getHttpServer()).get('/gamification/analytics/church').expect(200);
    await request(app.getHttpServer()).get('/gamification/analytics/ministry/m1').expect(200);
    await request(app.getHttpServer()).get('/gamification/analytics/servant/s1').expect(200);
    await request(app.getHttpServer()).get('/gamification/analytics/me').expect(200);
    await request(app.getHttpServer()).get('/gamification/achievements/catalog').expect(200);
    await request(app.getHttpServer()).get('/gamification/achievements/me').expect(200);
    await request(app.getHttpServer()).post('/gamification/achievements/catalog/sync').expect(201);
  });

  it('exposes growth track operational endpoints', async () => {
    await request(app.getHttpServer()).get('/gamification/growth-tracks').expect(200);
    await request(app.getHttpServer()).get('/gamification/growth-tracks/gt-1').expect(200);
    await request(app.getHttpServer()).post('/gamification/growth-tracks').send({ name: 'Trilha Lideranca' }).expect(201);
    await request(app.getHttpServer()).post('/gamification/growth-tracks/gt-1/steps').send({ title: 'Etapa 1', stepOrder: 1 }).expect(201);
    await request(app.getHttpServer()).post('/gamification/growth-tracks/gt-1/assign').send({ servantId: 's1' }).expect(201);
    await request(app.getHttpServer()).post('/gamification/growth-tracks/gt-1/progress/s1').send({ stepId: 'step-1', completed: true }).expect(201);
    await request(app.getHttpServer()).post('/gamification/growth-tracks/gt-1/approve-step').send({ servantId: 's1', stepId: 'step-1' }).expect(201);
  });
});
