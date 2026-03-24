import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationQueueStatus,
  NotificationTemplateStatus,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListWhatsappLogsQueryDto } from '../dto/list-whatsapp-logs-query.dto';
import { SendWhatsappTestDto } from '../dto/send-whatsapp-test.dto';
import { NotificationSettingsService } from '../notification-settings.service';
import { WhatsappProviderService } from './whatsapp-provider.service';

type QueueFromNotificationInput = {
  userId: string;
  eventKey: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private workerTimer: NodeJS.Timeout | null = null;
  private workerInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: WhatsappProviderService,
    private readonly configService: ConfigService,
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {}

  onModuleInit() {
    const autoProcess = this.configService.get<string>('WHATSAPP_QUEUE_AUTO_PROCESS', 'true') !== 'false';
    if (!autoProcess) {
      return;
    }

    const pollMsRaw = Number(this.configService.get<string>('WHATSAPP_QUEUE_POLL_MS', '15000'));
    const pollMs = Number.isNaN(pollMsRaw) ? 15000 : Math.max(5000, pollMsRaw);
    this.workerTimer = setInterval(() => {
      void this.processQueue(20);
    }, pollMs);
  }

  onModuleDestroy() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  async sendTest(dto: SendWhatsappTestDto) {
    const provider = this.providerService.getProvider();
    const phone = this.normalizePhone(dto.phone);
    const message = dto.message.trim();

    const result = await provider.sendMessage({
      to: phone,
      message,
    });

    const log = await this.prisma.notificationLog.create({
      data: {
        eventKey: 'WHATSAPP_TEST',
        channel: NotificationChannel.WHATSAPP,
        provider: provider.provider,
        status: result.success ? NotificationDeliveryStatus.SUCCESS : NotificationDeliveryStatus.FAILED,
        userId: dto.userId,
        servantId: dto.servantId,
        recipientPhone: phone,
        payload: {
          message,
          origin: 'test_send',
        } as Prisma.InputJsonValue,
        providerMessageId: result.providerMessageId,
        error: result.error,
        sentAt: result.success ? new Date() : null,
      },
    });

    return {
      success: result.success,
      provider: provider.provider,
      providerMessageId: result.providerMessageId ?? null,
      error: result.error ?? null,
      logId: log.id,
    };
  }

  async enqueueFromNotification(input: QueueFromNotificationInput) {
    const globalEnabled = await this.notificationSettingsService.isWhatsappGloballyEnabled();
    if (!globalEnabled) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        servantId: true,
        servant: {
          select: {
            id: true,
            phone: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const preferenceEnabled = await this.isWhatsappEnabledForRecipient(user.id, user.servantId ?? user.servant?.id);
    if (!preferenceEnabled) {
      return null;
    }

    const rawPhone = user.phone ?? user.servant?.phone;
    if (!rawPhone) {
      return null;
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        eventKey: input.eventKey,
        channel: NotificationChannel.WHATSAPP,
        status: NotificationTemplateStatus.ACTIVE,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const context = this.buildContext({
      userName: user.name,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      metadata: input.metadata,
    });

    const renderedMessage = template
      ? this.renderTemplate(template.content, context)
      : `${input.title}\n${input.message}`;

    const selectedProvider = template?.provider ?? this.providerService.getProvider().provider;
    const queueItem = await this.prisma.notificationQueue.create({
      data: {
        eventKey: input.eventKey,
        channel: NotificationChannel.WHATSAPP,
        provider: selectedProvider,
        status: NotificationQueueStatus.PENDING,
        userId: user.id,
        servantId: user.servantId ?? user.servant?.id ?? null,
        recipientPhone: this.normalizePhone(rawPhone),
        recipientName: user.name,
        templateId: template?.id,
        renderedMessage,
        payload: {
          title: input.title,
          message: input.message,
          link: input.link ?? null,
          metadata: input.metadata ?? null,
        } as Prisma.InputJsonValue,
        nextRetryAt: new Date(),
        maxAttempts: this.resolveMaxAttempts(),
      },
    });

    return queueItem;
  }

  async processQueue(limit = 20) {
    if (this.workerInProgress) {
      return { processed: 0, success: 0, failed: 0 };
    }

    this.workerInProgress = true;
    try {
      const now = new Date();
      const pending = await this.prisma.notificationQueue.findMany({
        where: {
          channel: NotificationChannel.WHATSAPP,
          status: { in: [NotificationQueueStatus.PENDING, NotificationQueueStatus.RETRYING] },
          nextRetryAt: { lte: now },
        },
        orderBy: [{ createdAt: 'asc' }],
        take: limit,
      });

      let success = 0;
      let failed = 0;

      for (const item of pending) {
        const lock = await this.prisma.notificationQueue.updateMany({
          where: {
            id: item.id,
            status: { in: [NotificationQueueStatus.PENDING, NotificationQueueStatus.RETRYING] },
          },
          data: {
            status: NotificationQueueStatus.PROCESSING,
            lockedAt: new Date(),
          },
        });

        if (lock.count === 0) {
          continue;
        }

        const provider = this.providerService.getProviderByName(item.provider);
        const providerResult = await provider.sendMessage({
          to: item.recipientPhone,
          message: item.renderedMessage,
        });

        const nextAttempt = item.attemptCount + 1;
        if (providerResult.success) {
          success += 1;
          await this.prisma.$transaction([
            this.prisma.notificationQueue.update({
              where: { id: item.id },
              data: {
                status: NotificationQueueStatus.SENT,
                attemptCount: nextAttempt,
                processedAt: new Date(),
                lockedAt: null,
                providerMessageId: providerResult.providerMessageId ?? null,
                lastError: null,
              },
            }),
            this.prisma.notificationLog.create({
              data: {
                queueId: item.id,
                eventKey: item.eventKey,
                channel: NotificationChannel.WHATSAPP,
                provider: provider.provider,
                status: NotificationDeliveryStatus.SUCCESS,
                userId: item.userId,
                servantId: item.servantId,
                recipientPhone: item.recipientPhone,
                templateId: item.templateId,
                payload: item.payload as Prisma.InputJsonValue | undefined,
                providerMessageId: providerResult.providerMessageId ?? null,
                attempt: nextAttempt,
                sentAt: new Date(),
              },
            }),
          ]);

          continue;
        }

        failed += 1;
        const exhausted = nextAttempt >= item.maxAttempts;
        await this.prisma.$transaction([
          this.prisma.notificationQueue.update({
            where: { id: item.id },
            data: {
              status: exhausted ? NotificationQueueStatus.FAILED : NotificationQueueStatus.RETRYING,
              attemptCount: nextAttempt,
              nextRetryAt: exhausted ? item.nextRetryAt : this.calculateRetryDate(nextAttempt),
              lockedAt: null,
              processedAt: exhausted ? new Date() : null,
              lastError: providerResult.error ?? 'Unknown provider error',
            },
          }),
          this.prisma.notificationLog.create({
            data: {
              queueId: item.id,
              eventKey: item.eventKey,
              channel: NotificationChannel.WHATSAPP,
              provider: provider.provider,
              status: NotificationDeliveryStatus.FAILED,
              userId: item.userId,
              servantId: item.servantId,
              recipientPhone: item.recipientPhone,
              templateId: item.templateId,
              payload: item.payload as Prisma.InputJsonValue | undefined,
              providerMessageId: providerResult.providerMessageId ?? null,
              error: providerResult.error ?? 'Unknown provider error',
              attempt: nextAttempt,
            },
          }),
        ]);
      }

      return {
        processed: pending.length,
        success,
        failed,
      };
    } catch (error) {
      this.logger.error('Failed to process WhatsApp queue', error instanceof Error ? error.stack : undefined);
      return { processed: 0, success: 0, failed: 0 };
    } finally {
      this.workerInProgress = false;
    }
  }

  async listLogs(query: ListWhatsappLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.NotificationLogWhereInput = {
      channel: query.channel ?? NotificationChannel.WHATSAPP,
      ...(query.status ? { status: query.status } : {}),
      ...(query.eventKey ? { eventKey: query.eventKey } : {}),
      ...((query.dateFrom || query.dateTo)
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return {
      data: items,
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private async isWhatsappEnabledForRecipient(userId: string | null, servantId?: string | null) {
    const where: Prisma.NotificationPreferenceWhereInput = {
      channel: NotificationChannel.WHATSAPP,
      OR: [
        ...(userId ? [{ userId }] : []),
        ...(servantId ? [{ servantId }] : []),
      ],
    };

    if (!where.OR?.length) {
      return true;
    }

    const preferences = await this.prisma.notificationPreference.findMany({ where });
    if (preferences.length === 0) {
      return true;
    }

    return preferences.every((item) => item.enabled);
  }

  private buildContext(input: {
    userName?: string;
    title: string;
    message: string;
    link?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return {
      userName: input.userName ?? '',
      title: input.title,
      message: input.message,
      link: input.link ?? '',
      ...(input.metadata ?? {}),
    };
  }

  private renderTemplate(content: string, context: Record<string, unknown>) {
    return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const value = context[key];
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    });
  }

  private normalizePhone(rawPhone: string) {
    return rawPhone.replace(/[^\d+]/g, '');
  }

  private resolveMaxAttempts() {
    const raw = Number(this.configService.get<string>('WHATSAPP_QUEUE_MAX_ATTEMPTS', '3'));
    if (Number.isNaN(raw)) {
      return 3;
    }
    return Math.max(1, Math.min(10, raw));
  }

  private calculateRetryDate(attempt: number) {
    const minutes = Math.min(60, Math.max(1, attempt * 5));
    const retryAt = new Date();
    retryAt.setMinutes(retryAt.getMinutes() + minutes);
    return retryAt;
  }
}
