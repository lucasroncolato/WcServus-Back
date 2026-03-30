import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, Role, ServiceTemplateRecurrenceType } from '@prisma/client';
import { EventBusService } from 'src/common/events/event-bus.service';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { SchedulesService } from '../schedules/schedules.service';
import { CreateServiceTemplateDto } from './dto/create-service-template.dto';
import { GenerateTemplateOccurrencesDto } from './dto/generate-template-occurrences.dto';
import { ListServiceTemplatesQueryDto } from './dto/list-service-templates-query.dto';

@Injectable()
export class ServiceTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantIntegrity: TenantIntegrityService,
    private readonly schedulesService: SchedulesService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateServiceTemplateDto, actor: JwtPayload) {
    const churchId = this.tenantIntegrity.assertActorChurch(actor);

    const created = await this.prisma.$transaction(async (tx) => {
      const template = await tx.serviceTemplate.create({
        data: {
          churchId,
          name: dto.name,
          type: dto.type,
          recurrenceType: dto.recurrenceType,
          weekday: dto.weekday,
          startTime: dto.startTime,
          duration: dto.duration,
          active: dto.active ?? true,
          generateAheadDays: dto.generateAheadDays ?? 30,
        },
      });

      if (dto.slots?.length) {
        await tx.serviceTemplateSlot.createMany({
          data: dto.slots.map((slot) => ({
            templateId: template.id,
            ministryId: slot.ministryId,
            teamId: slot.teamId,
            responsibilityId: slot.responsibilityId,
            quantity: slot.quantity ?? 1,
            requiredTalentId: slot.requiredTalentId,
          })),
        });
      }

      return tx.serviceTemplate.findUniqueOrThrow({
        where: { id: template.id },
        include: { slots: true },
      });
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ServiceTemplate',
      entityId: created.id,
      userId: actor.sub,
      churchId,
      metadata: {
        name: created.name,
        recurrenceType: created.recurrenceType,
        slotsCount: created.slots.length,
      },
    });

    return created;
  }

  async findAll(query: ListServiceTemplatesQueryDto, actor: JwtPayload) {
    const churchId = this.tenantIntegrity.assertActorChurch(actor);
    return this.prisma.serviceTemplate.findMany({
      where: {
        churchId,
        ...(typeof query.active === 'boolean' ? { active: query.active } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.recurrenceType ? { recurrenceType: query.recurrenceType } : {}),
      },
      include: {
        slots: {
          include: {
            ministry: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
            responsibility: { select: { id: true, title: true, functionName: true } },
          },
          orderBy: [{ ministry: { name: 'asc' } }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async generateOccurrencesFromTemplate(
    templateId: string,
    dto: GenerateTemplateOccurrencesDto,
    actor: JwtPayload,
  ) {
    const churchId = this.tenantIntegrity.assertActorChurch(actor);
    const template = await this.prisma.serviceTemplate.findUnique({
      where: { id: templateId },
      include: { slots: true },
    });

    if (!template) {
      throw new NotFoundException('Service template not found');
    }

    this.tenantIntegrity.assertSameChurch(churchId, template.churchId, 'Service template');

    if (!template.active) {
      throw new BadRequestException('Inactive template cannot generate occurrences');
    }

    const start = dto.startDate ? this.startOfDay(new Date(dto.startDate)) : this.startOfDay(new Date());
    const aheadDays = dto.aheadDays ?? template.generateAheadDays;
    const end = new Date(start);
    end.setDate(end.getDate() + aheadDays);

    const occurrences = this.resolveOccurrenceDates(template.recurrenceType, template.weekday, start, end);

    const result = {
      templateId,
      generated: 0,
      skipped: 0,
      services: [] as Array<{ id: string; serviceDate: Date; created: boolean }>,
    };

    for (const occurrenceDate of occurrences) {
      const existing = await this.prisma.worshipService.findFirst({
        where: {
          churchId,
          templateId,
          serviceDate: occurrenceDate,
          startTime: template.startTime,
        },
        select: { id: true },
      });

      if (existing) {
        result.skipped += 1;
        result.services.push({ id: existing.id, serviceDate: occurrenceDate, created: false });
        continue;
      }

      const created = await this.prisma.worshipService.create({
        data: {
          churchId,
          templateId,
          title: template.name,
          type: template.type,
          serviceDate: occurrenceDate,
          startTime: template.startTime,
          locked: false,
          canceled: false,
        },
      });

      await this.schedulesService.generateSlotsFromTemplate(created.id, actor);

      result.generated += 1;
      result.services.push({ id: created.id, serviceDate: occurrenceDate, created: true });
    }

    await this.auditService.log({
      action: AuditAction.GENERATE_SCHEDULE,
      entity: 'ServiceTemplate',
      entityId: templateId,
      userId: actor.sub,
      churchId,
      metadata: {
        generated: result.generated,
        skipped: result.skipped,
        aheadDays,
      },
    });

    await this.eventBus.emit({
      name: 'SCHEDULE_GENERATED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId,
      payload: {
        templateId,
        generated: result.generated,
        skipped: result.skipped,
      },
    });

    return result;
  }

  private startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private resolveOccurrenceDates(
    recurrenceType: ServiceTemplateRecurrenceType,
    weekday: number,
    start: Date,
    end: Date,
  ) {
    if (weekday < 0 || weekday > 6) {
      return [];
    }

    const first = this.findNextWeekday(start, weekday);
    if (!first || first > end) {
      return [];
    }

    if (recurrenceType === ServiceTemplateRecurrenceType.NONE) {
      return [first];
    }

    if (recurrenceType === ServiceTemplateRecurrenceType.WEEKLY) {
      const dates: Date[] = [];
      for (let cursor = new Date(first); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
        dates.push(this.startOfDay(new Date(cursor)));
      }
      return dates;
    }

    const dates: Date[] = [];
    const monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (monthCursor <= end) {
      const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
      const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
      const base = monthStart < start ? start : monthStart;
      const match = this.findNextWeekday(base, weekday);
      if (match && match <= monthEnd && match <= end) {
        dates.push(this.startOfDay(match));
      }
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }
    return dates;
  }

  private findNextWeekday(start: Date, weekday: number) {
    const cursor = this.startOfDay(new Date(start));
    for (let i = 0; i < 7; i += 1) {
      if (cursor.getDay() === weekday) {
        return cursor;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return null;
  }
}
