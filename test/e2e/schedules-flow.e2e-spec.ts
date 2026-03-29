import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AttendanceStatus, Role, ScheduleResponseStatus, ScheduleSlotStatus } from '@prisma/client';
import request = require('supertest');
import { AttendancesController } from 'src/modules/attendances/attendances.controller';
import { AttendancesService } from 'src/modules/attendances/attendances.service';
import { DashboardController } from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { GamificationController } from 'src/modules/gamification/gamification.controller';
import { GamificationService } from 'src/modules/gamification/gamification.service';
import { MeController } from 'src/modules/me/me.controller';
import { MeService } from 'src/modules/me/me.service';
import { MinistriesController } from 'src/modules/ministries/ministries.controller';
import { MinistriesService } from 'src/modules/ministries/ministries.service';
import { SchedulesController } from 'src/modules/schedules/schedules.controller';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { WorshipServicesController } from 'src/modules/worship-services/worship-services.controller';
import { WorshipServicesService } from 'src/modules/worship-services/worship-services.service';

type Actor = { sub: string; role: Role; churchId: string; servantId?: string };

describe('E2E schedules full flow', () => {
  const state = {
    ministryId: '',
    responsibilityId: '',
    serviceId: '',
    slotA: '',
    slotB: '',
    servants: [
      { id: 'servant-1', churchId: 'church-a', name: 'Servo 1' },
      { id: 'servant-2', churchId: 'church-a', name: 'Servo 2' },
    ],
    slots: [] as Array<{ id: string; serviceId: string; assignedServantId?: string; status: ScheduleSlotStatus }>,
    points: new Map<string, number>([['servant-1', 0], ['servant-2', 0]]),
    attendances: 0,
  };
  let seq = 1;
  const id = (prefix: string): string => `${prefix}-${seq++}`;

  async function createApp(actor: Actor): Promise<INestApplication> {
    const ministriesServiceMock = {
      create: jest.fn((dto: { name: string }) => {
        state.ministryId = id('ministry');
        return { id: state.ministryId, name: dto.name, churchId: actor.churchId };
      }),
      createResponsibility: jest.fn((_ministryId: string, dto: { title: string }) => {
        state.responsibilityId = id('resp');
        return { id: state.responsibilityId, title: dto.title, ministryId: state.ministryId };
      }),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      listServants: jest.fn(),
      listResponsibilities: jest.fn(),
      updateResponsibility: jest.fn(),
    };
    const worshipServicesServiceMock = {
      create: jest.fn((dto: { title: string; serviceDate: string }) => {
        state.serviceId = id('service');
        return { id: state.serviceId, title: dto.title, serviceDate: dto.serviceDate };
      }),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    const schedulesServiceMock = {
      createSlot: jest.fn((_serviceId: string) => {
        const slotId = id('slot');
        state.slots.push({ id: slotId, serviceId: state.serviceId, status: ScheduleSlotStatus.OPEN });
        if (!state.slotA) state.slotA = slotId;
        else state.slotB = slotId;
        return { id: slotId, status: ScheduleSlotStatus.OPEN };
      }),
      assignSlot: jest.fn((slotId: string, dto: { servantId: string }) => {
        const slot = state.slots.find((s) => s.id === slotId);
        if (!slot) throw new Error('slot not found');
        const conflict = state.slots.find(
          (s) => s.serviceId === slot.serviceId && s.assignedServantId === dto.servantId && s.id !== slot.id,
        );
        if (conflict) throw new ForbiddenException('Schedule conflict for servant');
        slot.assignedServantId = dto.servantId;
        slot.status = ScheduleSlotStatus.ASSIGNED;
        return { id: slot.id, assignedServantId: dto.servantId, status: slot.status };
      }),
      serviceBoard: jest.fn((_serviceId: string) => ({ slots: state.slots })),
      findAll: jest.fn(),
      listEligibleServants: jest.fn(),
      mobileContext: jest.fn(),
      operationModes: jest.fn(),
      periodSummary: jest.fn(),
      servicesOperationalStatus: jest.fn(),
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
      listVersions: jest.fn(),
      createDraftVersion: jest.fn(),
      publishVersion: jest.fn(),
    };
    const meServiceMock = {
      respondMySchedule: jest.fn((_user: Actor, assignmentId: string, dto: { responseStatus: ScheduleResponseStatus }) => {
        const slot = state.slots.find((s) => s.id === assignmentId);
        if (!slot || slot.assignedServantId !== actor.servantId) throw new ForbiddenException('Not owner');
        slot.status =
          dto.responseStatus === ScheduleResponseStatus.CONFIRMED
            ? ScheduleSlotStatus.CONFIRMED
            : ScheduleSlotStatus.DECLINED;
        return { id: slot.id, status: slot.status };
      }),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      getMyServant: jest.fn(),
      updateMyServant: jest.fn(),
      listMySchedules: jest.fn(),
      listMyAttendance: jest.fn(),
      listMyNotifications: jest.fn(),
      readMyNotification: jest.fn(),
      getMyAvailability: jest.fn(),
      putMyAvailability: jest.fn(),
    };
    const attendancesServiceMock = {
      checkIn: jest.fn((dto: { servantId: string; status: AttendanceStatus }) => {
        state.attendances += 1;
        if (dto.status === AttendanceStatus.PRESENTE) {
          state.points.set(dto.servantId, (state.points.get(dto.servantId) ?? 0) + 10);
        }
        return { id: id('att'), ...dto };
      }),
      findAll: jest.fn(),
      batch: jest.fn(),
      update: jest.fn(),
    };
    const gamificationServiceMock = {
      ranking: jest.fn(() =>
        Array.from(state.points.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([servantId, points], index) => ({ servantId, points, position: index + 1 })),
      ),
      dashboardAdmin: jest.fn(() => ({ totalServants: state.servants.length, attendances: state.attendances })),
      dashboardPastor: jest.fn(),
      dashboardCoordinator: jest.fn(),
      dashboardServo: jest.fn(),
      getServantProgress: jest.fn(),
      dashboard: jest.fn(),
      rankingMonthly: jest.fn(),
      rankingYearly: jest.fn(),
      rankingByMetric: jest.fn(),
      awardPoints: jest.fn(),
      recomputeServantProfile: jest.fn(),
      recomputeAllProfiles: jest.fn(),
      myGrowthTracks: jest.fn(),
      listAchievementsCatalog: jest.fn(),
      syncDefaultAchievementsCatalog: jest.fn(),
      listGrowthTracks: jest.fn(),
      getGrowthTrack: jest.fn(),
      createGrowthTrack: jest.fn(),
      addGrowthTrackStep: jest.fn(),
      assignServantToTrack: jest.fn(),
      updateGrowthTrackProgress: jest.fn(),
      approveGrowthTrackStep: jest.fn(),
      analyticsChurch: jest.fn(),
      analyticsMinistry: jest.fn(),
      analyticsServant: jest.fn(),
      analyticsMe: jest.fn(),
      buildMonthlyStats: jest.fn(),
    };
    const dashboardServiceMock = {
      summary: jest.fn(() => ({ totals: { servants: state.servants.length, attendances: state.attendances } })),
      alerts: jest.fn(() => []),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [
        MinistriesController,
        WorshipServicesController,
        SchedulesController,
        MeController,
        AttendancesController,
        GamificationController,
        DashboardController,
      ],
      providers: [
        { provide: MinistriesService, useValue: ministriesServiceMock },
        { provide: WorshipServicesService, useValue: worshipServicesServiceMock },
        { provide: SchedulesService, useValue: schedulesServiceMock },
        { provide: MeService, useValue: meServiceMock },
        { provide: AttendancesService, useValue: attendancesServiceMock },
        { provide: GamificationService, useValue: gamificationServiceMock },
        { provide: DashboardService, useValue: dashboardServiceMock },
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

  it('runs schedule lifecycle with presence, ranking and dashboard reflection', async () => {
    const admin = await createApp({ sub: 'admin-a', role: Role.ADMIN, churchId: 'church-a' });
    const coordinator = await createApp({ sub: 'coord-a', role: Role.COORDENADOR, churchId: 'church-a' });
    const servo1 = await createApp({ sub: 'user-s1', role: Role.SERVO, churchId: 'church-a', servantId: 'servant-1' });

    await request(admin.getHttpServer()).post('/ministries').send({ name: 'Louvor' }).expect(201);
    await request(admin.getHttpServer())
      .post(`/ministries/${state.ministryId}/responsibilities`)
      .send({ title: 'Vocal' })
      .expect(201);
    await request(admin.getHttpServer())
      .post('/worship-services')
      .send({ type: 'DOMINGO', title: 'Culto Domingo', serviceDate: '2026-04-05T09:00:00.000Z', startTime: '09:00' })
      .expect(201);

    await request(coordinator.getHttpServer())
      .post(`/schedules/services/${state.serviceId}/slots`)
      .send({ ministryId: state.ministryId, responsibilityId: state.responsibilityId, functionName: 'Vocal principal' })
      .expect(201);
    await request(coordinator.getHttpServer())
      .post(`/schedules/services/${state.serviceId}/slots`)
      .send({ ministryId: state.ministryId, responsibilityId: state.responsibilityId, functionName: 'Vocal apoio' })
      .expect(201);

    await request(coordinator.getHttpServer())
      .patch(`/schedules/slots/${state.slotA}/assign`)
      .send({ servantId: 'servant-1' })
      .expect(200);
    await request(servo1.getHttpServer())
      .patch(`/me/schedule-assignments/${state.slotA}/respond`)
      .send({ responseStatus: 'CONFIRMED' })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe(ScheduleSlotStatus.CONFIRMED));

    await request(coordinator.getHttpServer())
      .patch(`/schedules/slots/${state.slotB}/assign`)
      .send({ servantId: 'servant-1' })
      .expect(403);

    await request(coordinator.getHttpServer())
      .post('/attendances/check-in')
      .send({ serviceId: state.serviceId, servantId: 'servant-1', status: 'PRESENTE' })
      .expect(201);

    await request(admin.getHttpServer())
      .get('/gamification/ranking')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0]).toEqual(expect.objectContaining({ servantId: 'servant-1', points: 10, position: 1 }));
      });

    await request(admin.getHttpServer())
      .get('/dashboard/summary')
      .expect(200)
      .expect(({ body }) => {
        expect(body.totals).toEqual(expect.objectContaining({ servants: 2, attendances: 1 }));
      });

    await Promise.all([admin.close(), coordinator.close(), servo1.close()]);
  });
});
