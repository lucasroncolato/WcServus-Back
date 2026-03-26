import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  ScheduleResponseStatus,
  ScheduleStatus,
  ServantStatus,
  Shift,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListNotificationsQueryDto } from '../notifications/dto/list-notifications-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { MySchedulesQueryDto } from './dto/my-schedules-query.dto';
import { PutMyAvailabilityDto } from './dto/put-my-availability.dto';
import { RespondMyScheduleDto } from './dto/respond-my-schedule.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateMyServantDto } from './dto/update-my-servant.dto';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
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
            mainSectorId: true,
            mainSector: {
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
      sectorId: profile.servant?.mainSectorId ?? null,
      teamId: profile.servant?.teamId ?? null,
      sectorName: profile.servant?.mainSector?.name ?? null,
      teamName: profile.servant?.team?.name ?? null,
      sectorIds: profile.servant?.mainSectorId ? [profile.servant.mainSectorId] : [],
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
            mainSector: profile.servant.mainSector,
          }
        : null,
    };
  }

  async updateProfile(actor: JwtPayload, dto: UpdateMeDto) {
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
        mainSector: {
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
        mainSector: {
          select: { id: true, name: true },
        },
      },
    });

    return { data: updated };
  }

  async listMySchedules(actor: JwtPayload, query: MySchedulesQueryDto) {
    const servantId = await this.requireLinkedServant(actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const includePast = query.includePast ?? true;

    const now = new Date();
    const where: Prisma.ScheduleWhereInput = {
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
    };

    if (!query.startDate && !query.endDate && !includePast) {
      where.service = { serviceDate: { gte: now } };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.schedule.findMany({
        where,
        include: {
          service: true,
          sector: {
            select: {
              id: true,
              name: true,
            },
          },
          servant: {
            select: {
              teamId: true,
              team: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ service: { serviceDate: 'asc' } }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        serviceId: item.serviceId,
        sectorId: item.sectorId,
        teamId: item.servant?.teamId ?? null,
        teamName: item.servant?.team?.name ?? null,
        assignmentStatus: item.status,
        responseStatus: item.responseStatus,
        responseAt: item.responseAt,
        declineReason: item.declineReason,
        service: {
          id: item.service.id,
          title: item.service.title,
          type: item.service.type,
          serviceDate: item.service.serviceDate,
          startTime: item.service.startTime,
          status: item.service.status,
        },
        sector: item.sector,
      })),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async listMyAttendance(actor: JwtPayload, query: MySchedulesQueryDto) {
    const servantId = await this.requireLinkedServant(actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AttendanceWhereInput = {
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
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        include: {
          service: {
            select: {
              id: true,
              title: true,
              type: true,
              serviceDate: true,
              startTime: true,
            },
          },
        },
        orderBy: [{ service: { serviceDate: 'desc' } }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data: items,
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async listMyNotifications(actor: JwtPayload, query: ListNotificationsQueryDto) {
    return this.notificationsService.findAll(actor.sub, query);
  }

  async readMyNotification(actor: JwtPayload, notificationId: string) {
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
          sector: {
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

      return next;
    });

    return {
      id: updated.id,
      assignmentStatus: updated.status,
      responseStatus: updated.responseStatus,
      responseAt: updated.responseAt,
      declineReason: updated.declineReason,
      service: updated.service,
      sector: updated.sector,
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
}
