import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';
import { MinistriesController } from 'src/modules/ministries/ministries.controller';
import { MinistriesService } from 'src/modules/ministries/ministries.service';
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E multi-church scope isolation', () => {
  const state = {
    ministries: [
      { id: 'm-a', churchId: 'church-a', name: 'Louvor A' },
      { id: 'm-b', churchId: 'church-b', name: 'Louvor B' },
    ],
    occurrences: [
      { id: 'o-a', churchId: 'church-a', ministryId: 'm-a', assignedServantId: 'servant-a1' },
      { id: 'o-b', churchId: 'church-b', ministryId: 'm-b', assignedServantId: 'servant-b1' },
    ],
    rankings: {
      'church-a': [{ servantId: 'servant-a1', points: 80, position: 1 }],
      'church-b': [{ servantId: 'servant-b1', points: 120, position: 1 }],
    } as Record<string, Array<{ servantId: string; points: number; position: number }>>,
  };

  async function createApp(actor: Actor): Promise<INestApplication> {
    const ministriesServiceMock = {
      findAll: jest.fn((user: Actor) => state.ministries.filter((item) => item.churchId === user.churchId)),
      findOne: jest.fn((id: string, user: Actor) => {
        const ministry = state.ministries.find((item) => item.id === id);
        if (!ministry) return null;
        if (ministry.churchId !== user.churchId) throw new ForbiddenException('cross church denied');
        return ministry;
      }),
      create: jest.fn((dto: { name: string }, user: Actor) => {
        const created = { id: `m-${user.churchId}-${Date.now()}`, churchId: user.churchId, name: dto.name };
        state.ministries.push(created);
        return created;
      }),
      createResponsibility: jest.fn(),
      update: jest.fn(),
      listServants: jest.fn(),
      listResponsibilities: jest.fn(),
      updateResponsibility: jest.fn(),
    };
    const ministryTasksServiceMock = {
      listOccurrences: jest.fn((_query: Record<string, unknown>, user: Actor) => ({
        data: state.occurrences.filter((item) => item.churchId === user.churchId),
      })),
      getOccurrence: jest.fn((id: string, user: Actor) => {
        const occ = state.occurrences.find((item) => item.id === id);
        if (!occ) return null;
        if (occ.churchId !== user.churchId) throw new ForbiddenException('cross church denied');
        return occ;
      }),
      dashboard: jest.fn((_query: Record<string, unknown>, user: Actor) => ({
        totalPending: state.occurrences.filter((item) => item.churchId === user.churchId).length,
      })),
      listTemplates: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      removeTemplate: jest.fn(),
      generateOccurrences: jest.fn(),
      createOccurrence: jest.fn(),
      assignOccurrence: jest.fn(),
      reassignOccurrence: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      updateChecklist: jest.fn(),
      completeOccurrence: jest.fn(),
      cancelOccurrence: jest.fn(),
      reallocateFromRemovedServant: jest.fn(),
      runRecurringGenerationJob: jest.fn(),
      getTemplate: jest.fn(),
    };
    const gamificationServiceMock = {
      ranking: jest.fn((_query: Record<string, unknown>, user: Actor) => state.rankings[user.churchId] ?? []),
      dashboardAdmin: jest.fn((user: Actor) => ({ totalServants: (state.rankings[user.churchId] ?? []).length })),
      analyticsChurch: jest.fn((user: Actor) => ({ totalActiveServants: (state.rankings[user.churchId] ?? []).length })),
      getServantProgress: jest.fn(),
      dashboard: jest.fn(),
      dashboardPastor: jest.fn(),
      dashboardCoordinator: jest.fn(),
      dashboardServo: jest.fn(),
      rankingMonthly: jest.fn(),
      rankingYearly: jest.fn(),
      rankingByMetric: jest.fn(),
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
      analyticsMinistry: jest.fn(),
      analyticsServant: jest.fn(),
      analyticsMe: jest.fn(),
      buildMonthlyStats: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MinistriesController, MinistryTasksController, GamificationController],
      providers: [
        { provide: MinistriesService, useValue: ministriesServiceMock },
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

  it('blocks cross-church visibility and keeps scoped queries isolated', async () => {
    const adminA = await createApp({ sub: 'admin-a', role: Role.ADMIN, churchId: 'church-a' });
    const adminB = await createApp({ sub: 'admin-b', role: Role.ADMIN, churchId: 'church-b' });

    await request(adminA.getHttpServer())
      .get('/ministries')
      .expect(200)
      .expect(({ body }) => {
        expect(body.every((item: { churchId: string }) => item.churchId === 'church-a')).toBe(true);
      });
    await request(adminB.getHttpServer())
      .get('/ministries')
      .expect(200)
      .expect(({ body }) => {
        expect(body.every((item: { churchId: string }) => item.churchId === 'church-b')).toBe(true);
      });

    await request(adminA.getHttpServer()).get('/ministries/m-b').expect(403);
    await request(adminB.getHttpServer()).get('/ministries/m-a').expect(403);

    await request(adminA.getHttpServer())
      .get('/ministry-tasks/occurrences')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual([{ id: 'o-a', churchId: 'church-a', ministryId: 'm-a', assignedServantId: 'servant-a1' }]);
      });
    await request(adminB.getHttpServer())
      .get('/ministry-tasks/occurrences')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual([{ id: 'o-b', churchId: 'church-b', ministryId: 'm-b', assignedServantId: 'servant-b1' }]);
      });

    await request(adminA.getHttpServer())
      .get('/gamification/ranking')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0].servantId).toBe('servant-a1');
      });
    await request(adminB.getHttpServer())
      .get('/gamification/ranking')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0].servantId).toBe('servant-b1');
      });

    await Promise.all([adminA.close(), adminB.close()]);
  });
});
