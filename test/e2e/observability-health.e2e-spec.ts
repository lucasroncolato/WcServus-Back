import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { HealthController } from 'src/health.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('E2E observability health endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
        {
          provide: AppMetricsService,
          useValue: {
            getSnapshot: jest.fn(() => ({ routes: { slowest: [] }, jobs: [], cache: {}, db: {}, system: {} })),
            getRoutesSnapshot: jest.fn(() => ({ slowest: [], mostUsed: [] })),
            getJobsSnapshot: jest.fn(() => []),
            getCacheSnapshot: jest.fn(() => ({ hits: 0, misses: 0, hitRate: 0 })),
            getDbSnapshot: jest.fn(() => ({ operations: [], slowQueries: [] })),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, string | string[] | undefined>; user?: unknown }, _res: unknown, next: () => void) => {
      const role = String(req.headers['x-test-role'] ?? Role.SERVO) as Role;
      req.user = {
        sub: 'user-test',
        email: 'test@local',
        role,
        churchId: 'church-a',
      };
      next();
    });
    app.useGlobalGuards(new RolesGuard(new Reflector()));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows public health probes', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/health/db').expect(200);
  });

  it('restricts metrics endpoints to ADMIN and SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/health/metrics')
      .set('x-test-role', Role.ADMIN)
      .expect(200);

    await request(app.getHttpServer())
      .get('/health/metrics/routes')
      .set('x-test-role', Role.SUPER_ADMIN)
      .expect(200);

    await request(app.getHttpServer())
      .get('/health/metrics/jobs')
      .set('x-test-role', Role.ADMIN)
      .expect(200);

    await request(app.getHttpServer())
      .get('/health/metrics/cache')
      .set('x-test-role', Role.ADMIN)
      .expect(200);

    await request(app.getHttpServer())
      .get('/health/metrics/db')
      .set('x-test-role', Role.ADMIN)
      .expect(200);

    await request(app.getHttpServer())
      .get('/health/metrics')
      .set('x-test-role', Role.SERVO)
      .expect(403);
  });
});
