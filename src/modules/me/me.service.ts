import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  AuditAction,
  Prisma,
  Role,
  ScheduleResponseStatus,
  ScheduleSlotConfirmationStatus,
  ScheduleSlotStatus,
  ScheduleStatus,
  ServantStatus,
  Shift,
} from '@prisma/client';
import {
  attendanceAbsenceStatuses,
  attendanceJustifiedAbsenceStatuses,
  attendancePositiveStatuses,
} from 'src/common/attendance/attendance-status.utils';
import { EventBusService } from 'src/common/events/event-bus.service';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListNotificationsQueryDto } from '../notifications/dto/list-notifications-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulesService } from '../schedules/schedules.service';
import { MySchedulesQueryDto } from './dto/my-schedules-query.dto';
import { PutMyAvailabilityDto } from './dto/put-my-availability.dto';
import { RespondMyScheduleDto } from './dto/respond-my-schedule.dto';
import { MyScheduleResponse, RespondMyScheduleSlotDto } from './dto/respond-my-schedule-slot.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateMyServantDto } from './dto/update-my-servant.dto';

@Injectable()
export class MeService {
  private readonly responseDeadlineHoursBeforeService = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
    private readonly schedulesService: SchedulesService,
  ) {}

  async getProfile(actor: JwtPayload) {
    const profile = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        avatarUrl: true,
        servantId: true,
        servant: {
          select: {
            id: true,
            name: true,
            status: true,
            trainingStatus: true,
            phone: true,
            notes: true,
            teamId: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
            mainMinistryId: true,
            mainMinistry: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return {
      id: profile.id,
      displayName: profile.name,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      servantId: profile.servantId,
      ministryId: profile.servant?.mainMinistryId ?? null,
      teamId: profile.servant?.teamId ?? null,
      sectorName: profile.servant?.mainMinistry?.name ?? null,
      teamName: profile.servant?.team?.name ?? null,
      ministryIds: profile.servant?.mainMinistryId ? [profile.servant.mainMinistryId] : [],
      teamIds: profile.servant?.teamId ? [profile.servant.teamId] : [],
      servant: profile.servant
        ? {
            id: profile.servant.id,
            name: profile.servant.name,
            status: profile.servant.status,
            statusView: profile.servant.status === ServantStatus.ATIVO ? 'ACTIVE' : 'INACTIVE',
            trainingStatus: profile.servant.trainingStatus,
            phone: profile.servant.phone,
            notes: profile.servant.notes,
            teamId: profile.servant.teamId,
            teamName: profile.servant.team?.name ?? null,
            team: profile.servant.team,
            mainMinistry: profile.servant.mainMinistry,
          }
        : null,
    };
  }

  async updateProfile(actor: JwtPayload, dto: UpdateMeDto) {
    this.assertPastorReadOnly(actor);
    if (dto.currentPassword !== undefined || dto.newPassword !== undefined) {
      throw new BadRequestException('Use PATCH /me/password to change password');
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        id: true,
        email: true,
        servantId: true,
      },
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== currentUser.email) {
      const duplicated = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          NOT: { id: actor.sub },
        },
        select: { id: true },
      });

      if (duplicated) {
        throw new BadRequestException('Email already in use');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.sub },
        data: {
          name: dto.displayName,
          email: dto.email,
          phone: dto.phone,
          avatarUrl: dto.avatarUrl,
        },
      });

      if (dto.notes !== undefined && currentUser.servantId) {
        await tx.servant.update({
          where: { id: currentUser.servantId },
          data: {
            notes: dto.notes,
            phone: dto.phone,
          },
        });
      }
    });

    return this.getProfile(actor);
  }

  async changePassword(actor: JwtPayload, dto: ChangePasswordDto) {
    this.assertPastorReadOnly(actor);
    const currentUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, currentUser.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is invalid');
    }

    const sameAsCurrent = await bcrypt.compare(dto.newPassword, currentUser.passwordHash);
    if (sameAsCurrent) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.sub },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId: actor.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return {
      message: 'Password changed successfully',
    };
  }

  async getMyServant(actor: JwtPayload) {
    const servantId = await this.requireLinkedServant(actor);

    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      include: {
        mainMinistry: {
          select: { id: true, name: true },
        },
      },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    return { data: servant };
  }

  async updateMyServant(actor: JwtPayload, dto: UpdateMyServantDto) {
    this.assertPastorReadOnly(actor);
    const servantId = await this.requireLinkedServant(actor);

    const updated = await this.prisma.servant.update({
      where: { id: servantId },
      data: {
        name: dto.name,
        phone: dto.phone,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        notes: dto.notes,
      },
      include: {
        mainMinistry: {
          select: { id: true, name: true },
        },
      },
    });

    return { data: updated };
  }

  async listMySchedules(actor: JwtPayload, query: MySchedulesQueryDto) {
    const servantId = await this.requireLinkedServant(actor);
    const now = new Date();
    const slots = await this.prisma.scheduleSlot.findMany({
      where: {
        assignedServantId: servantId,
        churchId: actor.churchId ?? undefined,
        deletedAt: null,
        service: {
          ...(query.startDate ? { serviceDate: { gte: new Date(query.startDate) } } : {}),
          ...(query.endDate
            ? {
                serviceDate: {
                  ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                  lte: new Date(query.endDate),
                },
              }
            : {}),
        },
      },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            type: true,
            serviceDate: true,
            startTime: true,
            status: true,
            locked: true,
            canceled: true,
            notes: true,
          },
        },
        ministry: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        responsibility: { select: { id: true, title: true } },
      },
      orderBy: [{ service: { serviceDate: 'asc' } }, { service: { startTime: 'asc' } }, { position: 'asc' }],
    });

    const mapped = slots.map((slot) => {
      const responseDeadline = this.computeResponseDeadline(slot.service.serviceDate, slot.service.startTime);
      const expired =
        slot.confirmationStatus === ScheduleSlotConfirmationStatus.PENDING &&
        responseDeadline !== null &&
        now > responseDeadline;
      const serviceClosed =
        slot.service.locked ||
        slot.service.status === 'FINALIZADO' ||
        slot.service.status === 'CANCELADO' ||
        slot.service.canceled;

      return {
        slotId: slot.id,
        worshipServiceId: slot.service.id,
        serviceName: slot.service.title,
        date: slot.service.serviceDate,
        startTime: slot.service.startTime,
        ministryId: slot.ministryId,
        ministryName: slot.ministry.name,
        teamId: slot.teamId,
        teamName: slot.team?.name ?? null,
        responsibilityName: slot.responsibility?.title ?? slot.functionName,
        slotStatus: slot.status,
        confirmationStatus: expired ? 'EXPIRED' : slot.confirmationStatus,
        serviceStatus: slot.service.status,
        serviceLocked: serviceClosed,
        responseDeadline,
        responseDeadlineSource: 'DERIVED_POLICY_SERVICE_START_MINUS_24H',
        notes: slot.notes ?? slot.service.notes ?? null,
        canRespond:
          !expired &&
          !serviceClosed &&
          slot.confirmationStatus === ScheduleSlotConfirmationStatus.PENDING &&
          slot.status !== ScheduleSlotStatus.LOCKED,
      };
    });

    const pending = mapped.filter((item) => item.confirmationStatus === 'PENDING');
    const confirmed = mapped.filter((item) => item.confirmationStatus === 'CONFIRMED');
    const declined = mapped.filter((item) => item.confirmationStatus === 'DECLINED');
    const expired = mapped.filter((item) => item.confirmationStatus === 'EXPIRED');
    const upcoming = mapped.filter((item) => new Date(item.date) >= now);
    const history = mapped.filter((item) => new Date(item.date) < now || item.serviceStatus === 'FINALIZADO');

    return {
      pending,
      upcoming,
      confirmed,
      declined,
      expired,
      history,
      meta: {
        deadlinePolicy: {
          persisted: false,
          strategy: 'DERIVED_POLICY_SERVICE_START_MINUS_24H',
          hoursBeforeService: this.responseDeadlineHoursBeforeService,
        },
      },
    };
  }

  async listMyAttendance(actor: JwtPayload, query: MySchedulesQueryDto) {
    const servantId = await this.requireLinkedServant(actor);
    const now = new Date();
    const [attendances, futureSlots] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          servantId,
          service: {
            ...(query.startDate ? { serviceDate: { gte: new Date(query.startDate) } } : {}),
            ...(query.endDate
              ? {
                  serviceDate: {
                    ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                    lte: new Date(query.endDate),
                  },
                }
              : {}),
          },
        },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              type: true,
              serviceDate: true,
              startTime: true,
              status: true,
              locked: true,
              canceled: true,
            },
          },
        },
        orderBy: [{ service: { serviceDate: 'desc' } }, { createdAt: 'desc' }],
      }),
      this.prisma.scheduleSlot.findMany({
        where: {
          assignedServantId: servantId,
          churchId: actor.churchId ?? undefined,
          deletedAt: null,
          service: {
            serviceDate: { gte: now },
          },
        },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              type: true,
              serviceDate: true,
              startTime: true,
              status: true,
              locked: true,
              canceled: true,
            },
          },
          ministry: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          responsibility: { select: { id: true, title: true } },
        },
        orderBy: [{ service: { serviceDate: 'asc' } }, { position: 'asc' }],
      }),
    ]);

    const history = attendances.map((item) => ({
      id: item.id,
      slotId: null,
      serviceId: item.serviceId,
      serviceTitle: item.service.title,
      serviceType: item.service.type,
      serviceDate: item.service.serviceDate,
      startTime: item.service.startTime,
      attendanceStatus: item.status,
      justification: item.justification,
      notes: item.notes,
      serviceLocked: item.service.locked,
      serviceCanceled: item.service.canceled,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const attendanceByServiceId = new Map(history.map((item) => [item.serviceId, item]));
    const upcoming = futureSlots.map((slot) => {
      const existing = attendanceByServiceId.get(slot.serviceId);
      return {
        slotId: slot.id,
        serviceId: slot.serviceId,
        serviceTitle: slot.service.title,
        serviceType: slot.service.type,
        serviceDate: slot.service.serviceDate,
        startTime: slot.service.startTime,
        ministryName: slot.ministry.name,
        teamName: slot.team?.name ?? null,
        responsibilityName: slot.responsibility?.title ?? slot.functionName,
        attendanceStatus: existing?.attendanceStatus ?? AttendanceStatus.UNKNOWN,
        serviceLocked: slot.service.locked,
        serviceCanceled: slot.service.canceled,
      };
    });

    return {
      upcoming,
      history,
      summary: {
        total: history.length,
        present: history.filter((item) => attendancePositiveStatuses().includes(item.attendanceStatus)).length,
        absent: history.filter((item) => attendanceAbsenceStatuses().includes(item.attendanceStatus)).length,
        justified: history.filter((item) => attendanceJustifiedAbsenceStatuses().includes(item.attendanceStatus))
          .length,
      },
      meta: {
        hasDeadlinePolicy: true,
      },
    };
  }

  async listMyNotifications(actor: JwtPayload, query: ListNotificationsQueryDto) {
    return this.notificationsService.findAll(actor, query);
  }

  async readMyNotification(actor: JwtPayload, notificationId: string) {
    this.assertPastorReadOnly(actor);
    return this.notificationsService.markRead(notificationId, actor.sub);
  }

  async getMyAvailability(actor: JwtPayload) {
    const servantId = this.requireServant(actor);

    const records = await this.prisma.servantAvailability.findMany({
      where: { servantId },
      orderBy: [{ dayOfWeek: 'asc' }, { shift: 'asc' }],
    });

    return {
      data: records.map((record) => ({
        id: record.id,
        dayOfWeek: record.dayOfWeek,
        shift: record.shift,
        available: record.available,
        notes: record.notes,
      })),
    };
  }

  async putMyAvailability(actor: JwtPayload, dto: PutMyAvailabilityDto) {
    this.assertPastorReadOnly(actor);
    const servantId = this.requireServant(actor);

    const deduplicated = new Map<string, { dayOfWeek: number; shift: Shift; available: boolean; notes?: string }>();
    for (const item of dto.items) {
      const key = `${item.dayOfWeek}:${item.shift}`;
      deduplicated.set(key, {
        dayOfWeek: item.dayOfWeek,
        shift: item.shift,
        available: item.available,
        notes: item.notes?.trim() || undefined,
      });
    }

    const nextValues = [...deduplicated.values()];

    await this.prisma.$transaction(async (tx) => {
      await tx.servantAvailability.deleteMany({ where: { servantId } });
      await tx.servantAvailability.createMany({
        data: nextValues.map((item) => ({
          servantId,
          dayOfWeek: item.dayOfWeek,
          shift: item.shift,
          available: item.available,
          notes: item.notes,
        })),
      });
    });

    return this.getMyAvailability(actor);
  }

  async respondMySchedule(actor: JwtPayload, scheduleId: string, dto: RespondMyScheduleDto) {
    this.assertPastorReadOnly(actor);
    const servantId = this.requireServant(actor);

    if (
      dto.responseStatus !== ScheduleResponseStatus.CONFIRMED &&
      dto.responseStatus !== ScheduleResponseStatus.DECLINED
    ) {
      throw new BadRequestException('responseStatus must be CONFIRMED or DECLINED');
    }

    const declineReason = dto.declineReason?.trim();
    if (dto.responseStatus === ScheduleResponseStatus.DECLINED && !declineReason) {
      throw new BadRequestException('declineReason is required when declining schedule presence');
    }

    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        servantId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule assignment not found');
    }

    if (schedule.status === ScheduleStatus.CANCELLED) {
      throw new ForbiddenException('Cannot respond to a cancelled schedule assignment');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          responseStatus: dto.responseStatus,
          responseAt: new Date(),
          declineReason: dto.responseStatus === ScheduleResponseStatus.DECLINED ? declineReason : null,
          status:
            dto.responseStatus === ScheduleResponseStatus.CONFIRMED
              ? ScheduleStatus.CONFIRMED
              : schedule.status,
        },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              serviceDate: true,
              startTime: true,
            },
          },
          ministry: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.scheduleResponseHistory.create({
        data: {
          scheduleId,
          responseStatus: dto.responseStatus,
          declineReason: dto.responseStatus === ScheduleResponseStatus.DECLINED ? declineReason : null,
          respondedByUserId: actor.sub,
        },
      });

      await tx.scheduleSlot.updateMany({
        where: { scheduleId },
        data: {
          status:
            dto.responseStatus === ScheduleResponseStatus.CONFIRMED
              ? ScheduleSlotStatus.CONFIRMED
              : ScheduleSlotStatus.DECLINED,
          confirmationStatus:
            dto.responseStatus === ScheduleResponseStatus.CONFIRMED
              ? ScheduleSlotConfirmationStatus.CONFIRMED
              : ScheduleSlotConfirmationStatus.DECLINED,
        },
      });

      return next;
    });

    await this.auditService.log({
      action:
        dto.responseStatus === ScheduleResponseStatus.CONFIRMED
          ? AuditAction.SLOT_CONFIRMED
          : AuditAction.SLOT_DECLINED,
      entity: 'Schedule',
      entityId: scheduleId,
      userId: actor.sub,
      metadata: {
        responseStatus: dto.responseStatus,
        declineReason: declineReason ?? null,
      },
    });

    await this.eventBus.emit({
      name:
        dto.responseStatus === ScheduleResponseStatus.CONFIRMED
          ? 'SLOT_CONFIRMED'
          : 'SLOT_DECLINED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      payload: {
        scheduleId,
        responseStatus: dto.responseStatus,
      },
    });

    return {
      id: updated.id,
      assignmentStatus: updated.status,
      responseStatus: updated.responseStatus,
      responseAt: updated.responseAt,
      declineReason: updated.declineReason,
      service: updated.service,
      ministry: updated.ministry,
    };
  }

  async respondMyScheduleSlot(actor: JwtPayload, dto: RespondMyScheduleSlotDto) {
    this.assertPastorReadOnly(actor);
    const servantId = this.requireServant(actor);
    const declineReason = dto.declineReason?.trim();
    if (dto.response === MyScheduleResponse.DECLINED && !declineReason) {
      throw new BadRequestException('declineReason is required when declining schedule');
    }

    const slot = await this.prisma.scheduleSlot.findFirst({
      where: {
        id: dto.slotId,
        assignedServantId: servantId,
        churchId: actor.churchId ?? undefined,
        deletedAt: null,
      },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            serviceDate: true,
            startTime: true,
            status: true,
            locked: true,
            canceled: true,
          },
        },
      },
    });
    if (!slot) {
      throw new NotFoundException('Schedule slot not found for this servant');
    }
    if (!slot.assignedServantId || slot.assignedServantId !== servantId) {
      throw new ForbiddenException('You are no longer assigned to this slot');
    }
    if (
      slot.service.locked ||
      slot.service.status === 'FINALIZADO' ||
      slot.service.status === 'CANCELADO' ||
      slot.service.canceled
    ) {
      throw new ForbiddenException('Cannot respond: worship service is closed or finished');
    }
    if (slot.confirmationStatus !== ScheduleSlotConfirmationStatus.PENDING) {
      throw new BadRequestException('This slot is no longer pending response');
    }
    const responseDeadline = this.computeResponseDeadline(slot.service.serviceDate, slot.service.startTime);
    if (responseDeadline && new Date() > responseDeadline) {
      throw new ForbiddenException('Response deadline has expired for this schedule');
    }

    if (dto.response === MyScheduleResponse.ACCEPTED) {
      const nextSlot = await this.schedulesService.confirmSchedule(slot.id, actor);
      return {
        slotId: nextSlot.id,
        confirmationStatus: nextSlot.confirmationStatus,
        slotStatus: nextSlot.status,
      };
    }

    const nextSlot = await this.schedulesService.declineSchedule(slot.id, actor, declineReason);
    await this.notifyCoordinationAboutDecline({
      churchId: slot.churchId,
      ministryId: slot.ministryId,
      serviceId: slot.serviceId,
      serviceTitle: slot.service.title,
      slotId: slot.id,
      declineReason: declineReason ?? null,
    });

    return {
      slotId: nextSlot.id,
      confirmationStatus: nextSlot.confirmationStatus,
      slotStatus: nextSlot.status,
    };
  }

  private async requireLinkedServant(actor: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { servantId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.servantId) {
      throw new ForbiddenException('This account is not linked to a servant');
    }

    return user.servantId;
  }

  private requireServant(actor: JwtPayload) {
    if (actor.role !== Role.SERVO) {
      throw new ForbiddenException('This endpoint is only available for SERVO role');
    }

    if (!actor.servantId) {
      throw new ForbiddenException('SERVO user must be linked to a servant');
    }

    return actor.servantId;
  }

  private assertPastorReadOnly(actor: JwtPayload) {
    if (actor.role === Role.PASTOR) {
      throw new ForbiddenException('PASTOR profile is read-only for data mutations');
    }
  }

  private computeResponseDeadline(serviceDate: Date, startTime: string) {
    const [hourPart, minutePart] = startTime.split(':');
    const hour = Number(hourPart ?? 0);
    const minute = Number(minutePart ?? 0);
    const date = new Date(serviceDate);
    date.setUTCHours(hour, minute, 0, 0);
    date.setUTCHours(date.getUTCHours() - this.responseDeadlineHoursBeforeService);
    return date;
  }

  private async notifyCoordinationAboutDecline(params: {
    churchId: string;
    ministryId: string;
    serviceId: string;
    serviceTitle: string;
    slotId: string;
    declineReason: string | null;
  }) {
    const recipients = await this.prisma.user.findMany({
      where: {
        churchId: params.churchId,
        status: 'ACTIVE',
        role: {
          in: [Role.ADMIN, Role.COORDENADOR, Role.SUPER_ADMIN],
        },
      },
      select: { id: true },
    });
    if (!recipients.length) {
      return;
    }
    await this.notificationsService.createMany(
      recipients.map((recipient) => ({
        userId: recipient.id,
        type: 'SCHEDULE_DECLINED',
        title: `Recusa de escala: ${params.serviceTitle}`,
        message: params.declineReason
          ? `Um servo recusou a escala. Motivo: ${params.declineReason}`
          : 'Um servo recusou a escala e requer substituicao.',
        link: '/schedules',
        metadata: {
          serviceId: params.serviceId,
          slotId: params.slotId,
          ministryId: params.ministryId,
        },
      })),
    );
  }
}


