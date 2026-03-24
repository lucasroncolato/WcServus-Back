import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationTemplateStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { ListNotificationTemplatesQueryDto } from './dto/list-notification-templates-query.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { DEFAULT_WHATSAPP_TEMPLATES } from './whatsapp/default-whatsapp-templates';

@Injectable()
export class NotificationTemplatesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const existing = await this.prisma.notificationTemplate.count({
      where: { channel: NotificationChannel.WHATSAPP },
    });

    if (existing > 0) {
      return;
    }

    await this.prisma.notificationTemplate.createMany({
      data: DEFAULT_WHATSAPP_TEMPLATES.map((item) => ({
        eventKey: item.eventKey,
        channel: NotificationChannel.WHATSAPP,
        name: item.name,
        content: item.content,
        status: NotificationTemplateStatus.ACTIVE,
      })),
      skipDuplicates: true,
    });
  }

  async findAll(query: ListNotificationTemplatesQueryDto) {
    const where: Prisma.NotificationTemplateWhereInput = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.eventKey ? { eventKey: query.eventKey } : {}),
      ...(query.activeOnly === true ? { status: NotificationTemplateStatus.ACTIVE } : {}),
    };

    return this.prisma.notificationTemplate.findMany({
      where,
      orderBy: [{ eventKey: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    return template;
  }

  async create(dto: CreateNotificationTemplateDto) {
    const eventKey = dto.eventKey.trim().toUpperCase();
    try {
      return await this.prisma.notificationTemplate.create({
        data: {
          eventKey,
          channel: dto.channel,
          provider: dto.provider,
          name: dto.name.trim(),
          content: dto.content.trim(),
          variables: dto.variables as Prisma.InputJsonValue | undefined,
          status: dto.status ?? NotificationTemplateStatus.ACTIVE,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A template already exists for this event and channel');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateNotificationTemplateDto) {
    await this.findOne(id);

    const data: Prisma.NotificationTemplateUpdateInput = {
      eventKey: dto.eventKey?.trim().toUpperCase(),
      provider: dto.provider,
      name: dto.name?.trim(),
      content: dto.content?.trim(),
      variables: dto.variables as Prisma.InputJsonValue | undefined,
      status: dto.status,
    };

    try {
      return await this.prisma.notificationTemplate.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A template already exists for this event and channel');
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.notificationTemplate.delete({ where: { id } });
    return { message: 'Template removed successfully' };
  }

  async activate(id: string, enabled: boolean) {
    await this.findOne(id);
    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        status: enabled ? NotificationTemplateStatus.ACTIVE : NotificationTemplateStatus.INACTIVE,
      },
    });
  }
}
