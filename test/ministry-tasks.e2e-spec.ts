import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';

jest.setTimeout(30000);

async function createControllerApp(role: string, ministryTasksServiceMock: Record<string, jest.Mock>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [MinistryTasksController],
    providers: [{ provide: MinistryTasksService, useValue: ministryTasksServiceMock }],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req: any, _res: any, next: () => void) => {
    req.user = {
      sub: 'user-1',
      email: 'user@church.local',
      role,
      servantId: role === 'SERVO' ? 'servant-1' : null,
      churchId: 'church-1',
    };
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}

describe('Ministry tasks module contracts', () => {
  let app: INestApplication;
  const serviceMock = {
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    removeTemplate: jest.fn(),
    generateOccurrences: jest.fn(),
    listOccurrences: jest.fn(),
    getOccurrence: jest.fn(),
    createOccurrence: jest.fn(),
    assignOccurrence: jest.fn(),
    reassignOccurrence: jest.fn(),
    addAssignee: jest.fn(),
    removeAssignee: jest.fn(),
    updateChecklist: jest.fn(),
    completeOccurrence: jest.fn(),
    cancelOccurrence: jest.fn(),
    reallocateFromRemovedServant: jest.fn(),
    dashboard: jest.fn(),
    runRecurringGenerationJob: jest.fn(),
  };

  afterEach(async () => {
    jest.clearAllMocks();
    if (app) {
      await app.close();
    }
  });

  it('admin creates template and occurrence', async () => {
    app = await createControllerApp('ADMIN', serviceMock);
    serviceMock.createTemplate.mockResolvedValue({ data: { id: 'tpl-1', name: 'Checklist culto' } });
    serviceMock.createOccurrence.mockResolvedValue({ data: { id: 'occ-1', status: 'PENDING' } });

    await request(app.getHttpServer())
      .post('/ministry-tasks/templates')
      .send({ ministryId: 'm1', name: 'Checklist culto', recurrenceType: 'MANUAL' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/ministry-tasks/occurrences')
      .send({ templateId: 'tpl-1', scheduledFor: '2026-04-01T19:00:00.000Z' })
      .expect(201);
  });

  it('servo updates checklist and completes own task', async () => {
    app = await createControllerApp('SERVO', serviceMock);
    serviceMock.updateChecklist.mockResolvedValue({ data: { id: 'occ-1', progressPercent: 50 } });
    serviceMock.completeOccurrence.mockResolvedValue({ data: { id: 'occ-1', status: 'COMPLETED' } });

    await request(app.getHttpServer())
      .patch('/ministry-tasks/occurrences/occ-1/checklist')
      .send({ items: [{ itemId: 'item-1', status: 'DONE' }] })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/ministry-tasks/occurrences/occ-1/complete')
      .send({})
      .expect(200);
  });

  it('admin generates recurring occurrences and cancels occurrence', async () => {
    app = await createControllerApp('ADMIN', serviceMock);
    serviceMock.generateOccurrences.mockResolvedValue({ created: 2, occurrenceIds: ['o1', 'o2'] });
    serviceMock.cancelOccurrence.mockResolvedValue({ data: { id: 'o1', status: 'CANCELLED' } });

    await request(app.getHttpServer())
      .post('/ministry-tasks/templates/tpl-1/generate')
      .send({ fromDate: '2026-04-01T00:00:00.000Z', toDate: '2026-04-30T23:59:59.000Z' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ created: 2 }));
      });

    await request(app.getHttpServer())
      .patch('/ministry-tasks/occurrences/o1/cancel')
      .send({ reason: 'Teste operacional' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }));
      });
  });

  it('admin can reassign an occurrence and trigger reallocation flow endpoint', async () => {
    app = await createControllerApp('ADMIN', serviceMock);
    serviceMock.reassignOccurrence.mockResolvedValue({ data: { id: 'o1', assignedServantId: 'serv-new' } });
    serviceMock.reallocateFromRemovedServant.mockResolvedValue({ impacted: 1, reassigned: 1, unassigned: 0 });

    await request(app.getHttpServer())
      .patch('/ministry-tasks/occurrences/o1/reassign')
      .send({ newAssignedServantId: 'serv-new', preserveProgress: true, reason: 'Troca de escala' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/ministry-tasks/reallocate-from-removed-servant')
      .send({ serviceId: 'svc-1', removedServantId: 'serv-old', mode: 'AUTO_EQUAL_DISTRIBUTION' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ impacted: 1, reassigned: 1 }));
      });
  });

  it('admin can manage assignees and dashboard endpoint', async () => {
    app = await createControllerApp('ADMIN', serviceMock);
    serviceMock.addAssignee.mockResolvedValue({ data: { id: 'o1' } });
    serviceMock.removeAssignee.mockResolvedValue({ data: { id: 'o1' } });
    serviceMock.dashboard.mockResolvedValue({ totalPending: 1 });

    await request(app.getHttpServer())
      .post('/ministry-tasks/occurrences/o1/assignees')
      .send({ servantId: 'serv-2', role: 'SUPPORT' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/ministry-tasks/occurrences/o1/assignees/serv-2')
      .expect(200);

    await request(app.getHttpServer())
      .get('/ministry-tasks/dashboard')
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(expect.objectContaining({ totalPending: 1 })));
  });

  it('pastor has read-only access contract', async () => {
    app = await createControllerApp('PASTOR', serviceMock);
    serviceMock.listTemplates.mockResolvedValue({ data: [] });
    serviceMock.listOccurrences.mockResolvedValue({ data: [] });

    await request(app.getHttpServer()).get('/ministry-tasks/templates').expect(200);
    await request(app.getHttpServer()).get('/ministry-tasks/occurrences').expect(200);
  });
});
