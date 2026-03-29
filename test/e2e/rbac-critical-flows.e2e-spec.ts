import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JourneyController } from 'src/modules/journey/journey.controller';
import { JourneyService } from 'src/modules/journey/journey.service';
import { PastoralVisitsController } from 'src/modules/pastoral-visits/pastoral-visits.controller';
import { PastoralVisitsService } from 'src/modules/pastoral-visits/pastoral-visits.service';
import { WorshipServicesController } from 'src/modules/worship-services/worship-services.controller';
import { WorshipServicesService } from 'src/modules/worship-services/worship-services.service';

function actorFromHeaders(headers: Record<string, string | string[] | undefined>) {
  const role = String(headers['x-test-role'] ?? Role.SERVO) as Role;
  const churchId = String(headers['x-test-church'] ?? 'church-a');
  const servantId = String(headers['x-test-servant'] ?? 'servant-a');
  return {
    sub: 'user-test',
    email: 'test@local',
    role,
    churchId,
    servantId,
  };
}

describe('E2E RBAC critical flows', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const journeyServiceMock = {
      getMyJourney: jest.fn(() => ({ summary: { totalServices: 1 } })),
      getSummary: jest.fn(() => ({ totalServices: 1 })),
      getMilestones: jest.fn(() => []),
      getLogs: jest.fn(() => []),
      getIndicators: jest.fn(() => []),
    };

    const pastoralVisitsServiceMock = {
      findAll: jest.fn(() => []),
      create: jest.fn(() => ({ id: 'pv-1' })),
      resolve: jest.fn(() => ({ id: 'pv-1', status: 'RESOLVIDA' })),
      historyByServant: jest.fn(() => []),
    };

    const worshipServicesServiceMock = {
      findAll: jest.fn(() => []),
      findOne: jest.fn(() => ({ id: 'ws-1' })),
      create: jest.fn(() => ({ id: 'ws-1' })),
      update: jest.fn(() => ({ id: 'ws-1' })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [JourneyController, PastoralVisitsController, WorshipServicesController],
      providers: [
        { provide: JourneyService, useValue: journeyServiceMock },
        { provide: PastoralVisitsService, useValue: pastoralVisitsServiceMock },
        { provide: WorshipServicesService, useValue: worshipServicesServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, string | string[] | undefined>; user?: unknown }, _res: unknown, next: () => void) => {
      req.user = actorFromHeaders(req.headers);
      next();
    });
    app.useGlobalGuards(new RolesGuard(new Reflector()));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Journey is only accessible by SERVO', async () => {
    await request(app.getHttpServer())
      .get('/journey/me')
      .set('x-test-role', Role.SERVO)
      .expect(200);

    await request(app.getHttpServer()).get('/journey/me').set('x-test-role', Role.ADMIN).expect(403);
    await request(app.getHttpServer()).get('/journey/me').set('x-test-role', Role.PASTOR).expect(403);
    await request(app.getHttpServer()).get('/journey/me').set('x-test-role', Role.COORDENADOR).expect(403);
    await request(app.getHttpServer()).get('/journey/me').set('x-test-role', Role.SUPER_ADMIN).expect(403);
  });

  it('Pastoral resolve accepts PASTOR and blocks COORDENADOR', async () => {
    await request(app.getHttpServer())
      .patch('/pastoral-visits/pv-1/resolve')
      .set('x-test-role', Role.PASTOR)
      .send({ notes: 'ok' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/pastoral-visits/pv-1/resolve')
      .set('x-test-role', Role.COORDENADOR)
      .send({ notes: 'ok' })
      .expect(403);
  });

  it('Worship services write endpoints remain admin-only', async () => {
    await request(app.getHttpServer())
      .post('/worship-services')
      .set('x-test-role', Role.ADMIN)
      .send({ type: 'DOMINGO', title: 'Culto teste', serviceDate: '2026-04-01', startTime: '19:00' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/worship-services')
      .set('x-test-role', Role.PASTOR)
      .send({ type: 'DOMINGO', title: 'Culto teste', serviceDate: '2026-04-01', startTime: '19:00' })
      .expect(403);
  });
});
