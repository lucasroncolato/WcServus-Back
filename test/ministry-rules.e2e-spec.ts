import { ForbiddenException, INestApplication, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { ServantsController } from 'src/modules/servants/servants.controller';
import { ServantsService } from 'src/modules/servants/servants.service';
import { SchedulesController } from 'src/modules/schedules/schedules.controller';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { MinistriesController } from 'src/modules/ministries/ministries.controller';
import { MinistriesService } from 'src/modules/ministries/ministries.service';
import { NotificationsController } from 'src/modules/notifications/notifications.controller';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { AttendancesController } from 'src/modules/attendances/attendances.controller';
import { AttendancesService } from 'src/modules/attendances/attendances.service';
import { WorshipServicesController } from 'src/modules/worship-services/worship-services.controller';
import { WorshipServicesService } from 'src/modules/worship-services/worship-services.service';
import { TeamsController } from 'src/modules/teams/teams.controller';
import { TeamsService } from 'src/modules/teams/teams.service';
import { DashboardController } from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';

const servantsServiceMock = {
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
  completeTraining: jest.fn(),
  updateApproval: jest.fn(),
};

const schedulesServiceMock = {
  findAll: jest.fn(),
  listEligibleServants: jest.fn(),
  mobileContext: jest.fn(),
  operationModes: jest.fn(),
  periodSummary: jest.fn(),
  servicesOperationalStatus: jest.fn(),
  serviceBoard: jest.fn(),
  createSlot: jest.fn(),
  assignSlot: jest.fn(),
  contextualSwapSlot: jest.fn(),
  fillSlot: jest.fn(),
  autoGenerateExplained: jest.fn(),
  history: jest.fn(),
  create: jest.fn(),
  generateMonth: jest.fn(),
  generatePeriod: jest.fn(),
  generateService: jest.fn(),
  generateServices: jest.fn(),
  generateYear: jest.fn(),
  swap: jest.fn(),
  update: jest.fn(),
  duplicate: jest.fn(),
  swapHistory: jest.fn(),
};

const ministriesServiceMock = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  listServants: jest.fn(),
  listResponsibilities: jest.fn(),
  createResponsibility: jest.fn(),
  updateResponsibility: jest.fn(),
};

const notificationsServiceMock = {
  findAll: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
};

const attendancesServiceMock = {
  findAll: jest.fn(),
  checkIn: jest.fn(),
  batch: jest.fn(),
  update: jest.fn(),
};

const worshipServicesServiceMock = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const teamsServiceMock = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  members: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
  updateLeader: jest.fn(),
};

const dashboardServiceMock = {
  summary: jest.fn(),
  alerts: jest.fn(),
};

