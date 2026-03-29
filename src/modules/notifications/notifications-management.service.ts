import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationTemplateStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { ListNotificationManagementLogsQueryDto } from './dto/list-notification-management-logs-query.dto';
import { NotificationManagementChannel } from './dto/notification-management-channel.dto';
import { SendNotificationManagementTestDto } from './dto/send-notification-management-test.dto';
import { UpdateNotificationManagementPreferencesDto } from './dto/update-notification-management-preferences.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationTemplatesService } from './notification-templates.service';
import { WhatsappService } from './whatsapp/whatsapp.service';

@Injectable()
export class NotificationsManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantIntegrity: TenantIntegrityService,
    private readonly notificationSettingsService: NotificationSettingsService,
    private readonly notificationTemplatesService: NotificationTemplatesService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async listChannels() {
    const [globalSetting, operationalSetting] = await Promise.all([
      this.notificationSettingsService.getWhatsappGlobalSetting(),
      this.notificationSettingsService.getWhatsappOperationalSetting(),
    ]);

    const whatsappEnabled = globalSetting.enabled && operationalSetting.enabled;
    const updatedAt =
      operationalSetting.updatedAt ?? globalSetting.updatedAt ?? new Date().toISOString();

    return {
      channels: {
        APP: true,
        EMAIL: false,
        WHATSAPP: whatsappEnabled,
      },
      support: {
        APP: true,
        EMAIL: false,
        WHATSAPP: true,
      },
      updatedAt,
    };
  }

  async setChannelEnabled(channel: NotificationManagementChannel, enabled: boolean) {
    if (channel === NotificationManagementChannel.WHATSAPP) {
      return this.notificationSettingsService.updateWhatsappOperationalSetting(enabled).then((setting) => ({
        channels: {
          APP: true,
          EMAIL: false,
          WHATSAPP: setting.enabled,
        },
        support: {
          APP: true,
          EMAIL: false,
          WHATSAPP: true,
        },
        updatedAt: setting.updatedAt,
      }));
    }

    if (channel === NotificationManagementChannel.APP) {
      throw new BadRequestException('APP channel is always enabled and cannot be toggled.');
    }

    throw new NotImplementedException('EMAIL channel is not supported by backend.');
  }

  async getUserPreferences(userId: string, actor: JwtPayload) {
    this.assertCanReadPreferences(actor, userId);
    await this.assertTargetUserTenant(userId, actor);

    const rows = await this.prisma.notificationPreference.findMany({
      where: {
        userId,
        channel: { in: [NotificationChannel.IN_APP, NotificationChannel.WHATSAPP] },
      },
      select: {
        channel: true,
        enabled: true,
        updatedAt: true,
      },
    });

    const app = rows.find((row) => row.channel === NotificationChannel.IN_APP);
    const whatsapp = rows.find((row) => row.channel === NotificationChannel.WHATSAPP);
    const updatedAt =
      whatsapp?.updatedAt?.toISOString() ??
      app?.updatedAt?.toISOString() ??
      new Date().toISOString();

    return {
      userId,
      channels: {
        APP: app?.enabled ?? true,
        EMAIL: false,
        WHATSAPP: whatsapp?.enabled ?? true,
      },
      receiveDigest: true,
      receiveOnlyOwnSector: false,
      updatedAt,
    };
  }

  async updateUserPreferences(
    userId: string,
    dto: UpdateNotificationManagementPreferencesDto,
    actor: JwtPayload,
  ) {
    this.assertCanWritePreferences(actor, userId);
    await this.assertTargetUserTenant(userId, actor);

    if (dto.channels?.EMAIL !== undefined) {
      throw new NotImplementedException('EMAIL channel is not supported by backend.');
    }

    const updates = [];
    if (dto.channels?.APP !== undefined) {
      updates.push(
        this.prisma.notificationPreference.upsert({
          where: {
            userId_channel: {
              userId,
              channel: NotificationChannel.IN_APP,
            },
          },
          create: {
            userId,
            channel: NotificationChannel.IN_APP,
            enabled: dto.channels.APP,
          },
          update: {
            enabled: dto.channels.APP,
          },
        }),
      );
    }

    if (dto.channels?.WHATSAPP !== undefined) {
      updates.push(
        this.prisma.notificationPreference.upsert({
          where: {
            userId_channel: {
              userId,
              channel: NotificationChannel.WHATSAPP,
            },
          },
          create: {
            userId,
            channel: NotificationChannel.WHATSAPP,
            enabled: dto.channels.WHATSAPP,
          },
          update: {
            enabled: dto.channels.WHATSAPP,
          },
        }),
      );
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(updates);
    }

    return this.getUserPreferences(userId, actor);
  }

  async listTemplates() {
    const rows = await this.notificationTemplatesService.findAll({});
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      event: row.eventKey,
      channel: this.fromDbChannel(row.channel),
      content: row.content,
      isActive: row.status === NotificationTemplateStatus.ACTIVE,
      updatedAt: row.updatedAt,
    }));
  }

  async createTemplate(payload: {
    name: string;
    event: string;
    channel: NotificationManagementChannel;
    content: string;
  }) {
    const dto: CreateNotificationTemplateDto = {
      name: payload.name,
      eventKey: payload.event,
      channel: this.toDbChannel(payload.channel),
      content: payload.content,
    };
    const row = await this.notificationTemplatesService.create(dto);
    return {
      id: row.id,
      name: row.name,
      event: row.eventKey,
      channel: this.fromDbChannel(row.channel),
      content: row.content,
      isActive: row.status === NotificationTemplateStatus.ACTIVE,
      updatedAt: row.updatedAt,
    };
  }

  async updateTemplate(
    id: string,
    payload: {
      name?: string;
      event?: string;
      channel?: NotificationManagementChannel;
      content?: string;
    },
  ) {
    if (payload.channel) {
      const current = await this.notificationTemplatesService.findOne(id);
      const targetChannel = this.toDbChannel(payload.channel);
      if (current.channel !== targetChannel) {
        throw new BadRequestException('Changing template channel is not supported.');
      }
    }

    const dto: UpdateNotificationTemplateDto = {
      name: payload.name,
      eventKey: payload.event,
      content: payload.content,
    };
    const row = await this.notificationTemplatesService.update(id, dto);
    return {
      id: row.id,
      name: row.name,
      event: row.eventKey,
      channel: this.fromDbChannel(row.channel),
      content: row.content,
      isActive: row.status === NotificationTemplateStatus.ACTIVE,
      updatedAt: row.updatedAt,
    };
  }

  async setTemplateActive(id: string, isActive: boolean) {
    const row = await this.notificationTemplatesService.activate(id, isActive);
    return {
      id: row.id,
      name: row.name,
      event: row.eventKey,
      channel: this.fromDbChannel(row.channel),
      content: row.content,
      isActive: row.status === NotificationTemplateStatus.ACTIVE,
      updatedAt: row.updatedAt,
    };
  }

  async listDeliveryLogs(query: ListNotificationManagementLogsQueryDto) {
    if (query.channel && query.channel !== NotificationManagementChannel.WHATSAPP) {
      if (query.channel === NotificationManagementChannel.EMAIL) {
        throw new NotImplementedException('EMAIL logs are not supported by backend.');
      }
      return { data: [], page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 0 };
    }

    const logQuery = {
      page: query.page,
      limit: query.limit,
      status:
        query.status === 'SENT'
          ? NotificationDeliveryStatus.SUCCESS
          : query.status === 'FAILED'
            ? NotificationDeliveryStatus.FAILED
            : undefined,
      eventKey: query.event,
      channel: NotificationChannel.WHATSAPP,
    };

    const result = await this.whatsappService.listLogs(logQuery);
    return {
      ...result,
      data: result.data.map((row) => {
        const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
        return {
          id: row.id,
          event: row.eventKey,
          channel: NotificationManagementChannel.WHATSAPP,
          status: row.status === NotificationDeliveryStatus.FAILED ? 'FAILED' : 'SENT',
          recipient: row.recipientPhone,
          templateName: row.templateId ?? undefined,
          messagePreview:
            typeof payload.message === 'string'
              ? payload.message
              : typeof payload.title === 'string'
                ? payload.title
                : '',
          sentAt: row.sentAt ?? row.createdAt,
          errorMessage: row.error ?? undefined,
          isTest: row.eventKey === 'WHATSAPP_TEST',
        };
      }),
    };
  }

  async sendTestMessage(dto: SendNotificationManagementTestDto) {
    if (dto.channel !== NotificationManagementChannel.WHATSAPP) {
      throw new NotImplementedException(`${dto.channel} test-send is not supported by backend.`);
    }

    const result = await this.whatsappService.sendTest({
      phone: dto.phoneDigits,
      message: dto.message,
    });

    return {
      ok: result.success,
      log: {
        id: result.logId,
        event: dto.event ?? 'WHATSAPP_TEST',
        channel: NotificationManagementChannel.WHATSAPP,
        status: result.success ? 'SENT' : 'FAILED',
        recipient: dto.phoneDigits,
        messagePreview: dto.message,
        sentAt: new Date().toISOString(),
        errorMessage: result.error ?? undefined,
        isTest: true,
      },
    };
  }

  async getSettingsSummary() {
    const [global, operational] = await Promise.all([
      this.notificationSettingsService.getWhatsappGlobalSetting(),
      this.notificationSettingsService.getWhatsappOperationalSetting(),
    ]);

    return {
      whatsappGlobal: global,
      whatsappOperational: operational,
    };
  }

  private toDbChannel(channel: NotificationManagementChannel) {
    if (channel === NotificationManagementChannel.APP) {
      return NotificationChannel.IN_APP;
    }
    if (channel === NotificationManagementChannel.WHATSAPP) {
      return NotificationChannel.WHATSAPP;
    }
    throw new NotImplementedException('EMAIL channel is not supported by backend.');
  }

  private fromDbChannel(channel: NotificationChannel): NotificationManagementChannel {
    return channel === NotificationChannel.IN_APP
      ? NotificationManagementChannel.APP
      : NotificationManagementChannel.WHATSAPP;
  }

  private isAdmin(role: Role) {
    return role === Role.SUPER_ADMIN || role === Role.ADMIN;
  }

  private assertCanReadPreferences(actor: JwtPayload, userId: string) {
    if (this.isAdmin(actor.role)) {
      return;
    }
    if (actor.sub !== userId) {
      throw new ForbiddenException('You can only read your own notification preferences.');
    }
  }

  private assertCanWritePreferences(actor: JwtPayload, userId: string) {
    if (this.isAdmin(actor.role)) {
      return;
    }
    if (actor.sub !== userId) {
      throw new ForbiddenException('You can only update your own notification preferences.');
    }
  }

  private async assertTargetUserTenant(userId: string, actor: JwtPayload) {
    if (!actor.churchId) {
      return;
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, churchId: true },
    });

    if (!target) {
      throw new BadRequestException('Target user not found');
    }

    this.tenantIntegrity.assertSameChurch(actor.churchId, target.churchId, 'User');
  }
}

