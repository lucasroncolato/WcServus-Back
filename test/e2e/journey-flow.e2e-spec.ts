import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AttendanceStatus, MinistryTaskChecklistItemStatus, Role } from '@prisma/client';
import request = require('supertest');
import { AttendancesController } from 'src/modules/attendances/attendances.controller';
import { AttendancesService } from 'src/modules/attendances/attendances.service';
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';
import { ServantsController } from 'src/modules/servants/servants.controller';
import { ServantsService } from 'src/modules/servants/servants.service';
import { JourneyController } from 'src/modules/journey/journey.controller';
import { JourneyService } from 'src/modules/journey/journey.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string | null };

describe('E2E Journey full flow + privacy', () => {
  const state = {
    churchId: 'church-1',
    servantId: 'servant-1',
    serviceId: 'service-1',
    occurrenceId: 'occ-1',
    checklistItemId: 'item-1',
    attendanceDone: false,
    taskAssigned: false,
    checklistDone: false,
    taskDone: false,
    trainingDone: false,
    logs: [] as Array<{ id: string; type: string; title: string; description?: string; occurredAt: string; createdAt: string }> ,
    milestones: [] as Array<{ id: string; achievedAt: string; milestone: { id: string; code: string; name: string; description?: string } }>,
  };

  function pushLog(type: string, title: string, description?: string) {
    const now = new Date().toISOString();
    state.logs.unshift({
      id: `log-${state.logs.length + 1}`,
      type,
      title,
      description,
      occurredAt: now,
      createdAt: now,
    });
  }

  function recomputeMilestones() {
    const milestones: Array<{ id: string; achievedAt: string; milestone: { id: string; code: string; name: string; description?: string } }> = [];
    if (state.attendanceDone) {
      milestones.push({ id: 'sm-1', achievedAt: new Date().toISOString(), milestone: { id: 'm-1', code: 'FIRST_SERVICE', name: 'Primeiro servico' } });
    }
    if (state.taskDone) {
      milestones.push({ id: 'sm-2', achievedAt: new Date().toISOString(), milestone: { id: 'm-2', code: 'FIRST_TASK', name: 'Primeira tarefa' } });
    }
    if (state.trainingDone) {
      milestones.push({ id: 'sm-3', achievedAt: new Date().toISOString(), milestone: { id: 'm-3', code: 'FIRST_TRAINING', name: 'Primeiro treinamento' } });
    }
    state.milestones = milestones;
  }

  async function createApp(actor: Actor): Promise<INestApplication> {
    const attendancesServiceMock = {
      checkIn: jest.fn((dto: { serviceId: string; servantId: string; status: AttendanceStatus }) => {
        if (dto.status === AttendanceStatus.PRESENTE && dto.servantId === state.servantId) {
          state.attendanceDone = true;
          pushLog('SERVICE', 'Serviu no culto', 'Presenca confirmada em culto.');
          recomputeMilestones();
        }
        return { id: 'att-1', serviceId: dto.serviceId, servantId: dto.servantId, status: dto.status };
      }),
      findAll: jest.fn(() => []),
      batch: jest.fn(() => []),
      update: jest.fn(),
    };

    const ministryTasksServiceMock = {
      createTemplate: jest.fn(() => ({ data: { id: 'tpl-1', checklistItems: [{ id: state.checklistItemId }] } })),
      createOccurrence: jest.fn(() => ({ data: { id: state.occurrenceId, status: 'PENDING', progressPercent: 0 } })),
      assignOccurrence: jest.fn((_id: string, dto: { servantId: string }) => {
        state.taskAssigned = dto.servantId === state.servantId;
        pushLog('TASK', 'Recebeu tarefa', 'Nova tarefa atribuida para a caminhada.');
        return { data: { id: state.occurrenceId, assignedServantId: dto.servantId, status: 'ASSIGNED' } };
      }),
      getOccurrence: jest.fn((id: string) => {
        if (id !== state.occurrenceId) throw new ForbiddenException('Occurrence not found');
        return {
          id,
          status: state.taskDone ? 'COMPLETED' : state.taskAssigned ? 'ASSIGNED' : 'PENDING',
          progressPercent: state.checklistDone ? 100 : 0,
          checklistItems: [{ id: state.checklistItemId, label: 'Checklist', status: state.checklistDone ? 'DONE' : 'PENDING' }],
        };
      }),
      updateChecklist: jest.fn((_id: string, dto: { items: Array<{ itemId: string; status: MinistryTaskChecklistItemStatus }> }) => {
        const done = dto.items.every((item) => item.status === 'DONE');
        if (done) {
          state.checklistDone = true;
          pushLog('CHECKLIST', 'Completou checklist', 'Checklist concluido.');
          recomputeMilestones();
        }
        return { data: { id: state.occurrenceId, progressPercent: done ? 100 : 0 } };
      }),
      completeOccurrence: jest.fn(() => {
        state.taskDone = true;
        pushLog('TASK', 'Concluiu tarefa', 'Concluiu uma tarefa ministerial.');
        recomputeMilestones();
        return { data: { id: state.occurrenceId, status: 'COMPLETED', progressPercent: 100 } };
      }),
      listTemplates: jest.fn(() => ({ data: [] })),
      updateTemplate: jest.fn(),
      listOccurrences: jest.fn(() => ({ data: [] })),
      reassignOccurrence: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      cancelOccurrence: jest.fn(),
      reallocateFromRemovedServant: jest.fn(),
      dashboard: jest.fn(() => ({ totalPending: state.taskDone ? 0 : 1 })),
      runRecurringGenerationJob: jest.fn(),
    };

    const servantsServiceMock = {
      completeTraining: jest.fn(() => {
        state.trainingDone = true;
        pushLog('TRAINING', 'Concluiu treinamento', 'Treinamento ministerial concluido.');
        recomputeMilestones();
        return { id: state.servantId, trainingStatus: 'COMPLETED' };
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

    const buildJourneyPayload = () => ({
        summary: {
          startedAt: '2025-01-01T00:00:00.000Z',
          monthsServing: 14,
          ministriesCount: 2,
          totalServices: state.attendanceDone ? 1 : 0,
          totalTasksCompleted: state.taskDone ? 1 : 0,
          totalTrainingsCompleted: state.trainingDone ? 1 : 0,
          totalEventsServed: 0,
          completedTracks: 0,
          milestonesUnlocked: state.milestones.length,
          lastActivityAt: state.logs[0]?.occurredAt ?? null,
        },
        milestones: state.milestones,
        logs: state.logs,
        indicators: [
          { key: 'constancy', name: 'Constancia', progressPercent: state.attendanceDone ? 70 : 20, level: state.attendanceDone ? 'MUITO_BOM' : 'INICIANTE', description: '' },
          { key: 'commitment', name: 'Compromisso', progressPercent: state.taskDone ? 68 : 30, level: state.taskDone ? 'BOM' : 'EM_DESENVOLVIMENTO', description: '' },
        ],
        visual: {
          metaphor: 'arvore da jornada',
          totalSeeds: state.logs.length,
          stage: state.logs.length >= 4 ? 'arvore-crescendo' : 'broto',
          stageLabel: state.logs.length >= 4 ? 'Arvore crescendo' : 'Broto em desenvolvimento',
        },
        motivationalMessage: 'Seu servico tem valor.',
        nextSteps: state.trainingDone ? ['Continue firme na caminhada.'] : ['Concluir o proximo treinamento recomendado.'],
      });

    const journeyServiceMock = {
      getMyJourney: jest.fn((_servantId: string) => buildJourneyPayload()),
      getSummary: jest.fn(() => buildJourneyPayload().summary),
      getMilestones: jest.fn(() => state.milestones),
      getLogs: jest.fn(() => state.logs),
      getIndicators: jest.fn(() => buildJourneyPayload().indicators),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AttendancesController, MinistryTasksController, ServantsController, JourneyController],
      providers: [
        { provide: AttendancesService, useValue: attendancesServiceMock },
        { provide: MinistryTasksService, useValue: ministryTasksServiceMock },
        { provide: ServantsService, useValue: servantsServiceMock },
        { provide: JourneyService, useValue: journeyServiceMock },
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

  it('executes full journey flow and reflects canonical endpoints', async () => {
    const admin = await createApp({ sub: 'admin-1', role: Role.ADMIN, churchId: state.churchId, servantId: null });
    const servo = await createApp({ sub: 'servo-1', role: Role.SERVO, churchId: state.churchId, servantId: state.servantId });

    await request(admin.getHttpServer())
      .post('/attendances/check-in')
      .send({ serviceId: state.serviceId, servantId: state.servantId, status: 'PRESENTE' })
      .expect(201);

    await request(admin.getHttpServer())
      .post('/ministry-tasks/templates')
      .send({ ministryId: 'm-1', name: 'Checklist de servico', recurrenceType: 'MANUAL', checklistItems: [{ label: 'Item 1' }] })
      .expect(201);

    await request(admin.getHttpServer())
      .post('/ministry-tasks/occurrences')
      .send({ templateId: 'tpl-1', serviceId: state.serviceId, scheduledFor: '2026-04-12T17:30:00.000Z' })
      .expect(201);

    await request(admin.getHttpServer())
      .patch(`/ministry-tasks/occurrences/${state.occurrenceId}/assign`)
      .send({ servantId: state.servantId })
      .expect(200);

    await request(servo.getHttpServer())
      .get(`/ministry-tasks/occurrences/${state.occurrenceId}`)
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

    await request(servo.getHttpServer())
      .get('/journey/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary.totalServices).toBe(1);
        expect(body.summary.totalTasksCompleted).toBe(1);
        expect(body.summary.totalTrainingsCompleted).toBe(1);
        expect(body.milestones.length).toBeGreaterThan(0);
        expect(body.logs.length).toBeGreaterThan(0);
        expect(body.indicators.length).toBeGreaterThan(0);
        expect(body.nextSteps).toBeDefined();
      });

    await request(servo.getHttpServer()).get('/journey/me/summary').expect(200);
    await request(servo.getHttpServer()).get('/journey/me/milestones').expect(200);
    await request(servo.getHttpServer()).get('/journey/me/logs').expect(200);
    await request(servo.getHttpServer()).get('/journey/me/indicators').expect(200);

    await request(servo.getHttpServer())
      .get('/journey/me?servantId=other-servant')
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary.totalServices).toBe(1);
      });

    await Promise.all([admin.close(), servo.close()]);
  });

  it('enforces journey privacy for non-servo profiles', async () => {
    const admin = await createApp({ sub: 'admin-1', role: Role.ADMIN, churchId: state.churchId, servantId: null });
    const pastor = await createApp({ sub: 'pastor-1', role: Role.PASTOR, churchId: state.churchId, servantId: null });
    const coord = await createApp({ sub: 'coord-1', role: Role.COORDENADOR, churchId: state.churchId, servantId: null });
    const superAdmin = await createApp({ sub: 'root-1', role: Role.SUPER_ADMIN, churchId: state.churchId, servantId: null });

    await request(admin.getHttpServer()).get('/journey/me').expect(403);
    await request(pastor.getHttpServer()).get('/journey/me').expect(403);
    await request(coord.getHttpServer()).get('/journey/me').expect(403);
    await request(superAdmin.getHttpServer()).get('/journey/me').expect(403);

    await Promise.all([admin.close(), pastor.close(), coord.close(), superAdmin.close()]);
  });
});
