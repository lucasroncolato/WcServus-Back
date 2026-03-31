import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AttendanceStatus,
  AuditAction,
  Prisma,
  Role,
  ScheduleSlotStatus,
} from '@prisma/client';
import {
  assertServantAccess,
  getAttendanceAccessWhere,
  resolveScopedMinistryIds,
} from 'src/common/auth/access-scope';
import { EventBusService } from 'src/common/events/event-bus.service';
import {
  attendanceAbsenceStatuses,
  attendanceJustifiedAbsenceStatuses,
  attendancePositiveStatuses,
  attendanceUnjustifiedAbsenceStatuses,
  isAbsenceAttendanceStatus,
  isJustifiedAbsenceAttendanceStatus,
  isPositiveAttendanceStatus,
} from 'src/common/attendance/attendance-status.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PastoralAlertEngineService } from '../pastoral-visits/pastoral-alert-engine.service';
import { BatchAttendanceDto } from './dto/batch-attendance.dto';
import { BulkMarkServiceAttendanceDto } from './dto/bulk-mark-service-attendance.dto';
import { CheckInDto } from './dto/check-in.dto';
import { ListAttendancesQueryDto } from './dto/list-attendances-query.dto';
import { MarkServiceAttendanceDto } from './dto/mark-service-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventBus: EventBusService,
    private readonly pastoralAlertEngine: PastoralAlertEngineService,
  ) {}

  async findAll(query: ListAttendancesQueryDto, actor: JwtPayload) {
    const scopeWhere = await getAttendanceAccessWhere(this.prisma, actor);
    const queryWhere: Prisma.AttendanceWhereInput = {
      serviceId: query.serviceId,
      servantId: query.servantId,
      status: query.status,
    };

    const where: Prisma.AttendanceWhereInput =
      scopeWhere !== undefined ? { AND: [queryWhere, scopeWhere] } : queryWhere;

    return this.prisma.attendance.findMany({
      where,
      include: {
        service: true,
        servant: true,
        registeredBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async serviceWorkspace(serviceId: string, actor: JwtPayload) {
    const churchId = this.requireActorChurch(actor);
    const service = await this.prisma.worshipService.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        title: true,
        serviceDate: true,
        startTime: true,
        status: true,
        locked: true,
        canceled: true,
        churchId: true,
      },
    });
    if (!service) {
      throw new NotFoundException('Worship service not found');
    }
    if (service.churchId !== churchId) {
      throw new ForbiddenException('Worship service is outside actor church');
    }

    const allowedMinistryIds = await this.resolveAllowedMinistryIdsForAttendance(actor);
    const slots = await this.prisma.scheduleSlot.findMany({
      where: {
        serviceId,
        assignedServantId: { not: null },
        deletedAt: null,
        ...(allowedMinistryIds ? { ministryId: { in: allowedMinistryIds } } : {}),
      },
      include: {
        assignedServant: { select: { id: true, name: true } },
        ministry: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        responsibility: { select: { id: true, title: true } },
      },
      orderBy: [{ ministry: { name: 'asc' } }, { position: 'asc' }],
    });

    const servantIds = [...new Set(slots.map((slot) => slot.assignedServantId!).filter(Boolean))];
    const attendances = await this.prisma.attendance.findMany({
      where: {
        serviceId,
        ...(servantIds.length ? { servantId: { in: servantIds } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const attendanceByServant = new Map(attendances.map((item) => [item.servantId, item]));

    const records = slots.map((slot) => {
      const attendance = slot.assignedServantId ? attendanceByServant.get(slot.assignedServantId) : null;
      return {
        slotId: slot.id,
        servantId: slot.assignedServantId,
        servantName: slot.assignedServant?.name ?? null,
        ministryId: slot.ministryId,
        ministryName: slot.ministry.name,
        teamId: slot.teamId,
        teamName: slot.team?.name ?? null,
        responsibilityName: slot.responsibility?.title ?? slot.functionName,
        slotStatus: slot.status,
        slotConfirmationStatus: slot.confirmationStatus,
        attendanceId: attendance?.id ?? null,
        attendanceStatus: attendance?.status ?? 'UNKNOWN',
        attendanceJustification: attendance?.justification ?? null,
        attendanceNotes: attendance?.notes ?? null,
      };
    });

    const summary = {
      totalScheduled: records.length,
      present: records.filter((item) => isPositiveAttendanceStatus(item.attendanceStatus)).length,
      absent: records.filter((item) => attendanceUnjustifiedAbsenceStatuses().includes(item.attendanceStatus)).length,
      justified: records.filter((item) => isJustifiedAbsenceAttendanceStatus(item.attendanceStatus)).length,
      unknown: records.filter((item) => item.attendanceStatus === 'UNKNOWN').length,
    };

    return {
      service,
      summary,
      records,
    };
  }

  async markServiceAttendance(serviceId: string, dto: MarkServiceAttendanceDto, actor: JwtPayload) {
    return this.checkIn(
      {
        serviceId,
        servantId: dto.servantId,
        status: dto.status,
        justification: dto.justification,
        notes: dto.notes,
      },
      actor,
      {
        allowExtraService: dto.allowExtraService ?? false,
      },
    );
  }

  async bulkMarkServiceAttendance(serviceId: string, dto: BulkMarkServiceAttendanceDto, actor: JwtPayload) {
    const results: Array<{ servantId: string; success: boolean; attendanceId?: string; error?: string }> = [];
    for (const record of dto.records) {
      try {
        const attendance = await this.markServiceAttendance(serviceId, record, actor);
        results.push({
          servantId: record.servantId,
          success: true,
          attendanceId: attendance.id,
        });
      } catch (error) {
        results.push({
          servantId: record.servantId,
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected failure',
        });
      }
    }

    return {
      success: results.some((item) => item.success),
      summary: {
        total: results.length,
        success: results.filter((item) => item.success).length,
        failed: results.filter((item) => !item.success).length,
      },
      results,
    };
  }

  async checkIn(
    dto: CheckInDto,
    actor: JwtPayload,
    options?: {
      allowExtraService?: boolean;
    },
  ) {
    const churchId = this.requireActorChurch(actor);
    await this.assertCanRegisterAttendance(actor, dto.servantId);
    await this.ensureReferences(dto.serviceId, dto.servantId, churchId);
    await this.assertAttendanceCanBeRegisteredForSchedule(
      actor,
      dto.serviceId,
      dto.servantId,
      options?.allowExtraService ?? false,
    );

    const attendance = await this.prisma.attendance.upsert({
      where: {
        serviceId_servantId: {
          serviceId: dto.serviceId,
          servantId: dto.servantId,
        },
      },
      update: {
        churchId,
        status: dto.status,
        justification: dto.justification,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
      create: {
        serviceId: dto.serviceId,
        servantId: dto.servantId,
        churchId,
        status: dto.status,
        justification: dto.justification,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
      include: {
        service: true,
        servant: true,
      },
    });

    await this.recalculateServantAbsenceMetrics(dto.servantId);
    await this.ensurePastoralAlertIfNeeded(
      dto.servantId,
      attendance.status,
      actor.sub,
      churchId,
      attendance.serviceId,
      attendance.id,
    );
    await this.updateRelatedSlotStatus(
      attendance.serviceId,
      attendance.servantId,
      attendance.status,
      actor.sub,
    );

    await this.auditService.log({
      action: AuditAction.ATTENDANCE_REGISTERED,
      entity: 'Attendance',
      entityId: attendance.id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    await this.eventBus.emit({
      name: 'ATTENDANCE_REGISTERED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: attendance.churchId,
      payload: {
        attendanceId: attendance.id,
        serviceId: attendance.serviceId,
        servantId: attendance.servantId,
        status: attendance.status,
      },
    });

    await this.notifyAttendanceChange(attendance.servantId, attendance.id, attendance.status);

    return attendance;
  }

  async batch(dto: BatchAttendanceDto, actor: JwtPayload) {
    const results = [] as Array<{ serviceId: string; servantId: string; attendanceId: string }>;

    for (const record of dto.records) {
      const attendance = await this.checkIn(record, actor);
      results.push({
        serviceId: attendance.serviceId,
        servantId: attendance.servantId,
        attendanceId: attendance.id,
      });
    }

    return {
      processed: results.length,
      records: results,
    };
  }

  async update(id: string, dto: UpdateAttendanceDto, actor: JwtPayload) {
    const churchId = this.requireActorChurch(actor);
    const current = await this.prisma.attendance.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Attendance not found');
    }

    await this.assertCanRegisterAttendance(actor, current.servantId);
    await this.assertAttendanceCanBeRegisteredForSchedule(
      actor,
      current.serviceId,
      current.servantId,
      false,
    );

    const attendance = await this.prisma.attendance.update({
      where: { id },
      data: {
        churchId,
        status: dto.status,
        justification: dto.justification,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
    });

    await this.recalculateServantAbsenceMetrics(attendance.servantId);
    await this.ensurePastoralAlertIfNeeded(
      attendance.servantId,
      attendance.status,
      actor.sub,
      churchId,
      attendance.serviceId,
      attendance.id,
    );
    await this.updateRelatedSlotStatus(
      attendance.serviceId,
      attendance.servantId,
      attendance.status,
      actor.sub,
    );

    await this.auditService.log({
      action: AuditAction.ATTENDANCE_REGISTERED,
      entity: 'Attendance',
      entityId: attendance.id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    await this.notifyAttendanceChange(attendance.servantId, attendance.id, attendance.status);

    return attendance;
  }

  private async ensureReferences(serviceId: string, servantId: string, churchId: string) {
    const [service, servant] = await Promise.all([
      this.prisma.worshipService.findUnique({
        where: { id: serviceId },
        select: { id: true, churchId: true, canceled: true, status: true },
      }),
      this.prisma.servant.findUnique({ where: { id: servantId }, select: { id: true, churchId: true } }),
    ]);

    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    if (service.churchId !== churchId || servant.churchId !== churchId) {
      throw new ForbiddenException('Cross-tenant attendance operation is not allowed');
    }

    if (service.canceled || service.status === 'CANCELADO') {
      throw new BadRequestException('Cannot register attendance for cancelled worship service');
    }
  }

  private async recalculateServantAbsenceMetrics(servantId: string) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    const monthlyAbsences = await this.prisma.attendance.count({
      where: {
        servantId,
        service: {
          serviceDate: { gte: monthStart, lte: monthEnd },
        },
        status: { in: attendanceAbsenceStatuses() },
      },
    });

    const allAttendances = await this.prisma.attendance.findMany({
      where: { servantId },
      include: { service: true },
      orderBy: { service: { serviceDate: 'desc' } },
      take: 30,
    });

    let consecutiveAbsences = 0;
    for (const attendance of allAttendances) {
      if (isPositiveAttendanceStatus(attendance.status)) {
        break;
      }
      if (isAbsenceAttendanceStatus(attendance.status)) {
        consecutiveAbsences += 1;
      } else {
        break;
      }
    }

    await this.prisma.servant.update({
      where: { id: servantId },
      data: {
        monthlyAbsences,
        consecutiveAbsences,
      },
    });
  }

  private async ensurePastoralAlertIfNeeded(
    servantId: string,
    status: AttendanceStatus,
    actorUserId: string,
    churchId: string,
    serviceId?: string,
    attendanceId?: string,
  ) {
    if (!serviceId || !attendanceId) {
      return;
    }

    await this.pastoralAlertEngine.evaluateAttendanceSignal({
      churchId,
      servantId,
      serviceId,
      attendanceId,
      status,
      actorUserId,
    });
  }

  private async assertCanRegisterAttendance(actor: JwtPayload, servantId: string) {
    if (actor.role === Role.SERVO && actor.servantId !== servantId) {
      throw new ForbiddenException('SERVO can only register own attendance');
    }

    await assertServantAccess(this.prisma, actor, servantId);
  }

  private requireActorChurch(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException('Actor must be bound to a church context');
    }
    return actor.churchId;
  }

  private async assertAttendanceCanBeRegisteredForSchedule(
    actor: JwtPayload,
    serviceId: string,
    servantId: string,
    allowExtraService = false,
  ) {
    const allowedMinistryIds = await this.resolveAllowedMinistryIdsForAttendance(actor);
    const slot = await this.prisma.scheduleSlot.findFirst({
      where: {
        serviceId,
        assignedServantId: servantId,
        deletedAt: null,
        ...(allowedMinistryIds ? { ministryId: { in: allowedMinistryIds } } : {}),
      },
      select: { id: true },
    });

    if (slot) {
      return;
    }

    if (allowExtraService) {
      return;
    }

    throw new ForbiddenException(
      'Attendance can only be registered for servants scheduled in services within your scope',
    );
  }

  private async resolveAllowedMinistryIdsForAttendance(actor: JwtPayload): Promise<string[] | null> {
    if (
      actor.role === Role.SUPER_ADMIN ||
      actor.role === Role.ADMIN ||
      actor.role === Role.PASTOR
    ) {
      return null;
    }

    if (actor.role === Role.COORDENADOR) {
      const ministryIds = await resolveScopedMinistryIds(this.prisma, actor);
      if (!ministryIds.length) {
        throw new ForbiddenException('Coordinator has no ministry scope configured');
      }
      return ministryIds;
    }

    if (actor.role === Role.SERVO) {
      throw new ForbiddenException(
        'SERVO cannot register attendance in coordinator workspace',
      );
    }

    return [];
  }

  private async updateRelatedSlotStatus(
    serviceId: string,
    servantId: string,
    status: AttendanceStatus,
    actorUserId: string,
  ) {
    const nextSlotStatus = isPositiveAttendanceStatus(status)
      ? ScheduleSlotStatus.COMPLETED
      : isAbsenceAttendanceStatus(status)
        ? ScheduleSlotStatus.NO_SHOW
        : null;
    if (!nextSlotStatus) {
      return;
    }
    const updated = await this.prisma.scheduleSlot.updateMany({
      where: {
        serviceId,
        assignedServantId: servantId,
      },
      data: { status: nextSlotStatus },
    });

    if (updated.count > 0) {
      await this.auditService.log({
        action:
          nextSlotStatus === ScheduleSlotStatus.COMPLETED
            ? AuditAction.SLOT_COMPLETED
            : AuditAction.SLOT_NO_SHOW,
        entity: 'ScheduleSlot',
        entityId: `${serviceId}:${servantId}`,
        userId: actorUserId,
        metadata: {
          serviceId,
          servantId,
          nextSlotStatus,
        },
      });
    }
  }

  private async notifyAttendanceChange(
    servantId: string,
    attendanceId: string,
    status: AttendanceStatus,
  ) {
    const title = isPositiveAttendanceStatus(status) ? 'Presenca registrada' : 'Falta registrada';

    const message = isPositiveAttendanceStatus(status)
      ? 'Sua presenca foi registrada em um culto.'
      : isJustifiedAbsenceAttendanceStatus(status)
        ? 'Foi registrada uma falta justificada em um culto.'
        : 'Foi registrada falta para voce em um culto.';

    await this.notificationsService.notifyServantLinkedUser(servantId, {
      type: 'ATTENDANCE_UPDATED',
      title,
      message,
      link: '/attendances',
      metadata: {
        attendanceId,
        status,
      },
    });
  }

}

