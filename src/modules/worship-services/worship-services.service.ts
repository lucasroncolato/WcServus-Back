import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { getAttendanceAccessWhere, getScheduleAccessWhere } from 'src/common/auth/access-scope';
import { AuditAction } from '@prisma/client';
import { getSaoPauloWeekday, resolvePlanningWindow } from 'src/common/utils/planning-window.utils';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulesService } from '../schedules/schedules.service';
import { ListScheduleWorkspaceQueryDto } from '../schedules/dto/list-schedule-workspace-query.dto';
import { CreateWorshipServiceDto } from './dto/create-worship-service.dto';
import { ListWorshipServicesQueryDto } from './dto/list-worship-services-query.dto';
import { UpdateWorshipServiceDto } from './dto/update-worship-service.dto';

@Injectable()
export class WorshipServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantIntegrity: TenantIntegrityService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly schedulesService: SchedulesService,
  ) {}

  private isFullVisibilityRole(role: Role) {
    return (
      role === Role.SUPER_ADMIN ||
      role === Role.ADMIN ||
      role === Role.PASTOR
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
        ...(actor.churchId ? { churchId: actor.churchId } : {}),
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
          ...(actor.churchId ? { churchId: actor.churchId } : {}),
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

    if (actor.churchId) {
      this.tenantIntegrity.assertSameChurch(actor.churchId, record.churchId, 'Worship service');
    }

    return record;
  }

  async create(dto: CreateWorshipServiceDto, actor: JwtPayload) {
    const churchId = this.tenantIntegrity.assertActorChurch(actor);
    if (dto.templateId) {
      const template = await this.prisma.serviceTemplate.findUnique({
        where: { id: dto.templateId },
        select: { churchId: true },
      });
      if (!template) {
        throw new NotFoundException('Service template not found');
      }
      this.tenantIntegrity.assertSameChurch(churchId, template.churchId, 'Service template');
    }

    const service = await this.prisma.worshipService.create({
      data: {
        ...dto,
        serviceDate: new Date(dto.serviceDate),
        churchId,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'WorshipService',
      entityId: service.id,
      userId: actor.sub,
    });

    await this.notifyServiceReminder(service.id, service.title, 'Novo culto cadastrado no sistema.');

    return service;
  }

  async update(id: string, dto: UpdateWorshipServiceDto, actor: JwtPayload) {
    await this.ensureExists(id, actor);
    if (dto.templateId) {
      const template = await this.prisma.serviceTemplate.findUnique({
        where: { id: dto.templateId },
        select: { churchId: true },
      });
      if (!template) {
        throw new NotFoundException('Service template not found');
      }
      this.tenantIntegrity.assertSameChurch(this.tenantIntegrity.assertActorChurch(actor), template.churchId, 'Service template');
    }

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
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    await this.notifyServiceReminder(service.id, service.title, 'Atualizacao de culto. Verifique horarios e detalhes.');

    return service;
  }

  async generateSchedule(id: string, actor: JwtPayload) {
    await this.ensureExists(id, actor);
    return this.schedulesService.autoGenerateSchedule(id, actor);
  }

  async board(id: string, query: ListScheduleWorkspaceQueryDto, actor: JwtPayload) {
    await this.ensureExists(id, actor);
    return this.schedulesService.serviceBoard(id, query, actor);
  }

  async notifyPendingSlots(id: string, actor: JwtPayload) {
    await this.ensureExists(id, actor);
    return this.schedulesService.notifyPendingSlotsForService(id, actor);
  }

  async fillEmptySlots(id: string, actor: JwtPayload) {
    await this.ensureExists(id, actor);
    return this.schedulesService.fillEmptySlotsForService(id, actor);
  }

  async regenerateSuggestions(id: string, actor: JwtPayload) {
    await this.ensureExists(id, actor);
    return this.schedulesService.regenerateSuggestionsForService(id, actor);
  }

  async closeSchedule(id: string, actor: JwtPayload) {
    await this.ensureExists(id, actor);
    return this.schedulesService.closeScheduleForService(id, actor);
  }

  private async ensureExists(id: string, actor: JwtPayload) {
    const found = await this.prisma.worshipService.findUnique({
      where: { id },
      select: { id: true, churchId: true },
    });
    if (!found) {
      throw new NotFoundException('Worship service not found');
    }
    this.tenantIntegrity.assertSameChurch(
      this.tenantIntegrity.assertActorChurch(actor),
      found.churchId,
      'Worship service',
    );
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
