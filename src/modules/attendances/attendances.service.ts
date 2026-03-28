import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AlertStatus,
  AttendanceStatus,
  AuditAction,
  Prisma,
  RewardSource,
  Role,
  ScheduleSlotStatus,
} from '@prisma/client';
import {
  assertServantAccess,
  getAttendanceAccessWhere,
  getScheduleAccessWhere,
} from 'src/common/auth/access-scope';
import { EventBusService } from 'src/common/events/event-bus.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { BatchAttendanceDto } from './dto/batch-attendance.dto';
import { CheckInDto } from './dto/check-in.dto';
import { ListAttendancesQueryDto } from './dto/list-attendances-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsService: RewardsService,
    private readonly eventBus: EventBusService,
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

  async checkIn(dto: CheckInDto, actor: JwtPayload) {
    await this.assertCanRegisterAttendance(actor, dto.servantId);
    await this.ensureReferences(dto.serviceId, dto.servantId);
    await this.assertAttendanceCanBeRegisteredForSchedule(actor, dto.serviceId, dto.servantId);

    const attendance = await this.prisma.attendance.upsert({
      where: {
        serviceId_servantId: {
          serviceId: dto.serviceId,
          servantId: dto.servantId,
        },
      },
      update: {
        churchId: actor.churchId ?? null,
        status: dto.status,
        justification: dto.justification,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
      create: {
        serviceId: dto.serviceId,
        servantId: dto.servantId,
        churchId: actor.churchId ?? null,
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
    await this.ensurePastoralAlertIfNeeded(dto.servantId, actor.sub);
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
    await this.maybeGrantAttendanceReward(attendance.servantId, attendance.id, attendance.status, actor.sub);

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
    const current = await this.prisma.attendance.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Attendance not found');
    }

    await this.assertCanRegisterAttendance(actor, current.servantId);
    await this.assertAttendanceCanBeRegisteredForSchedule(actor, current.serviceId, current.servantId);

    const attendance = await this.prisma.attendance.update({
      where: { id },
      data: {
        churchId: actor.churchId ?? null,
        status: dto.status,
        justification: dto.justification,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
    });

    await this.recalculateServantAbsenceMetrics(attendance.servantId);
    await this.ensurePastoralAlertIfNeeded(attendance.servantId, actor.sub);
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
    await this.maybeGrantAttendanceReward(attendance.servantId, attendance.id, attendance.status, actor.sub);

    return attendance;
  }

  private async ensureReferences(serviceId: string, servantId: string) {
    const [service, servant] = await Promise.all([
      this.prisma.worshipService.findUnique({ where: { id: serviceId }, select: { id: true } }),
      this.prisma.servant.findUnique({ where: { id: servantId }, select: { id: true } }),
    ]);

    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    if (!servant) {
      throw new NotFoundException('Servant not found');
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
        status: { in: [AttendanceStatus.FALTA, AttendanceStatus.FALTA_JUSTIFICADA] },
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
      if (attendance.status === AttendanceStatus.PRESENTE) {
        break;
      }
      consecutiveAbsences += 1;
    }

    await this.prisma.servant.update({
      where: { id: servantId },
      data: {
        monthlyAbsences,
        consecutiveAbsences,
      },
    });
  }

  private async ensurePastoralAlertIfNeeded(servantId: string, actorUserId: string) {
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { id: true, monthlyAbsences: true, consecutiveAbsences: true },
    });

    if (!servant) {
      return;
    }

    const trigger =
      servant.consecutiveAbsences >= 3
        ? 'CONSECUTIVE_ABSENCES'
        : servant.monthlyAbsences >= 4
          ? 'MONTHLY_ABSENCES'
          : null;

    if (!trigger) {
      return;
    }

    const existingOpenAlert = await this.prisma.pastoralAlert.findFirst({
      where: {
        servantId,
        trigger,
        status: AlertStatus.OPEN,
      },
      select: { id: true },
    });

    if (existingOpenAlert) {
      return;
    }

    await this.prisma.pastoralAlert.create({
      data: {
        servantId,
        trigger,
        message:
          trigger === 'CONSECUTIVE_ABSENCES'
            ? 'Servo atingiu 3 faltas consecutivas. Avaliar acompanhamento pastoral.'
            : 'Servo atingiu 4 faltas no mes. Avaliar acompanhamento pastoral.',
        createdByUserId: actorUserId,
      },
    });
  }

  private async assertCanRegisterAttendance(actor: JwtPayload, servantId: string) {
    if (actor.role === Role.SERVO && actor.servantId !== servantId) {
      throw new ForbiddenException('SERVO can only register own attendance');
    }

    await assertServantAccess(this.prisma, actor, servantId);
  }

  private async assertAttendanceCanBeRegisteredForSchedule(
    actor: JwtPayload,
    serviceId: string,
    servantId: string,
  ) {
    const scheduleScope = await getScheduleAccessWhere(this.prisma, actor);
    const schedule = await this.prisma.schedule.findFirst({
      where: scheduleScope
        ? {
            AND: [{ serviceId, servantId }, scheduleScope],
          }
        : { serviceId, servantId },
      select: { id: true },
    });

    if (!schedule) {
      throw new ForbiddenException(
        'Attendance can only be registered for servants scheduled in services within your scope',
      );
    }
  }

  private async updateRelatedSlotStatus(
    serviceId: string,
    servantId: string,
    status: AttendanceStatus,
    actorUserId: string,
  ) {
    const nextSlotStatus =
      status === AttendanceStatus.PRESENTE ? ScheduleSlotStatus.COMPLETED : ScheduleSlotStatus.NO_SHOW;
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
    const title =
      status === AttendanceStatus.PRESENTE ? 'Presenca registrada' : 'Falta registrada';

    const message =
      status === AttendanceStatus.PRESENTE
        ? 'Sua presenca foi registrada em um culto.'
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

  private async maybeGrantAttendanceReward(
    servantId: string,
    attendanceId: string,
    status: AttendanceStatus,
    actorUserId: string,
  ) {
    if (status !== AttendanceStatus.PRESENTE) {
      return;
    }

    await this.rewardsService.grantReward({
      servantId,
      source: RewardSource.ATTENDANCE_PRESENT,
      points: 5,
      title: 'Presenca em culto',
      description: 'Recompensa por presenca registrada em culto.',
      referenceId: attendanceId,
      grantedByUserId: actorUserId,
    });
  }
}
