import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { SchedulesController } from 'src/modules/schedules/schedules.controller';
import { SchedulesService } from 'src/modules/schedules/schedules.service';

describe('Schedules duplicate endpoint (e2e)', () => {
  let app: INestApplication;

  const schedulesServiceMock = {
    duplicate: jest.fn(),
    history: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    generateMonth: jest.fn(),
    generatePeriod: jest.fn(),
    generateService: jest.fn(),
    generateServices: jest.fn(),
    generateYear: jest.fn(),
    swap: jest.fn(),
    update: jest.fn(),
    swapHistory: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [
        {
          provide: SchedulesService,
          useValue: schedulesServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.user = {
        sub: 'user-1',
        email: 'admin@wcservus.com',
        role: 'ADMIN',
        servantId: null,
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /schedules/:id/duplicate -> 201', async () => {
    schedulesServiceMock.duplicate.mockResolvedValue({ id: 'schedule-new' });

    await request(app.getHttpServer())
      .post('/schedules/schedule-1/duplicate')
      .send({ worshipServiceId: 'service-2' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBe('schedule-new');
      });
  });

  it('POST /schedules/:id/duplicate -> 400 payload inválido', async () => {
    await request(app.getHttpServer())
      .post('/schedules/schedule-1/duplicate')
      .send({})
      .expect(400);
  });

  it('POST /schedules/:id/duplicate -> 403 fora de escopo', async () => {
    schedulesServiceMock.duplicate.mockRejectedValue(new ForbiddenException('Forbidden'));

    await request(app.getHttpServer())
      .post('/schedules/schedule-1/duplicate')
      .send({ worshipServiceId: 'service-2' })
      .expect(403);
  });

  it('POST /schedules/:id/duplicate -> 404', async () => {
    schedulesServiceMock.duplicate.mockRejectedValue(new NotFoundException('Source schedule not found'));

    await request(app.getHttpServer())
      .post('/schedules/schedule-1/duplicate')
      .send({ worshipServiceId: 'service-2' })
      .expect(404);
  });

  it('POST /schedules/:id/duplicate -> 409 conflito', async () => {
    schedulesServiceMock.duplicate.mockRejectedValue(new ConflictException('Conflict'));

    await request(app.getHttpServer())
      .post('/schedules/schedule-1/duplicate')
      .send({ worshipServiceId: 'service-2' })
      .expect(409);
  });

  it('GET /schedules/:id/history -> 200', async () => {
    schedulesServiceMock.history.mockResolvedValue([
      {
        id: 'evt-1',
        scheduleId: 'schedule-1',
        type: 'CREATED',
        message: 'Escala criada.',
        createdAt: '2026-03-23T12:00:00.000Z',
      },
    ]);

    await request(app.getHttpServer())
      .get('/schedules/schedule-1/history')
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].type).toBe('CREATED');
      });
  });

  it('GET /schedules/:id/history -> 404', async () => {
    schedulesServiceMock.history.mockRejectedValue(new NotFoundException('Schedule not found'));

    await request(app.getHttpServer()).get('/schedules/not-found/history').expect(404);
  });
});
