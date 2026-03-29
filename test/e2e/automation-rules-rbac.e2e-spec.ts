import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AutomationActionType, AutomationTriggerType, Role } from '@prisma/client';
import request = require('supertest');
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AutomationRulesController } from 'src/modules/automation-rules/automation-rules.controller';
import { AutomationRulesService } from 'src/modules/automation-rules/automation-rules.service';

describe('E2E automation rules RBAC', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const serviceMock = {
      list: jest.fn(() => []),
      create: jest.fn(() => ({ data: { id: 'rule-1' } })),
      update: jest.fn(() => ({ data: { id: 'rule-1' } })),
      remove: jest.fn(() => ({ message: 'ok' })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AutomationRulesController],
      providers: [{ provide: AutomationRulesService, useValue: serviceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, string | string[] | undefined>; user?: unknown }, _res: unknown, next: () => void) => {
      req.user = {
        sub: 'user-test',
        email: 'test@local',
        role: String(req.headers['x-test-role'] ?? Role.SERVO) as Role,
        churchId: 'church-a',
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

  it('allows ADMIN and SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/automation-rules')
      .set('x-test-role', Role.ADMIN)
      .expect(200);

    await request(app.getHttpServer())
      .post('/automation-rules')
      .set('x-test-role', Role.SUPER_ADMIN)
      .send({
        name: 'Marcar atrasadas',
        triggerType: AutomationTriggerType.TIME,
        actionType: AutomationActionType.TASK_MARK_OVERDUE,
      })
      .expect(201);
  });

  it('blocks PASTOR and SERVO', async () => {
    await request(app.getHttpServer())
      .get('/automation-rules')
      .set('x-test-role', Role.PASTOR)
      .expect(403);

    await request(app.getHttpServer())
      .post('/automation-rules')
      .set('x-test-role', Role.SERVO)
      .send({
        name: 'x',
        triggerType: AutomationTriggerType.TIME,
        actionType: AutomationActionType.TASK_MARK_OVERDUE,
      })
      .expect(403);
  });
});
