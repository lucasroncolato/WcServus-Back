import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { SchedulesController } from 'src/modules/schedules/schedules.controller';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { ReportsController } from 'src/modules/reports/reports.controller';
import { ReportsService } from 'src/modules/reports/reports.service';

async function createControllerApp(controller: any, providerToken: any, providerValue: any) {
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [
      {
        provide: providerToken,
        useValue: providerValue,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req: any, _res: any, next: () => void) => {
    req.user = {
      sub: 'user-1',
      email: 'admin@church.local',
      role: 'ADMIN',
      servantId: 'servant-1',
      churchId: 'church-1',
    };
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
}

describe('Enterprise phase 2 contracts', () => {
  let apps: INestApplication[] = [];

  afterEach(async () => {
    for (const app of apps) {
      await app.close();
    }
    apps = [];
  });

  it('schedules versioning endpoints contract', async () => {
    const schedulesServiceMock = {
      listVersions: jest.fn().mockResolvedValue([
        {
          id: 'v1',
          worshipServiceId: 'svc-1',
          versionNumber: 1,
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
        },
      ]),
      createDraftVersion: jest.fn().mockResolvedValue({
        id: 'v2',
        worshipServiceId: 'svc-1',
        versionNumber: 2,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      }),
      publishVersion: jest.fn().mockResolvedValue({
        id: 'v2',
        worshipServiceId: 'svc-1',
        versionNumber: 2,
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
      }),
    };

    const app = await createControllerApp(SchedulesController, SchedulesService, schedulesServiceMock);
    apps.push(app);

    await request(app.getHttpServer())
      .get('/schedules/services/svc-1/versions')
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBe(true);
        expect(body[0]).toEqual(
          expect.objectContaining({
            versionNumber: expect.any(Number),
            status: expect.any(String),
          }),
        );
      });

    await request(app.getHttpServer())
      .post('/schedules/services/svc-1/versions/draft')
      .send({})
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ status: 'DRAFT' }));
      });

    await request(app.getHttpServer())
      .post('/schedules/versions/v2/publish')
      .send({})
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ status: 'PUBLISHED' }));
      });
  });

  it('reports enterprise endpoints contract', async () => {
    const reportsServiceMock = {
      attendanceReport: jest.fn().mockResolvedValue([]),
      absencesReport: jest.fn().mockResolvedValue({}),
      pastoralVisitsReport: jest.fn().mockResolvedValue({}),
      talentsReport: jest.fn().mockResolvedValue({}),
      servantsActivityReport: jest.fn().mockResolvedValue({
        mostAssigned: [],
        mostAbsences: [],
        ministryLoadByServant: [],
      }),
      ministryLoadReport: jest.fn().mockResolvedValue([]),
      trainingPendingReport: jest.fn().mockResolvedValue({ totalPending: 0, records: [] }),
      pastoralPendenciesReport: jest.fn().mockResolvedValue({ openAlerts: 0, alerts: [] }),
      schedulesPeriodReport: jest.fn().mockResolvedValue({ totalSchedules: 0, swaps: 0 }),
    };

    const app = await createControllerApp(ReportsController, ReportsService, reportsServiceMock);
    apps.push(app);

    await request(app.getHttpServer()).get('/reports/servants/activity').expect(200);
    await request(app.getHttpServer()).get('/reports/ministry-load').expect(200);
    await request(app.getHttpServer()).get('/reports/training').expect(200);
    await request(app.getHttpServer()).get('/reports/pastoral').expect(200);
    await request(app.getHttpServer()).get('/reports/schedules').expect(200);
  });
});

