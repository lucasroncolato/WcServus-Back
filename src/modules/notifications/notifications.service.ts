import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { WhatsappService } from './whatsapp/whatsapp.service';

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
};

type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  metadata: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async findAll(userId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const isReadFilter =
      typeof query.isRead === 'boolean'
        ? query.isRead
        : query.unreadOnly === true
          ? false
          : undefined;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(typeof isReadFilter === 'boolean' ? { readAt: isReadFilter ? { not: null } : null } : {}),
    };

    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      data: items.map((item) => this.toApiNotification(item)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      unreadCount,
    };
  }

  async markRead(id: string, userId: string) {
    const current = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
    });

    if (!current) {
      throw new NotFoundException('Notification not found');
    }

    if (current.readAt) {
      return {
        message: 'Notification already marked as read',
        data: this.toApiNotification(current),
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id: current.id },
      data: { readAt: new Date() },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
    });

    return {
      message: 'Notification marked as read',
      data: this.toApiNotification(updated),
    };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return {
      message: 'Notifications marked as read',
      updated: result.count,
    };
  }

  async create(input: CreateNotificationInput) {
    const created = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await this.whatsappService.enqueueFromNotification({
      userId: input.userId,
      eventKey: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      metadata: input.metadata,
    });

    return created;
  }

  async createMany(inputs: CreateNotificationInput[]) {
    const uniqueInputs = this.uniqueByUserAndContent(inputs);
    if (uniqueInputs.length === 0) {
      return { created: 0 };
    }

    await this.prisma.notification.createMany({
      data: uniqueInputs.map((input) => ({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });

    await Promise.all(
      uniqueInputs.map((input) =>
        this.whatsappService.enqueueFromNotification({
          userId: input.userId,
          eventKey: input.type,
          title: input.title,
          message: input.message,
          link: input.link ?? null,
          metadata: input.metadata,
        }),
      ),
    );

    return { created: uniqueInputs.length };
  }

  async notifyServantLinkedUser(
    servantId: string,
    payload: Omit<CreateNotificationInput, 'userId'>,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { servantId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!user) {
      return null;
    }

    return this.create({
      userId: user.id,
      ...payload,
    });
  }

  private uniqueByUserAndContent(inputs: CreateNotificationInput[]) {
    const seen = new Set<string>();
    const output: CreateNotificationInput[] = [];

    for (const input of inputs) {
      const key = `${input.userId}|${input.type}|${input.title}|${input.message}|${input.link ?? ''}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(input);
    }

    return output;
  }

  private toApiNotification(notification: NotificationRecord) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      description: notification.message,
      isRead: notification.readAt !== null,
      createdAt: notification.createdAt,
      linkTo: notification.link,
      relatedId: this.resolveRelatedId(notification.metadata),
    };
  }

  private resolveRelatedId(metadata: Prisma.JsonValue | null): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const dictionary = metadata as Record<string, unknown>;
    const candidates = [
      'relatedId',
      'scheduleId',
      'attendanceId',
      'pastoralVisitId',
      'talentId',
      'trainingId',
      'servantId',
      'serviceId',
      'userId',
    ];

    for (const key of candidates) {
      const value = dictionary[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }

    return null;
  }
}
