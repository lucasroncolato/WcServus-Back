import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { RolesGuard } from 'src/common/guards/roles.guard';
import { DashboardController } from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { MinistryTasksController } from 'src/modules/ministry-tasks/ministry-tasks.controller';
import { MinistryTasksService } from 'src/modules/ministry-tasks/ministry-tasks.service';
import { WorshipServicesController } from 'src/modules/worship-services/worship-services.controller';
import { WorshipServicesService } from 'src/modules/worship-services/worship-services.service';

describe('E2E cross-church access and id tampering', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const worshipServicesServiceMock = {
      findAll: jest.fn(() => []),
      findOne: jest.fn((id: string, actor: { churchId?: string | null }) => {
        if (id === 'ws-b' && actor.churchId === 'church-a') {
          throw new ForbiddenException('Cross-church access blocked');
        }
        return { id };
      }),
      create: jest.fn(),
      update: jest.fn(),
    };

    const ministryTasksServiceMock = {
      createOccurrence: jest.fn((dto: { ministryId?: string; serviceId?: string }, actor: { churchId?: string | null }) => {
        if ((dto.ministryId === 'ministry-b' || dto.serviceId === 'service-b') && actor.churchId === 'church-a') {
          throw new ForbiddenException('Cross-church assignment blocked');
        }
        return { data: { id: 'occ-1' } };
      }),
      dashboard: jest.fn((_: unknown, actor: { churchId?: string | null }, ministryId?: string) => {
        if (ministryId === 'ministry-b' && actor.churchId === 'church-a') {
          throw new ForbiddenException('Cross-church dashboard blocked');
        }
        return { summary: { total: 1 } };
      }),
      listTemplates: jest.fn(),
      getTemplate: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      removeTemplate: jest.fn(),
      generateOccurrences: jest.fn(),
      listOccurrences: jest.fn(),
      getOccurrence: jest.fn(),
      assignOccurrence: jest.fn(),
      reassignOccurrence: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      updateChecklist: jest.fn(),
      completeOccurrence: jest.fn(),
      cancelOccurrence: jest.fn(),
      reallocateFromRemovedServant: jest.fn(),
      runRecurringGenerationJob: jest.fn(),
    };

    const dashboardServiceMock = {
      summary: jest.fn((actor: { churchId?: string | null }) => ({ churchId: actor.churchId })),
      alerts: jest.fn(() => []),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WorshipServicesController, MinistryTasksController, DashboardController],
      providers: [
        { provide: WorshipServicesService, useValue: worshipServicesServiceMock },
        { provide: MinistryTasksService, useValue: ministryTasksServiceMock },
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, string | string[] | undefined>; user?: unknown }, _res: unknown, next: () => void) => {
      req.user = {
        sub: 'admin-a',
        email: 'admin@local',
        role: String(req.headers['x-test-role'] ?? Role.ADMIN),
        churchId: String(req.headers['x-test-church'] ?? 'church-a'),
        servantId: String(req.headers['x-test-servant'] ?? 'servant-a'),
      };
      next();
    });
    app.useGlobalGuards(new RolesGuard(new Reflector()));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks direct detail access by id from another church', async () => {
    await request(app.getHttpServer())
      .get('/worship-services/ws-b')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .expect(403);
  });

  it('blocks cross-church ministry-task occurrence creation', async () => {
    await request(app.getHttpServer())
      .post('/ministry-tasks/occurrences')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .send({ templateId: 'tpl-a', serviceId: 'service-b', scheduledFor: '2026-04-02T10:00:00.000Z' })
      .expect(403);
  });

  it('blocks cross-church dashboard by ministry id tampering', async () => {
    await request(app.getHttpServer())
      .get('/ministry-tasks/dashboard/ministry/ministry-b')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .expect(403);
  });

  it('dashboard remains role-protected for SERVO', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('x-test-role', Role.SERVO)
      .set('x-test-church', 'church-a')
      .expect(403);
  });
});
