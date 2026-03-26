import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { getAttendanceAccessWhere, getScheduleAccessWhere } from 'src/common/auth/access-scope';
import { AuditAction } from '@prisma/client';
import { getSaoPauloWeekday, resolvePlanningWindow } from 'src/common/utils/planning-window.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWorshipServiceDto } from './dto/create-worship-service.dto';
import { ListWorshipServicesQueryDto } from './dto/list-worship-services-query.dto';
import { UpdateWorshipServiceDto } from './dto/update-worship-service.dto';

@Injectable()
export class WorshipServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isFullVisibilityRole(role: Role) {
    return (
      role === Role.SUPER_ADMIN ||
      role === Role.ADMIN ||
      role === Role.PASTOR ||
      role === Role.COORDENADOR
    );
  }

  async findAll(query: ListWorshipServicesQueryDto, actor: JwtPayload) {
    if (query.windowMode && !query.startDate) {
      throw new BadRequestException('startDate is required when windowMode is informed');
    }

    const scheduleScope = await getScheduleAccessWhere(this.prisma, actor);
    const attendanceScope = await getAttendanceAccessWhere(this.prisma, actor);

    const { start, end } = resolvePlanningWindow({
      windowMode: query.windowMode,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return this.prisma.worshipService.findMany({
      where: {
        ...(this.isFullVisibilityRole(actor.role)
          ? {}
          : {
              OR: [
                {
                  schedules: {
                    some: scheduleScope ?? { id: '__no_access__' },
                  },
                },
                {
                  attendances: {
                    some: attendanceScope ?? { id: '__no_access__' },
                  },
                },
              ],
            }),
        serviceDate:
          start || end
            ? {
                gte: start,
                lte: end,
              }
            : undefined,
      },
      orderBy: { serviceDate: 'asc' },
    }).then((services) => {
      if (!query.weekdays?.length) {
        return services;
      }
      return services.filter((service) => query.weekdays?.includes(getSaoPauloWeekday(service.serviceDate)));
    });
  }

  async findOne(id: string, actor: JwtPayload) {
    const scheduleScope = await getScheduleAccessWhere(this.prisma, actor);
    const attendanceScope = await getAttendanceAccessWhere(this.prisma, actor);

    if (!this.isFullVisibilityRole(actor.role)) {
      const visible = await this.prisma.worshipService.findFirst({
        where: {
          id,
          OR: [
            {
              schedules: {
                some: scheduleScope ?? { id: '__no_access__' },
              },
            },
            {
              attendances: {
                some: attendanceScope ?? { id: '__no_access__' },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (!visible) {
        throw new ForbiddenException('You do not have permission for this worship service');
      }
    }

    const record = await this.prisma.worshipService.findUniqueOrThrow({
      where: { id },
      include: {
        schedules:
          this.isFullVisibilityRole(actor.role)
            ? true
            : {
                where: scheduleScope
                  ? {
                      AND: [scheduleScope],
                    }
                  : undefined,
              },
        attendances:
          this.isFullVisibilityRole(actor.role)
            ? true
            : {
                where: attendanceScope
                  ? {
                      AND: [attendanceScope],
                    }
                  : undefined,
              },
      },
    });

    return record;
  }

  async create(dto: CreateWorshipServiceDto, actorUserId?: string) {
    const service = await this.prisma.worshipService.create({
      data: {
        ...dto,
        serviceDate: new Date(dto.serviceDate),
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'WorshipService',
      entityId: service.id,
      userId: actorUserId,
    });

    await this.notifyServiceReminder(service.id, service.title, 'Novo culto cadastrado no sistema.');

    return service;
  }

  async update(id: string, dto: UpdateWorshipServiceDto, actorUserId?: string) {
    await this.ensureExists(id);

    const service = await this.prisma.worshipService.update({
      where: { id },
      data: {
        ...dto,
        serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : undefined,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'WorshipService',
      entityId: id,
      userId: actorUserId,
      metadata: dto as unknown as Record<string, unknown>,
    });

    await this.notifyServiceReminder(service.id, service.title, 'Atualizacao de culto. Verifique horarios e detalhes.');

    return service;
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.worshipService.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException('Worship service not found');
    }
  }

  private async notifyServiceReminder(serviceId: string, serviceTitle: string, message: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: { serviceId },
      select: { servantId: true },
    });

    const servantIds = [...new Set(schedules.map((item) => item.servantId))];
    if (servantIds.length === 0) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: {
        servantId: { in: servantIds },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (users.length === 0) {
      return;
    }

    await this.notificationsService.createMany(
      users.map((user) => ({
        userId: user.id,
        type: 'WORSHIP_SERVICE_REMINDER',
        title: `Lembrete de culto: ${serviceTitle}`,
        message,
        link: '/schedules',
        metadata: { serviceId },
      })),
    );
  }
}