describe('Ministerial rules e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        ServantsController,
        SchedulesController,
        MinistriesController,
        NotificationsController,
        AttendancesController,
        WorshipServicesController,
        TeamsController,
        DashboardController,
      ],
      providers: [
        { provide: ServantsService, useValue: servantsServiceMock },
        { provide: SchedulesService, useValue: schedulesServiceMock },
        { provide: MinistriesService, useValue: ministriesServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: AttendancesService, useValue: attendancesServiceMock },
        { provide: WorshipServicesService, useValue: worshipServicesServiceMock },
        { provide: TeamsService, useValue: teamsServiceMock },
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: 'admin-1', role: 'ADMIN', email: 'admin@church.local' };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. cria servo', async () => {
    servantsServiceMock.createWithUser.mockResolvedValue({ id: 's1' });
    await request(app.getHttpServer()).post('/servants/with-user').send({ name: 'Servo', user: { email: 'servo@x.com' }, ministryIds: ['m1'] }).expect(201);
  });

  it('2. associa ministerio ao servo', async () => {
    servantsServiceMock.update.mockResolvedValue({ id: 's1', ministryIds: ['m1', 'm2'] });
    await request(app.getHttpServer()).patch('/servants/s1').send({ ministryIds: ['m1', 'm2'], mainMinistryId: 'm1' }).expect(200);
  });

  it('3. conclui treinamento por ministerio', async () => {
    servantsServiceMock.completeTraining.mockResolvedValue({ id: 's1', trainingStatus: 'COMPLETED' });
    await request(app.getHttpServer()).patch('/servants/s1/training/complete').send({ ministryId: 'm1', notes: 'ok' }).expect(200);
  });

  it('4. pendencia pastoral bloqueia escala', async () => {
    schedulesServiceMock.assignSlot.mockRejectedValue(new UnprocessableEntityException({ reasons: ['PASTORAL_PENDING'] }));
    await request(app.getHttpServer()).patch('/schedules/slots/slot-1/assign').send({ servantId: 's1' }).expect(422);
  });

  it('5. bloqueia servo em dois ministerios no mesmo culto', async () => {
    schedulesServiceMock.assignSlot.mockRejectedValue(new UnprocessableEntityException({ reasons: ['ALREADY_SCHEDULED_IN_OTHER_MINISTRY'] }));
    await request(app.getHttpServer()).patch('/schedules/slots/slot-1/assign').send({ servantId: 's1' }).expect(422);
  });

  it('6. assign', async () => {
    schedulesServiceMock.assignSlot.mockResolvedValue({ id: 'slot-1', status: 'ASSIGNED' });
    await request(app.getHttpServer()).patch('/schedules/slots/slot-1/assign').send({ servantId: 's1', reason: 'escala normal' }).expect(200);
  });

  it('7. fill', async () => {
    schedulesServiceMock.fillSlot.mockResolvedValue({ id: 'slot-1', status: 'SWAPPED' });
    await request(app.getHttpServer()).post('/schedules/slots/slot-1/fill').send({ substituteServantId: 's2', context: 'FILL_OPEN_SLOT' }).expect(201);
  });

  it('8. swap', async () => {
    schedulesServiceMock.contextualSwapSlot.mockResolvedValue({ id: 'slot-1', status: 'SWAPPED' });
    await request(app.getHttpServer()).post('/schedules/slots/slot-1/swap').send({ substituteServantId: 's3', context: 'REPLACEMENT' }).expect(201);
  });

  it('9. auto generate', async () => {
    schedulesServiceMock.autoGenerateExplained.mockResolvedValue({ items: [{ action: 'CREATED' }] });
    await request(app.getHttpServer()).post('/schedules/auto-generate-explained').send({ serviceId: 'ws1', ministryId: 'm1' }).expect(201);
  });

  it('10. elegibilidade completa', async () => {
    schedulesServiceMock.listEligibleServants.mockResolvedValue([{ servantId: 's1', eligible: false, reasons: ['MINISTRY_TRAINING_NOT_COMPLETED'] }]);
    await request(app.getHttpServer()).get('/schedules/eligible-servants?serviceId=ws1&ministryId=m1&includeReasons=true').expect(200);
  });

  it('11. escopo por ministerio', async () => {
    schedulesServiceMock.serviceBoard.mockRejectedValue(new ForbiddenException('out of scope'));
    await request(app.getHttpServer()).get('/schedules/services/ws1/board?ministryId=m999').expect(403);
  });

  it('12. permissoes por perfil', async () => {
    ministriesServiceMock.create.mockRejectedValue(new ForbiddenException('forbidden'));
    await request(app.getHttpServer()).post('/ministries').send({ name: 'Intercessao' }).expect(403);
  });

  it('13. notificacoes', async () => {
    notificationsServiceMock.findAll.mockResolvedValue({ data: [{ id: 'n1' }] });
    await request(app.getHttpServer()).get('/notifications').expect(200);
  });

  it('14. presenca', async () => {
    attendancesServiceMock.checkIn.mockResolvedValue({ id: 'a1', status: 'PRESENTE' });
    await request(app.getHttpServer()).post('/attendances/check-in').send({ serviceId: 'ws1', servantId: 's1', status: 'PRESENTE' }).expect(201);
  });

  it('15. cultos', async () => {
    worshipServicesServiceMock.create.mockResolvedValue({ id: 'ws1', status: 'PLANEJADO' });
    await request(app.getHttpServer()).post('/worship-services').send({ title: 'Culto Domingo', type: 'DOMINGO', serviceDate: '2026-04-05', startTime: '19:00' }).expect(201);
  });

  it('16. teams', async () => {
    teamsServiceMock.create.mockResolvedValue({ id: 't1' });
    await request(app.getHttpServer()).post('/teams').send({ name: 'Banda', ministryId: 'm1' }).expect(201);
  });

  it('17. dashboard', async () => {
    dashboardServiceMock.summary.mockResolvedValue({ totals: { services: 8 } });
    await request(app.getHttpServer()).get('/dashboard/summary').expect(200);
  });
});
