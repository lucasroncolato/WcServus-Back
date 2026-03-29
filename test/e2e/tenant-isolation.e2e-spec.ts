import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { NotificationsManagementController } from 'src/modules/notifications/notifications-management.controller';
import { NotificationsManagementService } from 'src/modules/notifications/notifications-management.service';
import { NotificationSettingsService } from 'src/modules/notifications/notification-settings.service';
import { NotificationTemplatesService } from 'src/modules/notifications/notification-templates.service';
import { WhatsappService } from 'src/modules/notifications/whatsapp/whatsapp.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('E2E tenant isolation on direct-id access', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
          if (id === 'user-a') return { id: 'user-a', churchId: 'church-a' };
          if (id === 'user-b') return { id: 'user-b', churchId: 'church-b' };
          return null;
        }),
      },
      notificationPreference: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => ({})),
      },
      $transaction: jest.fn(async (items: Array<Promise<unknown>>) => Promise.all(items)),
    } as unknown as PrismaService;

    const settingsMock = {
      getWhatsappGlobalSetting: jest.fn(async () => ({ enabled: true, updatedAt: new Date().toISOString() })),
      getWhatsappOperationalSetting: jest.fn(async () => ({ enabled: true, updatedAt: new Date().toISOString() })),
    } as unknown as NotificationSettingsService;

    const templatesMock = {
      findAll: jest.fn(async () => []),
      create: jest.fn(),
      update: jest.fn(),
      activate: jest.fn(),
      findOne: jest.fn(),
    } as unknown as NotificationTemplatesService;

    const whatsappMock = {
      listLogs: jest.fn(async () => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 })),
      sendTest: jest.fn(async () => ({ success: true, logId: '1' })),
    } as unknown as WhatsappService;

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsManagementController],
      providers: [
        NotificationsManagementService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationSettingsService, useValue: settingsMock },
        { provide: NotificationTemplatesService, useValue: templatesMock },
        { provide: WhatsappService, useValue: whatsappMock },
        TenantIntegrityService,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, string | string[] | undefined>; user?: unknown }, _res: unknown, next: () => void) => {
      req.user = {
        sub: String(req.headers['x-test-user'] ?? 'admin-a'),
        email: 'admin@local',
        role: String(req.headers['x-test-role'] ?? Role.ADMIN),
        churchId: String(req.headers['x-test-church'] ?? 'church-a'),
        servantId: null,
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

  it('blocks preference read by valid userId from another church', async () => {
    await request(app.getHttpServer())
      .get('/notifications-management/users/user-b/preferences')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .expect(403);
  });

  it('allows preference read when tenant matches', async () => {
    await request(app.getHttpServer())
      .get('/notifications-management/users/user-a/preferences')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .expect(200);
  });

  it('blocks preference update cross-church by manual id tampering', async () => {
    await request(app.getHttpServer())
      .patch('/notifications-management/users/user-b/preferences')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .send({ channels: { APP: true, WHATSAPP: true } })
      .expect(403);
  });
});
