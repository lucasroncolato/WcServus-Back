import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TimelineMeController } from 'src/modules/timeline/timeline-me.controller';
import { TimelineService } from 'src/modules/timeline/timeline.service';

describe('E2E timeline me RBAC', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const timelineServiceMock = {
      listOwn: jest.fn(() => ({ data: [], pageInfo: { hasMore: false, nextCursor: null } })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TimelineMeController],
      providers: [{ provide: TimelineService, useValue: timelineServiceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, string | string[] | undefined>; user?: unknown }, _res: unknown, next: () => void) => {
      req.user = {
        sub: 'user-test',
        email: 'test@local',
        role: String(req.headers['x-test-role'] ?? Role.SERVO) as Role,
        churchId: 'church-a',
        servantId: 'servant-a',
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

  it('allows SERVO and blocks admin roles on /timeline/me', async () => {
    await request(app.getHttpServer()).get('/timeline/me').set('x-test-role', Role.SERVO).expect(200);
    await request(app.getHttpServer()).get('/timeline/me').set('x-test-role', Role.ADMIN).expect(403);
    await request(app.getHttpServer()).get('/timeline/me').set('x-test-role', Role.PASTOR).expect(403);
    await request(app.getHttpServer()).get('/timeline/me').set('x-test-role', Role.COORDENADOR).expect(403);
    await request(app.getHttpServer()).get('/timeline/me').set('x-test-role', Role.SUPER_ADMIN).expect(403);
  });
});

