import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MinistryTaskChecklistItemStatus, MinistryTaskOccurrenceStatus, Role } from '@prisma/client';
import request = require('supertest');
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';
import { MinistriesController } from 'src/modules/ministries/ministries.controller';
import { MinistriesService } from 'src/modules/ministries/ministries.service';
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E ministry tasks full flow', () => {
  const state = {
    ministryId: 'ministry-1',
    templateId: '',
    occurrenceId: '',
    checklistItemIds: [] as string[],
    occurrenceStatus: MinistryTaskOccurrenceStatus.PENDING as MinistryTaskOccurrenceStatus,
    progressPercent: 0,
    assignedServantId: '',
    points: new Map<string, number>([['servant-1', 0]]),
    completedTasks: new Map<string, number>([['servant-1', 0]]),
  };
  let seq = 1;
  const id = (prefix: string): string => `${prefix}-${seq++}`;

  async function createApp(actor: Actor): Promise<INestApplication> {
    const ministriesServiceMock = {
      create: jest.fn(),
      createResponsibility: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      listServants: jest.fn(),
      listResponsibilities: jest.fn(),
      updateResponsibility: jest.fn(),
    };
    const ministryTasksServiceMock = {
      createTemplate: jest.fn((dto: { name: string; checklistItems?: Array<{ label: string }> }) => {
        state.templateId = id('template');
        state.checklistItemIds = (dto.checklistItems ?? []).map(() => id('item'));
        return {
          data: {
            id: state.templateId,
            name: dto.name,
            checklistItems: state.checklistItemIds.map((itemId, index) => ({
              id: itemId,
              label: dto.checklistItems?.[index]?.label ?? `Item ${index + 1}`,
            })),
          },
        };
      }),
      createOccurrence: jest.fn(() => {
        state.occurrenceId = id('occ');
        state.occurrenceStatus = MinistryTaskOccurrenceStatus.PENDING;
        state.progressPercent = 0;
        return {
          data: {
            id: state.occurrenceId,
            status: state.occurrenceStatus,
            progressPercent: state.progressPercent,
            checklistItems: state.checklistItemIds.map((itemId) => ({ id: itemId, status: 'PENDING' })),
          },
        };
      }),
      assignOccurrence: jest.fn((_id: string, dto: { servantId: string }) => {
        state.assignedServantId = dto.servantId;
        state.occurrenceStatus = MinistryTaskOccurrenceStatus.ASSIGNED;
        return { data: { id: state.occurrenceId, assignedServantId: state.assignedServantId, status: state.occurrenceStatus } };
      }),
      updateChecklist: jest.fn((_id: string, dto: { items: Array<{ itemId: string; status: MinistryTaskChecklistItemStatus }> }) => {
        if (actor.role === Role.SERVO && actor.servantId !== state.assignedServantId) {
          throw new ForbiddenException('Not owner');
        }
        const done = dto.items.filter((item) => item.status === MinistryTaskChecklistItemStatus.DONE).length;
        state.progressPercent = Math.round((done / state.checklistItemIds.length) * 100);
        state.occurrenceStatus = MinistryTaskOccurrenceStatus.IN_PROGRESS;
        return { data: { id: state.occurrenceId, progressPercent: state.progressPercent, status: state.occurrenceStatus } };
      }),
      completeOccurrence: jest.fn(() => {
        if (actor.role === Role.SERVO && actor.servantId !== state.assignedServantId) {
          throw new ForbiddenException('Not owner');
        }
        state.occurrenceStatus = MinistryTaskOccurrenceStatus.COMPLETED;
        state.progressPercent = 100;
        state.points.set(state.assignedServantId, (state.points.get(state.assignedServantId) ?? 0) + 20);
        state.completedTasks.set(
          state.assignedServantId,
          (state.completedTasks.get(state.assignedServantId) ?? 0) + 1,
        );
        return { data: { id: state.occurrenceId, status: state.occurrenceStatus, progressPercent: state.progressPercent } };
      }),
      listOccurrences: jest.fn(() => ({ data: [{ id: state.occurrenceId, status: state.occurrenceStatus, progressPercent: state.progressPercent }] })),
      dashboard: jest.fn(() => ({ totalPending: state.occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED ? 0 : 1 })),
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
    const gamificationServiceMock = {
      getServantProgress: jest.fn((servantId: string) => ({
        profile: { servantId, totalPoints: state.points.get(servantId) ?? 0 },
        rankingPosition: 1,
      })),
      ranking: jest.fn(() =>
        Array.from(state.points.entries()).map(([servantId, points], index) => ({ servantId, points, position: index + 1 })),
      ),
      listAchievementsCatalog: jest.fn((_user: Actor, servantId?: string) => {
        const idTarget = servantId ?? actor.servantId ?? 'servant-1';
        const tasks = state.completedTasks.get(idTarget) ?? 0;
        return [
          { code: 'FIRST_TASK', unlocked: tasks >= 1, progress: tasks, target: 1 },
          { code: 'TASK_5', unlocked: tasks >= 5, progress: tasks, target: 5 },
        ];
      }),
      dashboardServo: jest.fn(() => ({
        myTasks: state.occurrenceStatus === MinistryTaskOccurrenceStatus.COMPLETED ? 0 : 1,
        myPoints: state.points.get(actor.servantId ?? 'servant-1') ?? 0,
      })),
      dashboardAdmin: jest.fn(),
      dashboardPastor: jest.fn(),
      dashboardCoordinator: jest.fn(),
      dashboard: jest.fn(),
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

  it('runs task flow from template to completion with progress, points and achievements', async () => {
    const admin = await createApp({ sub: 'admin-a', role: Role.ADMIN, churchId: 'church-a' });
    const servo = await createApp({ sub: 'servo-user', role: Role.SERVO, churchId: 'church-a', servantId: 'servant-1' });

    await request(admin.getHttpServer())
      .post('/ministry-tasks/templates')
      .send({
        ministryId: state.ministryId,
        name: 'Checklist de transmissao',
        recurrenceType: 'MANUAL',
        checklistItems: [{ label: 'Testar camera 1' }, { label: 'Verificar audio' }],
      })
      .expect(201);

    await request(admin.getHttpServer())
      .post('/ministry-tasks/occurrences')
      .send({ templateId: state.templateId, scheduledFor: '2026-04-06T18:00:00.000Z' })
      .expect(201);

    await request(admin.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.occurrenceId}/assign`)
      .send({ servantId: 'servant-1' })
      .expect(200);

    await request(servo.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.occurrenceId}/checklist`)
      .send({
        items: state.checklistItemIds.map((itemId) => ({ itemId, status: 'DONE' })),
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.progressPercent).toBe(100);
      });

    await request(servo.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.occurrenceId}/complete`)
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.status).toBe(MinistryTaskOccurrenceStatus.COMPLETED);
      });

    await request(servo.getHttpServer())
      .get('/gamification/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body.profile.totalPoints).toBeGreaterThanOrEqual(20);
      });

    await request(servo.getHttpServer())
      .get('/gamification/achievements/me')
      .expect(200)
      .expect(({ body }) => {
        const firstTask = body.find((item: { code: string }) => item.code === 'FIRST_TASK');
        expect(firstTask.unlocked).toBe(true);
      });

    await request(servo.getHttpServer())
      .get('/gamification/ranking')
      .expect(200)
      .expect(({ body }) => expect(body[0]).toEqual(expect.objectContaining({ servantId: 'servant-1' })));

    await Promise.all([admin.close(), servo.close()]);
  });
});
