import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import {
  getAttendanceAccessWhere,
  getPastoralVisitAccessWhere,
  getScheduleAccessWhere,
  getServantAccessWhere,
} from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
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

type NotificationOriginType =
  | 'SCHEDULE'
  | 'ATTENDANCE'
  | 'PASTORAL_VISIT'
  | 'TALENT'
  | 'SERVANT'
  | 'WORSHIP_SERVICE'
  | 'SUPPORT_REQUEST'
  | 'SERVANT_REWARD'
  | 'SELF_ROUTE'
  | 'UNKNOWN';

type NotificationOrigin = {
  type: NotificationOriginType;
  id: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async findAll(actor: JwtPayload, query: ListNotificationsQueryDto) {
    const userId = actor.sub;
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
      data: await Promise.all(items.map((item) => this.toApiNotification(item, actor))),
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
        data: await this.toApiNotification(current),
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
      data: await this.toApiNotification(updated),
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

  private async toApiNotification(notification: NotificationRecord, actor?: JwtPayload) {
    const origin = this.resolveOrigin(notification.metadata, notification.link);
    const canOpenOrigin = actor
      ? await this.canOpenOriginForActor(origin, actor)
      : false;

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      description: notification.message,
      isRead: notification.readAt !== null,
      createdAt: notification.createdAt,
      linkTo: notification.link,
      relatedId: this.resolveRelatedId(notification.metadata),
      originType: origin.type,
      originId: origin.id,
      canOpenOrigin,
    };
  }

  private resolveOrigin(metadata: Prisma.JsonValue | null, link: string | null): NotificationOrigin {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      if (link && this.isSelfRoute(link)) {
        return { type: 'SELF_ROUTE', id: null };
      }
      return { type: 'UNKNOWN', id: null };
    }

    const dictionary = metadata as Record<string, unknown>;
    const map: Array<{ key: string; type: NotificationOriginType }> = [
      { key: 'scheduleId', type: 'SCHEDULE' },
      { key: 'attendanceId', type: 'ATTENDANCE' },
      { key: 'pastoralVisitId', type: 'PASTORAL_VISIT' },
      { key: 'talentId', type: 'TALENT' },
      { key: 'servantId', type: 'SERVANT' },
      { key: 'serviceId', type: 'WORSHIP_SERVICE' },
      { key: 'supportRequestId', type: 'SUPPORT_REQUEST' },
      { key: 'rewardId', type: 'SERVANT_REWARD' },
    ];

    for (const candidate of map) {
      const value = dictionary[candidate.key];
      if (typeof value === 'string' && value.trim() !== '') {
        return { type: candidate.type, id: value };
      }
    }

    if (link && this.isSelfRoute(link)) {
      return { type: 'SELF_ROUTE', id: null };
    }

    return { type: 'UNKNOWN', id: null };
  }

  private async canOpenOriginForActor(origin: NotificationOrigin, actor: JwtPayload) {
    if (origin.type === 'UNKNOWN') {
      return false;
    }

    if (origin.type === 'SELF_ROUTE') {
      return true;
    }

    if (!origin.id) {
      return false;
    }

    if (origin.type === 'SCHEDULE') {
      const scopeWhere = await getScheduleAccessWhere(this.prisma, actor);
      const found = await this.prisma.schedule.findFirst({
        where: scopeWhere ? { AND: [{ id: origin.id }, scopeWhere] } : { id: origin.id },
        select: { id: true },
      });
      return Boolean(found);
    }

    if (origin.type === 'ATTENDANCE') {
      const scopeWhere = await getAttendanceAccessWhere(this.prisma, actor);
      const found = await this.prisma.attendance.findFirst({
        where: scopeWhere ? { AND: [{ id: origin.id }, scopeWhere] } : { id: origin.id },
        select: { id: true },
      });
      return Boolean(found);
    }

    if (origin.type === 'PASTORAL_VISIT') {
      const scopeWhere = await getPastoralVisitAccessWhere(this.prisma, actor);
      const found = await this.prisma.pastoralVisit.findFirst({
        where: scopeWhere ? { AND: [{ id: origin.id }, scopeWhere] } : { id: origin.id },
        select: { id: true },
      });
      return Boolean(found);
    }

    if (origin.type === 'SERVANT') {
      const scopeWhere = await getServantAccessWhere(this.prisma, actor);
      const found = await this.prisma.servant.findFirst({
        where: scopeWhere ? { AND: [{ id: origin.id }, scopeWhere] } : { id: origin.id },
        select: { id: true },
      });
      return Boolean(found);
    }

    if (origin.type === 'TALENT') {
      const scopeWhere = await getServantAccessWhere(this.prisma, actor);
      const found = await this.prisma.talent.findFirst({
        where: scopeWhere
          ? {
              AND: [
                { id: origin.id },
                { servant: scopeWhere },
              ],
            }
          : { id: origin.id },
        select: { id: true },
      });
      return Boolean(found);
    }

    if (origin.type === 'SERVANT_REWARD') {
      const scopeWhere = await getServantAccessWhere(this.prisma, actor);
      const found = await this.prisma.servantReward.findFirst({
        where: scopeWhere
          ? {
              AND: [
                { id: origin.id },
                { servant: scopeWhere },
              ],
            }
          : { id: origin.id },
        select: { id: true },
      });
      return Boolean(found);
    }

    if (origin.type === 'WORSHIP_SERVICE') {
      if (
        actor.role === Role.SUPER_ADMIN ||
        actor.role === Role.ADMIN ||
        actor.role === Role.PASTOR ||
        actor.role === Role.COORDENADOR
      ) {
        const found = await this.prisma.worshipService.findUnique({
          where: { id: origin.id },
          select: { id: true },
        });
        return Boolean(found);
      }

      const found = await this.prisma.schedule.findFirst({
        where: {
          serviceId: origin.id,
          servantId: actor.servantId ?? '__no_servant__',
        },
        select: { id: true },
      });
      return Boolean(found);
    }

    if (origin.type === 'SUPPORT_REQUEST') {
      const found = await this.prisma.supportRequest.findFirst({
        where:
          actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN
            ? { id: origin.id }
            : { id: origin.id, authorUserId: actor.sub },
        select: { id: true },
      });
      return Boolean(found);
    }

    return false;
  }

  private isSelfRoute(link: string) {
    return link.startsWith('/me') || link.startsWith('/notifications') || link.startsWith('/auth/me');
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
