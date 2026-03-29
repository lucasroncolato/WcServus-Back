import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AttendanceStatus, Role } from '@prisma/client';
import request = require('supertest');
import { AttendancesController } from 'src/modules/attendances/attendances.controller';
import { AttendancesService } from 'src/modules/attendances/attendances.service';
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E achievements unlock flow', () => {
  const state = {
    servantId: 'servant-1',
    points: 0,
    presence: 0,
    tasks: 0,
    perfectChecklist: 0,
    achievementSet: new Set<string>(),
  };
  let seq = 1;
  const id = (prefix: string): string => `${prefix}-${seq++}`;

  function recomputeAchievements(): void {
    if (state.presence >= 1) state.achievementSet.add('FIRST_PRESENCE');
    if (state.presence >= 10) state.achievementSet.add('PRESENCE_10');
    if (state.tasks >= 5) state.achievementSet.add('TASK_5');
    if (state.perfectChecklist >= 1) state.achievementSet.add('CHECKLIST_PERFECT');
  }

  async function createApp(actor: Actor): Promise<INestApplication> {
    const attendancesServiceMock = {
      checkIn: jest.fn((dto: { status: AttendanceStatus }) => {
        if (dto.status === AttendanceStatus.PRESENTE) {
          state.presence += 1;
          state.points += 10;
          recomputeAchievements();
        }
        return { id: id('att') };
      }),
      findAll: jest.fn(),
      batch: jest.fn(),
      update: jest.fn(),
    };

    const ministryTasksServiceMock = {
      createTemplate: jest.fn(() => ({ data: { id: id('tpl') } })),
      createOccurrence: jest.fn(() => ({ data: { id: id('occ') } })),
      assignOccurrence: jest.fn((_id: string, dto: { servantId: string }) => ({ data: { assignedServantId: dto.servantId } })),
      updateChecklist: jest.fn(() => ({ data: { progressPercent: 100 } })),
      completeOccurrence: jest.fn(() => {
        state.tasks += 1;
        state.perfectChecklist += 1;
        state.points += 20;
        recomputeAchievements();
        return { data: { status: 'COMPLETED' } };
      }),
      listTemplates: jest.fn(),
      getTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      removeTemplate: jest.fn(),
      generateOccurrences: jest.fn(),
      listOccurrences: jest.fn(),
      getOccurrence: jest.fn(),
      reassignOccurrence: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      cancelOccurrence: jest.fn(),
      reallocateFromRemovedServant: jest.fn(),
      dashboard: jest.fn(),
      runRecurringGenerationJob: jest.fn(),
    };

    const gamificationServiceMock = {
      getServantProgress: jest.fn(() => ({ profile: { totalPoints: state.points }, rankingPosition: 1 })),
      listAchievementsCatalog: jest.fn((_user: Actor, servantId?: string) => {
        if (!servantId) return [{ code: 'FIRST_PRESENCE' }, { code: 'PRESENCE_10' }, { code: 'TASK_5' }];
        return [
          { code: 'FIRST_PRESENCE', unlocked: state.achievementSet.has('FIRST_PRESENCE'), progress: state.presence, target: 1, bonusPoints: 10 },
          { code: 'PRESENCE_10', unlocked: state.achievementSet.has('PRESENCE_10'), progress: state.presence, target: 10, bonusPoints: 20 },
          { code: 'TASK_5', unlocked: state.achievementSet.has('TASK_5'), progress: state.tasks, target: 5, bonusPoints: 20 },
          { code: 'CHECKLIST_PERFECT', unlocked: state.achievementSet.has('CHECKLIST_PERFECT'), progress: state.perfectChecklist, target: 1, bonusPoints: 5 },
        ];
      }),
      ranking: jest.fn(() => [{ servantId: state.servantId, points: state.points, position: 1 }]),
      dashboard: jest.fn(() => ({ points: state.points })),
      dashboardAdmin: jest.fn(),
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
      controllers: [AttendancesController, MinistryTasksController, GamificationController],
      providers: [
        { provide: AttendancesService, useValue: attendancesServiceMock },
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

  it('unlocks and persists achievements after real actions', async () => {
    const admin = await createApp({ sub: 'admin', role: Role.ADMIN, churchId: 'church-a' });
    const coordinator = await createApp({ sub: 'coord', role: Role.COORDENADOR, churchId: 'church-a' });
    const servo = await createApp({ sub: 'servo', role: Role.SERVO, churchId: 'church-a', servantId: state.servantId });

    for (let i = 0; i < 10; i += 1) {
      await request(coordinator.getHttpServer())
        .post('/attendances/check-in')
        .send({ serviceId: `svc-${i}`, servantId: state.servantId, status: 'PRESENTE' })
        .expect(201);
    }

    for (let i = 0; i < 5; i += 1) {
      await request(admin.getHttpServer())
        .post('/ministry-tasks/templates')
        .send({ ministryId: 'm1', name: `Tarefa ${i}`, recurrenceType: 'MANUAL', checklistItems: [{ label: 'Item 1' }] })
        .expect(201);
      await request(admin.getHttpServer())
        .post('/ministry-tasks/occurrences')
        .send({ templateId: `tpl-${i}`, scheduledFor: '2026-04-07T19:00:00.000Z' })
        .expect(201);
      await request(admin.getHttpServer())
        .patch('/ministry-tasks/occurrences/occ-1/assign')
        .send({ servantId: state.servantId })
        .expect(200);
      await request(servo.getHttpServer())
        .patch('/ministry-tasks/occurrences/occ-1/checklist')
        .send({ items: [{ itemId: 'item-1', status: 'DONE' }] })
        .expect(200);
      await request(servo.getHttpServer())
        .patch('/ministry-tasks/occurrences/occ-1/complete')
        .send({})
        .expect(200);
    }

    await request(servo.getHttpServer())
      .get('/gamification/achievements/me')
      .expect(200)
      .expect(({ body }) => {
        const unlockedCodes = body.filter((item: { unlocked: boolean }) => item.unlocked).map((item: { code: string }) => item.code);
        expect(unlockedCodes).toEqual(expect.arrayContaining(['FIRST_PRESENCE', 'PRESENCE_10', 'TASK_5', 'CHECKLIST_PERFECT']));
      });

    await request(servo.getHttpServer())
      .get('/gamification/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body.profile.totalPoints).toBeGreaterThan(0);
      });

    await request(servo.getHttpServer())
      .get('/gamification/ranking')
      .expect(200)
      .expect(({ body }) => expect(body[0].points).toBe(state.points));

    await Promise.all([admin.close(), coordinator.close(), servo.close()]);
  });
});
