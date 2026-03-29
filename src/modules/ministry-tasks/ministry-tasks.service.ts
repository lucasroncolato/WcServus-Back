import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  AlertStatus,
  AuditAction,
  MinistryTaskAssigneeRole,
  MinistryTaskAssignmentChangeType,
  MinistryTaskChecklistItemStatus,
  MinistryTaskOccurrenceCriticality,
  MinistryTaskOccurrencePriority,
  MinistryTaskOccurrenceStatus,
  GamificationActionType,
  MinistryTaskReallocationMode,
  MinistryTaskReallocationStatus,
  MinistryTaskRecurrenceType,
  PastoralVisitStatus,
  Prisma,
  Role,
  ServantStatus,
  TrainingStatus,
} from '@prisma/client';
import { assertMinistryAccess, resolveScopedMinistryIds } from 'src/common/auth/access-scope';
import { EventBusService } from 'src/common/events/event-bus.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssignMinistryTaskOccurrenceDto } from './dto/assign-ministry-task-occurrence.dto';
import { CancelMinistryTaskOccurrenceDto } from './dto/cancel-ministry-task-occurrence.dto';
import { CreateMinistryTaskTemplateChecklistItemDto, CreateMinistryTaskTemplateDto } from './dto/create-ministry-task-template.dto';
import { CreateMinistryTaskOccurrenceDto } from './dto/create-ministry-task-occurrence.dto';
import { CompleteMinistryTaskOccurrenceDto } from './dto/complete-ministry-task-occurrence.dto';
import { GenerateMinistryTaskOccurrencesDto } from './dto/generate-ministry-task-occurrences.dto';
import { ListMinistryTaskOccurrencesQueryDto } from './dto/list-ministry-task-occurrences-query.dto';
import { ListMinistryTaskTemplatesQueryDto } from './dto/list-ministry-task-templates-query.dto';
import { UpdateMinistryTaskChecklistDto } from './dto/update-ministry-task-checklist.dto';
import { UpdateMinistryTaskTemplateDto } from './dto/update-ministry-task-template.dto';
import { ReassignMinistryTaskOccurrenceDto } from './dto/reassign-ministry-task-occurrence.dto';
import { ReallocateFromRemovedServantDto } from './dto/reallocate-from-removed-servant.dto';
import { AddMinistryTaskOccurrenceAssigneeDto } from './dto/add-ministry-task-occurrence-assignee.dto';
import { MinistryTaskDashboardQueryDto } from './dto/ministry-task-dashboard-query.dto';

@Injectable()
export class MinistryTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly gamificationService: GamificationService,
    private readonly eventBus: EventBusService,
  ) {}

  async listTemplates(query: ListMinistryTaskTemplatesQueryDto, actor: JwtPayload) {
    this.assertTemplateView(actor);
    const where: Prisma.MinistryTaskTemplateWhereInput = {
      deletedAt: null,
      ministryId: query.ministryId,
      recurrenceType: query.recurrenceType,
      active: query.active === undefined ? undefined : query.active === 'true',
      ...(actor.churchId ? { churchId: actor.churchId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: 'insensitive' } },
              { description: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (actor.role === Role.COORDENADOR) {
      where.ministryId = where.ministryId ?? { in: await resolveScopedMinistryIds(this.prisma, actor) };
    }
    const data = await this.prisma.ministryTaskTemplate.findMany({
      where,
      include: { ministry: { select: { id: true, name: true } }, checklistItems: { orderBy: { position: 'asc' } } },
      orderBy: [{ ministry: { name: 'asc' } }, { name: 'asc' }],
    });
    return { data };
  }

  async getTemplate(id: string, actor: JwtPayload) {
    this.assertTemplateView(actor);
    const data = await this.prisma.ministryTaskTemplate.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: { ministry: { select: { id: true, name: true } }, checklistItems: { orderBy: { position: 'asc' } } },
    });
    if (!data) throw new NotFoundException('Task template not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, data.ministryId);
    return { data };
  }

  async createTemplate(dto: CreateMinistryTaskTemplateDto, actor: JwtPayload) {
    this.assertTemplateManage(actor);
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, dto.ministryId);
    await this.ensureMinistry(dto.ministryId, actor.churchId ?? null);
    const data = await this.prisma.ministryTaskTemplate.create({
      data: {
        churchId: actor.churchId ?? null,
        ministryId: dto.ministryId,
        name: dto.name,
        description: dto.description,
        recurrenceType: dto.recurrenceType ?? MinistryTaskRecurrenceType.MANUAL,
        recurrenceConfig: dto.recurrenceConfig as Prisma.InputJsonValue | undefined,
        linkedToServiceType: dto.linkedToServiceType,
        active: dto.active ?? true,
        assigneeMode: dto.assigneeMode ?? 'OPTIONAL',
        reallocationMode: dto.reallocationMode ?? MinistryTaskReallocationMode.MANUAL,
        maxAssignmentsPerServantPerMonth: dto.maxAssignmentsPerServantPerMonth,
        createdBy: actor.sub,
        checklistItems: { create: this.normalizeTemplateChecklist(dto.checklistItems) },
      },
      include: { ministry: { select: { id: true, name: true } }, checklistItems: { orderBy: { position: 'asc' } } },
    });
    await this.auditService.log({ action: AuditAction.MINISTRY_TASK_TEMPLATE_CREATED, entity: 'MinistryTaskTemplate', entityId: data.id, userId: actor.sub });
    await this.eventBus.emit({ name: 'MINISTRY_TASK_TEMPLATE_CREATED', occurredAt: new Date(), actorUserId: actor.sub, churchId: data.churchId, payload: { templateId: data.id } });
    return { data };
  }

  async updateTemplate(id: string, dto: UpdateMinistryTaskTemplateDto, actor: JwtPayload) {
    this.assertTemplateManage(actor);
    const existing = await this.prisma.ministryTaskTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Task template not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, existing.ministryId);
    if (dto.ministryId && dto.ministryId !== existing.ministryId) {
      if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, dto.ministryId);
      await this.ensureMinistry(dto.ministryId, actor.churchId ?? null);
    }
    const data = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ministryTaskTemplate.update({
        where: { id },
        data: {
          ministryId: dto.ministryId,
          name: dto.name,
          description: dto.description,
          recurrenceType: dto.recurrenceType,
          recurrenceConfig: dto.recurrenceConfig as Prisma.InputJsonValue | undefined,
          linkedToServiceType: dto.linkedToServiceType,
          active: dto.active,
          assigneeMode: dto.assigneeMode,
          reallocationMode: dto.reallocationMode,
          maxAssignmentsPerServantPerMonth: dto.maxAssignmentsPerServantPerMonth,
        },
      });
      if (dto.checklistItems) {
        await tx.ministryTaskTemplateChecklistItem.deleteMany({ where: { templateId: id } });
        if (dto.checklistItems.length) {
          await tx.ministryTaskTemplateChecklistItem.createMany({
            data: this.normalizeTemplateChecklist(dto.checklistItems).map((item) => ({ ...item, templateId: id })),
          });
        }
      }
      return tx.ministryTaskTemplate.findUniqueOrThrow({ where: { id: updated.id }, include: { ministry: true, checklistItems: { orderBy: { position: 'asc' } } } });
    });
    await this.auditService.log({ action: AuditAction.MINISTRY_TASK_TEMPLATE_UPDATED, entity: 'MinistryTaskTemplate', entityId: id, userId: actor.sub });
    return { data };
  }

  async removeTemplate(id: string, actor: JwtPayload) {
    this.assertTemplateManage(actor);
    const existing = await this.prisma.ministryTaskTemplate.findFirst({ where: { id, deletedAt: null }, select: { id: true, ministryId: true } });
    if (!existing) throw new NotFoundException('Task template not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, existing.ministryId);
    await this.prisma.ministryTaskTemplate.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: actor.sub, active: false } });
    return { message: 'Task template removed successfully' };
  }

  async listOccurrences(query: ListMinistryTaskOccurrencesQueryDto, actor: JwtPayload) {
    this.assertOccurrenceView(actor);
    const where: Prisma.MinistryTaskOccurrenceWhereInput = {
      deletedAt: null,
      ministryId: query.ministryId,
      templateId: query.templateId,
      assignedServantId: query.assignedServantId,
      serviceId: query.serviceId,
      status: query.status,
      reallocationStatus: query.reallocationStatus,
      priority: query.priority,
      criticality: query.criticality,
      ...(actor.churchId ? { churchId: actor.churchId } : {}),
      dueAt:
        query.overdue || query.dueSoon
          ? {
              ...(query.overdue ? { lt: new Date() } : {}),
              ...(query.dueSoon ? { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) } : {}),
            }
          : undefined,
      scheduledFor: query.startDate || query.endDate ? { gte: query.startDate ? new Date(query.startDate) : undefined, lte: query.endDate ? new Date(query.endDate) : undefined } : undefined,
    };
    if (actor.role === Role.COORDENADOR) where.ministryId = where.ministryId ?? { in: await resolveScopedMinistryIds(this.prisma, actor) };
    if (query.unassigned) where.assignedServantId = null;
    if (query.overdue) where.status = { notIn: [MinistryTaskOccurrenceStatus.COMPLETED, MinistryTaskOccurrenceStatus.CANCELLED] };
    if (actor.role === Role.SERVO) {
      const servantId = (await this.resolveActorServantId(actor)) ?? '__none__';
      where.OR = [
        { assignedServantId: servantId },
        { assignees: { some: { servantId, active: true } } },
      ];
    }
    const data = await this.prisma.ministryTaskOccurrence.findMany({ where, include: this.occurrenceInclude(), orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }] });
    return { data: data.map((item) => this.withProgress(item)) };
  }

  async getOccurrence(id: string, actor: JwtPayload) {
    this.assertOccurrenceView(actor);
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: this.occurrenceInclude(),
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    await this.assertOccurrenceAccess(occurrence, actor, false);
    return { data: this.withProgress(occurrence) };
  }

  async createOccurrence(dto: CreateMinistryTaskOccurrenceDto, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const template = await this.prisma.ministryTaskTemplate.findFirst({ where: { id: dto.templateId, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) }, include: { checklistItems: true } });
    if (!template) throw new NotFoundException('Task template not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, template.ministryId);
    if (template.assigneeMode === 'REQUIRED' && !dto.assignedServantId) throw new BadRequestException('This template requires an assignee');
    if (dto.serviceId) {
      const service = await this.ensureService(dto.serviceId, actor.churchId ?? null);
      if (template.linkedToServiceType && service.type !== template.linkedToServiceType) {
        throw new BadRequestException('Service type does not match template linked service type');
      }
    }
    if (dto.assignedServantId) await this.assertServantEligible({ templateId: template.id, ministryId: template.ministryId, serviceId: dto.serviceId ?? null, servantId: dto.assignedServantId, scheduledFor: new Date(dto.scheduledFor), occurrenceId: null });
    for (const supportServantId of dto.supportServantIds ?? []) {
      if (!supportServantId || supportServantId === dto.assignedServantId) continue;
      await this.assertServantEligible({
        templateId: template.id,
        ministryId: template.ministryId,
        serviceId: dto.serviceId ?? null,
        servantId: supportServantId,
        scheduledFor: new Date(dto.scheduledFor),
        occurrenceId: null,
      });
    }
    const data = await this.prisma.ministryTaskOccurrence.create({
      data: {
        churchId: actor.churchId ?? null,
        templateId: template.id,
        ministryId: template.ministryId,
        serviceId: dto.serviceId,
        scheduledFor: new Date(dto.scheduledFor),
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        slaMinutes: dto.slaMinutes,
        priority: dto.priority ?? MinistryTaskOccurrencePriority.MEDIUM,
        criticality: dto.criticality ?? MinistryTaskOccurrenceCriticality.MEDIUM,
        assignedServantId: dto.assignedServantId,
        originAssignedServantId: dto.assignedServantId ?? null,
        reallocationMode: template.reallocationMode ?? MinistryTaskReallocationMode.MANUAL,
        status: dto.assignedServantId ? MinistryTaskOccurrenceStatus.ASSIGNED : MinistryTaskOccurrenceStatus.PENDING,
        notes: dto.notes,
        checklistItems: { create: template.checklistItems.map((i) => ({ templateChecklistItemId: i.id, label: i.label, description: i.description, position: i.position, required: i.required, status: MinistryTaskChecklistItemStatus.PENDING })) },
        assignees: {
          create: [
            ...(dto.assignedServantId
              ? [{ servantId: dto.assignedServantId, role: MinistryTaskAssigneeRole.PRIMARY, createdBy: actor.sub }]
              : []),
            ...[...(dto.supportServantIds ?? [])]
              .filter((servantId) => servantId && servantId !== dto.assignedServantId)
              .map((servantId) => ({ servantId, role: MinistryTaskAssigneeRole.SUPPORT, createdBy: actor.sub })),
          ],
        },
      },
      include: this.occurrenceInclude(),
    });
    const normalized = await this.recalculateStatus(data.id, actor.sub);
    await this.auditService.log({ action: AuditAction.MINISTRY_TASK_OCCURRENCE_CREATED, entity: 'MinistryTaskOccurrence', entityId: data.id, userId: actor.sub });
    await this.eventBus.emit({ name: 'MINISTRY_TASK_OCCURRENCE_CREATED', occurredAt: new Date(), actorUserId: actor.sub, churchId: data.churchId, payload: { occurrenceId: data.id } });
    if (data.assignedServantId) await this.notifyAssigned(data.assignedServantId, data.id);
    return { data: this.withProgress(normalized) };
  }

  async generateOccurrences(templateId: string, dto: GenerateMinistryTaskOccurrencesDto, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const template = await this.prisma.ministryTaskTemplate.findFirst({
      where: { id: templateId, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: { checklistItems: true },
    });
    if (!template) throw new NotFoundException('Task template not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, template.ministryId);
    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    if (from > to) throw new BadRequestException('fromDate must be before toDate');
    const occurrences = await this.recurrenceDates(template, from, to);
    const createdIds: string[] = [];
    for (const item of occurrences) {
      const exists = await this.prisma.ministryTaskOccurrence.findFirst({ where: { deletedAt: null, templateId: template.id, serviceId: item.serviceId, scheduledFor: item.scheduledFor }, select: { id: true } });
      if (exists) continue;
      const created = await this.prisma.ministryTaskOccurrence.create({
        data: {
          churchId: template.churchId,
          templateId: template.id,
          ministryId: template.ministryId,
          serviceId: item.serviceId,
          scheduledFor: item.scheduledFor,
          checklistItems: { create: template.checklistItems.map((i) => ({ templateChecklistItemId: i.id, label: i.label, description: i.description, position: i.position, required: i.required, status: MinistryTaskChecklistItemStatus.PENDING })) },
        },
        select: { id: true },
      });
      createdIds.push(created.id);
    }
    return { created: createdIds.length, occurrenceIds: createdIds };
  }

  async assignOccurrence(id: string, dto: AssignMinistryTaskOccurrenceDto, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, occurrence.ministryId);
    await this.assertServantEligible({ templateId: occurrence.templateId, ministryId: occurrence.ministryId, serviceId: occurrence.serviceId, servantId: dto.servantId, scheduledFor: occurrence.scheduledFor, occurrenceId: occurrence.id });
    const data = await this.applyAssignmentChange({
      occurrenceId: id,
      fromServantId: occurrence.assignedServantId,
      toServantId: dto.servantId,
      actorId: actor.sub,
      churchId: occurrence.churchId,
      mode: 'assign',
      preserveProgress: true,
      reason: dto.reason,
      metadata: { source: 'assign-endpoint' },
    });
    return { data: this.withProgress(data) };
  }

  async reassignOccurrence(id: string, dto: ReassignMinistryTaskOccurrenceDto, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: this.occurrenceInclude(),
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, occurrence.ministryId);
    if (!occurrence.assignedServantId) throw new BadRequestException('Task has no current assignee');
    if (occurrence.assignedServantId === dto.newAssignedServantId) return { data: this.withProgress(occurrence) };
    await this.assertServantEligible({
      templateId: occurrence.templateId,
      ministryId: occurrence.ministryId,
      serviceId: occurrence.serviceId,
      servantId: dto.newAssignedServantId,
      scheduledFor: occurrence.scheduledFor,
      occurrenceId: occurrence.id,
    });

    const preserveProgress = dto.preserveProgress ?? true;
    const data = await this.applyAssignmentChange({
      occurrenceId: occurrence.id,
      fromServantId: occurrence.assignedServantId,
      toServantId: dto.newAssignedServantId,
      actorId: actor.sub,
      churchId: occurrence.churchId,
      mode: 'reassign',
      preserveProgress,
      reason: dto.reason,
      metadata: { source: 'manual-reassign' },
    });

    if (!preserveProgress) {
      await this.prisma.ministryTaskOccurrenceChecklistItem.updateMany({
        where: { occurrenceId: occurrence.id },
        data: { status: MinistryTaskChecklistItemStatus.PENDING, checkedAt: null, checkedBy: null, notes: null },
      });
    }

    return { data: this.withProgress(await this.recalculateStatus(occurrence.id, actor.sub)) };
  }

  async addAssignee(id: string, dto: AddMinistryTaskOccurrenceAssigneeDto, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: this.occurrenceInclude(),
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, occurrence.ministryId);
    await this.assertServantEligible({
      templateId: occurrence.templateId,
      ministryId: occurrence.ministryId,
      serviceId: occurrence.serviceId,
      servantId: dto.servantId,
      scheduledFor: occurrence.scheduledFor,
      occurrenceId: occurrence.id,
    });
    const existing = occurrence.assignees.find(
      (item: any) => item.servantId === dto.servantId && item.role === dto.role && item.active,
    );
    if (existing) return { data: this.withProgress(occurrence) };

    await this.prisma.ministryTaskOccurrenceAssignee.create({
      data: {
        occurrenceId: id,
        servantId: dto.servantId,
        role: dto.role,
        createdBy: actor.sub,
      },
    });
    if (dto.role === MinistryTaskAssigneeRole.PRIMARY) {
      await this.prisma.ministryTaskOccurrence.update({
        where: { id },
        data: { assignedServantId: dto.servantId },
      });
    }
    await this.auditService.log({
      action: AuditAction.MINISTRY_TASK_ASSIGNEE_ADDED,
      entity: 'MinistryTaskOccurrence',
      entityId: id,
      userId: actor.sub,
      metadata: { servantId: dto.servantId, role: dto.role },
    });
    await this.eventBus.emit({
      name: 'MINISTRY_TASK_ASSIGNEE_ADDED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: actor.churchId ?? null,
      payload: { occurrenceId: id, servantId: dto.servantId, role: dto.role },
    });
    await this.notifyAssigned(dto.servantId, id);
    const data = await this.prisma.ministryTaskOccurrence.findUniqueOrThrow({
      where: { id },
      include: this.occurrenceInclude(),
    });
    return { data: this.withProgress(data) };
  }

  async removeAssignee(id: string, servantId: string, role: MinistryTaskAssigneeRole | undefined, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: this.occurrenceInclude(),
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, occurrence.ministryId);

    const match = occurrence.assignees.find(
      (item: any) => item.servantId === servantId && item.active && (!role || item.role === role),
    );
    if (!match) throw new NotFoundException('Assignee not found');

    await this.prisma.ministryTaskOccurrenceAssignee.update({
      where: { id: match.id },
      data: { active: false, removedAt: new Date(), removedBy: actor.sub },
    });
    if (match.role === MinistryTaskAssigneeRole.PRIMARY) {
      const nextPrimary = occurrence.assignees.find(
        (item: any) => item.active && item.id !== match.id && item.role === MinistryTaskAssigneeRole.SUPPORT,
      );
      await this.prisma.ministryTaskOccurrence.update({
        where: { id },
        data: { assignedServantId: nextPrimary?.servantId ?? null },
      });
    }
    await this.auditService.log({
      action: AuditAction.MINISTRY_TASK_ASSIGNEE_REMOVED,
      entity: 'MinistryTaskOccurrence',
      entityId: id,
      userId: actor.sub,
      metadata: { servantId, role: match.role },
    });
    await this.eventBus.emit({
      name: 'MINISTRY_TASK_ASSIGNEE_REMOVED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: actor.churchId ?? null,
      payload: { occurrenceId: id, servantId, role: match.role },
    });

    const data = await this.prisma.ministryTaskOccurrence.findUniqueOrThrow({
      where: { id },
      include: this.occurrenceInclude(),
    });
    return { data: this.withProgress(data) };
  }

  async dashboard(query: MinistryTaskDashboardQueryDto, actor: JwtPayload, ministryId?: string) {
    this.assertOccurrenceView(actor);
    const period = this.resolveDashboardPeriod(query);
    const now = new Date();
    const baseWhere: Prisma.MinistryTaskOccurrenceWhereInput = {
      deletedAt: null,
      ...(actor.churchId ? { churchId: actor.churchId } : {}),
      ...(ministryId ? { ministryId } : {}),
      scheduledFor: { gte: period.start, lte: period.end },
    };
    if (actor.role === Role.COORDENADOR && !ministryId) {
      baseWhere.ministryId = { in: await resolveScopedMinistryIds(this.prisma, actor) };
    } else if (actor.role === Role.COORDENADOR && ministryId) {
      await assertMinistryAccess(this.prisma, actor, ministryId);
    }
    if (actor.role === Role.SERVO) {
      const servantId = (await this.resolveActorServantId(actor)) ?? '__none__';
      baseWhere.OR = [{ assignedServantId: servantId }, { assignees: { some: { servantId, active: true } } }];
    }

    const [total, overdue, withoutAssignee, pendingReallocation, completed, byMinistry] = await Promise.all([
      this.prisma.ministryTaskOccurrence.count({ where: baseWhere }),
      this.prisma.ministryTaskOccurrence.count({
        where: {
          ...baseWhere,
          dueAt: { lt: now },
          status: { notIn: [MinistryTaskOccurrenceStatus.COMPLETED, MinistryTaskOccurrenceStatus.CANCELLED] },
        },
      }),
      this.prisma.ministryTaskOccurrence.count({ where: { ...baseWhere, assignedServantId: null } }),
      this.prisma.ministryTaskOccurrence.count({
        where: { ...baseWhere, reallocationStatus: MinistryTaskReallocationStatus.PENDING_REALLOCATION },
      }),
      this.prisma.ministryTaskOccurrence.count({
        where: { ...baseWhere, status: MinistryTaskOccurrenceStatus.COMPLETED },
      }),
      this.prisma.ministryTaskOccurrence.groupBy({
        by: ['ministryId'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const ministries = await this.prisma.ministry.findMany({
      where: { id: { in: byMinistry.map((item) => item.ministryId) } },
      select: { id: true, name: true },
    });
    const ministryNames = new Map(ministries.map((m) => [m.id, m.name]));

    return {
      totalPending: total - completed,
      totalOverdue: overdue,
      totalWithoutAssignee: withoutAssignee,
      totalPendingReallocation: pendingReallocation,
      totalCompleted: completed,
      byMinistry: byMinistry
        .map((item) => ({
          ministryId: item.ministryId,
          ministryName: ministryNames.get(item.ministryId) ?? 'Ministerio',
          total: item._count._all,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  async updateChecklist(id: string, dto: UpdateMinistryTaskChecklistDto, actor: JwtPayload) {
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: this.occurrenceInclude(),
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    await this.assertOccurrenceAccess(occurrence, actor, true);
    const validItemIds = new Set(occurrence.checklistItems.map((i) => i.id));
    const invalid = dto.items.find((i) => !validItemIds.has(i.itemId));
    if (invalid) throw new BadRequestException(`Checklist item ${invalid.itemId} does not belong to occurrence`);
    await this.prisma.$transaction(dto.items.map((item) => this.prisma.ministryTaskOccurrenceChecklistItem.update({ where: { id: item.itemId }, data: { status: item.status, notes: item.notes, checkedAt: item.status === MinistryTaskChecklistItemStatus.PENDING ? null : new Date(), checkedBy: item.status === MinistryTaskChecklistItemStatus.PENDING ? null : actor.sub } })));
    await this.prisma.ministryTaskOccurrence.update({
      where: { id },
      data: {
        startedAt: occurrence.startedAt ?? new Date(),
        lastProgressAt: new Date(),
      },
    });
    const data = await this.recalculateStatus(id, actor.sub);
    await this.auditService.log({ action: AuditAction.MINISTRY_TASK_PROGRESS_UPDATED, entity: 'MinistryTaskOccurrence', entityId: id, userId: actor.sub });
    await this.eventBus.emit({ name: 'MINISTRY_TASK_PROGRESS_UPDATED', occurredAt: new Date(), actorUserId: actor.sub, churchId: data.churchId, payload: { occurrenceId: id, progressPercent: data.progressPercent } });
    return { data: this.withProgress(data) };
  }

  async completeOccurrence(id: string, dto: CompleteMinistryTaskOccurrenceDto, actor: JwtPayload) {
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: this.occurrenceInclude(),
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    await this.assertOccurrenceAccess(occurrence, actor, true);
    const progress = this.progress(occurrence.checklistItems);
    if (progress.totalRequired > 0 && progress.doneRequired < progress.totalRequired) throw new UnprocessableEntityException({ code: 'CHECKLIST_INCOMPLETE', message: 'Required checklist items must be done before completion' });
    const data = await this.prisma.ministryTaskOccurrence.update({ where: { id }, data: { status: MinistryTaskOccurrenceStatus.COMPLETED, progressPercent: 100, completedAt: new Date(), completedBy: actor.sub, notes: dto.notes ?? occurrence.notes }, include: this.occurrenceInclude() });
    await this.auditService.log({ action: AuditAction.MINISTRY_TASK_COMPLETED, entity: 'MinistryTaskOccurrence', entityId: id, userId: actor.sub });
    await this.eventBus.emit({ name: 'MINISTRY_TASK_COMPLETED', occurredAt: new Date(), actorUserId: actor.sub, churchId: data.churchId, payload: { occurrenceId: id } });
    await this.notifyCompleted(data.id, data.churchId, data.ministryId);
    const rewardedServantId = data.assignedServantId ?? (await this.resolveActorServantId(actor));
    if (rewardedServantId) {
      await this.gamificationService.awardPoints({
        servantId: rewardedServantId,
        churchId: data.churchId,
        ministryId: data.ministryId,
        actionType: GamificationActionType.TASK_COMPLETED,
        referenceId: `task:${data.id}:completed`,
        actorUserId: actor.sub,
      });
      if (progress.totalItems > 0 && progress.doneItems >= progress.totalItems) {
        await this.gamificationService.awardPoints({
          servantId: rewardedServantId,
          churchId: data.churchId,
          ministryId: data.ministryId,
          actionType: GamificationActionType.CHECKLIST_PERFECT,
          referenceId: `task:${data.id}:checklist-perfect`,
          actorUserId: actor.sub,
        });
      }
      if (data.dueAt && data.completedAt && data.completedAt.getTime() <= data.dueAt.getTime()) {
        await this.gamificationService.awardPoints({
          servantId: rewardedServantId,
          churchId: data.churchId,
          ministryId: data.ministryId,
          actionType: GamificationActionType.TASK_BEFORE_DUE,
          referenceId: `task:${data.id}:before-due`,
          actorUserId: actor.sub,
        });
      }
    }
    return { data: this.withProgress(data) };
  }

  async cancelOccurrence(id: string, dto: CancelMinistryTaskOccurrenceDto, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
    });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    if (actor.role === Role.COORDENADOR) await assertMinistryAccess(this.prisma, actor, occurrence.ministryId);
    const data = await this.prisma.ministryTaskOccurrence.update({ where: { id }, data: { status: MinistryTaskOccurrenceStatus.CANCELLED, notes: dto.reason ? [occurrence.notes, `Cancelamento: ${dto.reason}`].filter(Boolean).join('\n') : occurrence.notes }, include: this.occurrenceInclude() });
    await this.auditService.log({ action: AuditAction.MINISTRY_TASK_CANCELLED, entity: 'MinistryTaskOccurrence', entityId: id, userId: actor.sub });
    await this.eventBus.emit({ name: 'MINISTRY_TASK_CANCELLED', occurredAt: new Date(), actorUserId: actor.sub, churchId: data.churchId, payload: { occurrenceId: id } });
    return { data: this.withProgress(data) };
  }

  async reallocateFromRemovedServant(dto: ReallocateFromRemovedServantDto, actor: JwtPayload) {
    this.assertOccurrenceManage(actor);
    const mode = dto.mode ?? MinistryTaskReallocationMode.MANUAL;
    const service = await this.ensureService(dto.serviceId, actor.churchId ?? null);

    const impacted = await this.prisma.ministryTaskOccurrence.findMany({
      where: {
        deletedAt: null,
        serviceId: dto.serviceId,
        assignedServantId: dto.removedServantId,
        status: { notIn: [MinistryTaskOccurrenceStatus.CANCELLED, MinistryTaskOccurrenceStatus.COMPLETED] },
        ...(actor.churchId ? { churchId: actor.churchId } : {}),
      },
      include: this.occurrenceInclude(),
    });

    if (!impacted.length) {
      return { impacted: 0, reassigned: 0, unassigned: 0, mode };
    }

    const ministries = [...new Set(impacted.map((item) => item.ministryId))];
    if (actor.role === Role.COORDENADOR) {
      for (const ministryId of ministries) {
        await assertMinistryAccess(this.prisma, actor, ministryId);
      }
    }

    await this.auditService.log({
      action: AuditAction.MINISTRY_TASK_REALLOCATION_REQUESTED,
      entity: 'MinistryTaskOccurrence',
      entityId: dto.serviceId,
      userId: actor.sub,
      metadata: {
        serviceId: dto.serviceId,
        removedServantId: dto.removedServantId,
        mode,
        impactedCount: impacted.length,
      },
    });
    await this.eventBus.emit({
      name: 'MINISTRY_TASK_REALLOCATION_REQUESTED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: actor.churchId ?? null,
      payload: { serviceId: dto.serviceId, removedServantId: dto.removedServantId, mode, impactedCount: impacted.length },
    });

    if (mode === MinistryTaskReallocationMode.MANUAL) {
      return this.reallocateManual(impacted, dto, actor.sub);
    }
    if (mode === MinistryTaskReallocationMode.AUTO_EQUAL_DISTRIBUTION) {
      return this.reallocateAutomaticEqual(impacted, dto, actor.sub);
    }
    if (mode === MinistryTaskReallocationMode.UNASSIGN) {
      return this.unassignImpactedOccurrences(impacted, dto, actor.sub);
    }

    throw new BadRequestException(`Reallocation mode ${mode} is not supported in this phase`);
  }

  private occurrenceInclude() {
    return {
      template: { include: { checklistItems: { orderBy: { position: 'asc' as const } } } },
      ministry: { select: { id: true, name: true } },
      service: { select: { id: true, title: true, serviceDate: true, startTime: true } },
      assignedServant: { select: { id: true, name: true } },
      originAssignedServant: { select: { id: true, name: true } },
      lastReassignedByUser: { select: { id: true, name: true } },
      checklistItems: { orderBy: { position: 'asc' as const } },
      assignees: {
        where: { active: true },
        orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
        select: { id: true, servantId: true, role: true, active: true, createdAt: true },
      },
      assignmentHistory: {
        orderBy: { createdAt: 'desc' as const },
        take: 15,
        include: {
          fromServant: { select: { id: true, name: true } },
          toServant: { select: { id: true, name: true } },
          changedByUser: { select: { id: true, name: true } },
        },
      },
    } satisfies Prisma.MinistryTaskOccurrenceInclude;
  }

  private withProgress(occurrence: any) {
    return { ...occurrence, progress: this.progress(occurrence.checklistItems) };
  }

  private progress(items: Array<{ status: MinistryTaskChecklistItemStatus; required: boolean }>) {
    const totalItems = items.length;
    const totalRequired = items.filter((i) => i.required).length;
    const doneItems = items.filter((i) => i.status === MinistryTaskChecklistItemStatus.DONE).length;
    const doneRequired = items.filter((i) => i.required && i.status === MinistryTaskChecklistItemStatus.DONE).length;
    const percent = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);
    return { totalItems, totalRequired, doneItems, doneRequired, percent };
  }

  private async recalculateStatus(id: string, actorId: string) {
    const occurrence = await this.prisma.ministryTaskOccurrence.findUnique({ where: { id }, include: this.occurrenceInclude() });
    if (!occurrence) throw new NotFoundException('Task occurrence not found');
    if (occurrence.status === MinistryTaskOccurrenceStatus.CANCELLED) return occurrence;
    const p = this.progress(occurrence.checklistItems);
    const dueReference = occurrence.dueAt ?? occurrence.scheduledFor;
    const overdue = new Date(dueReference).getTime() < Date.now();
    let status: MinistryTaskOccurrenceStatus = occurrence.assignedServantId ? MinistryTaskOccurrenceStatus.ASSIGNED : MinistryTaskOccurrenceStatus.PENDING;
    if ((p.totalRequired > 0 && p.doneRequired >= p.totalRequired) || (p.totalRequired === 0 && p.totalItems > 0 && p.doneItems >= p.totalItems)) status = MinistryTaskOccurrenceStatus.COMPLETED;
    else if (p.doneItems > 0) status = MinistryTaskOccurrenceStatus.IN_PROGRESS;
    else if (overdue) status = MinistryTaskOccurrenceStatus.OVERDUE;
    return this.prisma.ministryTaskOccurrence.update({
      where: { id },
      data: { status, progressPercent: p.percent, completedAt: status === MinistryTaskOccurrenceStatus.COMPLETED ? occurrence.completedAt ?? new Date() : null, completedBy: status === MinistryTaskOccurrenceStatus.COMPLETED ? occurrence.completedBy ?? actorId : null },
      include: this.occurrenceInclude(),
    });
  }

  private normalizeTemplateChecklist(items?: CreateMinistryTaskTemplateChecklistItemDto[]) {
    return (items ?? []).map((item, index) => ({ label: item.label, description: item.description, position: item.position ?? index + 1, required: item.required ?? true }));
  }

  private async resolveActorServantId(actor: JwtPayload) {
    if (actor.servantId) return actor.servantId;
    return (await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { servantId: true } }))?.servantId ?? null;
  }

  private async assertOccurrenceAccess(
    occurrence: {
      ministryId: string;
      assignedServantId: string | null;
      assignees?: Array<{ servantId: string; active?: boolean }>;
    },
    actor: JwtPayload,
    writable: boolean,
  ) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) return;
    if (actor.role === Role.COORDENADOR) return assertMinistryAccess(this.prisma, actor, occurrence.ministryId);
    if (actor.role === Role.PASTOR) {
      if (writable) throw new ForbiddenException('Pastor cannot perform operational updates');
      return;
    }
    if (actor.role === Role.SERVO) {
      const servantId = await this.resolveActorServantId(actor);
      const isPrimary = servantId && servantId === occurrence.assignedServantId;
      const isSupport = Boolean(
        servantId &&
          occurrence.assignees?.some((item) => item.servantId === servantId && item.active !== false),
      );
      if (!servantId || (!isPrimary && !isSupport))
        throw new ForbiddenException('You can only access your assigned tasks');
      return;
    }
    throw new ForbiddenException('Permission denied');
  }

  private async assertServantEligible(input: { templateId: string; ministryId: string; serviceId: string | null; servantId: string; scheduledFor: Date; occurrenceId: string | null }) {
    const servant = await this.prisma.servant.findFirst({ where: { id: input.servantId, status: ServantStatus.ATIVO, deletedAt: null }, include: { servantMinistries: { where: { ministryId: input.ministryId }, select: { trainingStatus: true, ministryId: true } } } });
    if (!servant) throw new UnprocessableEntityException({ code: 'SERVANT_INACTIVE', message: 'Servant is not active' });
    const belongs = servant.mainMinistryId === input.ministryId || servant.servantMinistries.some((i) => i.ministryId === input.ministryId);
    if (!belongs) throw new UnprocessableEntityException({ code: 'SERVANT_OUTSIDE_MINISTRY', message: 'Servant must belong to task ministry' });
    const trained = servant.servantMinistries.some((i) => i.trainingStatus === TrainingStatus.COMPLETED) || (servant.mainMinistryId === input.ministryId && servant.trainingStatus === TrainingStatus.COMPLETED);
    if (!trained) throw new UnprocessableEntityException({ code: 'SERVANT_TRAINING_PENDING', message: 'Servant training is pending' });
    const [openVisits, openAlerts] = await Promise.all([
      this.prisma.pastoralVisit.count({ where: { servantId: input.servantId, deletedAt: null, status: { in: [PastoralVisitStatus.ABERTA, PastoralVisitStatus.EM_ANDAMENTO] } } }),
      this.prisma.pastoralAlert.count({ where: { servantId: input.servantId, deletedAt: null, status: AlertStatus.OPEN } }),
    ]);
    if (openVisits > 0 || openAlerts > 0) throw new UnprocessableEntityException({ code: 'SERVANT_PASTORAL_PENDING', message: 'Servant has active pastoral pending' });
    const max = (await this.prisma.ministryTaskTemplate.findUnique({ where: { id: input.templateId }, select: { maxAssignmentsPerServantPerMonth: true } }))?.maxAssignmentsPerServantPerMonth;
    if (max) {
      const start = new Date(Date.UTC(input.scheduledFor.getUTCFullYear(), input.scheduledFor.getUTCMonth(), 1));
      const end = new Date(Date.UTC(input.scheduledFor.getUTCFullYear(), input.scheduledFor.getUTCMonth() + 1, 0, 23, 59, 59));
      const count = await this.prisma.ministryTaskOccurrence.count({ where: { deletedAt: null, id: input.occurrenceId ? { not: input.occurrenceId } : undefined, templateId: input.templateId, assignedServantId: input.servantId, status: { not: MinistryTaskOccurrenceStatus.CANCELLED }, scheduledFor: { gte: start, lte: end } } });
      if (count >= max) throw new UnprocessableEntityException({ code: 'MAX_ASSIGNMENTS_PER_MONTH_REACHED', message: 'Monthly assignment limit reached' });
    }
    if (input.serviceId) {
      const conflict = await this.prisma.schedule.count({ where: { deletedAt: null, serviceId: input.serviceId, servantId: input.servantId } });
      if (conflict > 0) throw new UnprocessableEntityException({ code: 'SERVICE_TIME_CONFLICT', message: 'Servant already assigned in this service' });
      const taskConflict = await this.prisma.ministryTaskOccurrence.count({
        where: {
          deletedAt: null,
          id: input.occurrenceId ? { not: input.occurrenceId } : undefined,
          serviceId: input.serviceId,
          assignedServantId: input.servantId,
          status: { notIn: [MinistryTaskOccurrenceStatus.CANCELLED, MinistryTaskOccurrenceStatus.COMPLETED] },
        },
      });
      if (taskConflict > 0) {
        throw new UnprocessableEntityException({
          code: 'SERVICE_TIME_CONFLICT',
          message: 'Servant already assigned in another task for this service',
        });
      }
    }
  }

  private async recurrenceDates(template: any, from: Date, to: Date) {
    if (template.recurrenceType === MinistryTaskRecurrenceType.MANUAL) return [];
    if (template.recurrenceType === MinistryTaskRecurrenceType.EVERY_SERVICE) {
      const services = await this.prisma.worshipService.findMany({ where: { deletedAt: null, churchId: template.churchId ?? undefined, type: template.linkedToServiceType ?? undefined, serviceDate: { gte: from, lte: to } }, select: { id: true, serviceDate: true }, orderBy: [{ serviceDate: 'asc' }] });
      return services.map((s) => ({ scheduledFor: s.serviceDate, serviceId: s.id as string | null }));
    }
    if (
      template.recurrenceType === MinistryTaskRecurrenceType.FIRST_SERVICE_OF_MONTH ||
      template.recurrenceType === MinistryTaskRecurrenceType.LAST_SERVICE_OF_MONTH
    ) {
      const services = await this.prisma.worshipService.findMany({
        where: {
          deletedAt: null,
          churchId: template.churchId ?? undefined,
          type: template.linkedToServiceType ?? undefined,
          serviceDate: { gte: from, lte: to },
        },
        select: { id: true, serviceDate: true },
        orderBy: [{ serviceDate: 'asc' }],
      });
      const grouped = new Map<string, Array<{ id: string; serviceDate: Date }>>();
      for (const service of services) {
        const key = `${service.serviceDate.getUTCFullYear()}-${service.serviceDate.getUTCMonth()}`;
        const list = grouped.get(key) ?? [];
        list.push(service);
        grouped.set(key, list);
      }
      return [...grouped.values()].map((items) => {
        const chosen =
          template.recurrenceType === MinistryTaskRecurrenceType.FIRST_SERVICE_OF_MONTH
            ? items[0]
            : items[items.length - 1];
        return { scheduledFor: chosen.serviceDate, serviceId: chosen.id as string | null };
      });
    }
    const dates: Array<{ scheduledFor: Date; serviceId: string | null }> = [];
    const cursor = new Date(from);
    const interval = template.recurrenceType === MinistryTaskRecurrenceType.WEEKLY ? 7 : template.recurrenceType === MinistryTaskRecurrenceType.MONTHLY ? 30 : Math.max(1, Number((template.recurrenceConfig ?? {}).intervalDays ?? 1));
    while (cursor <= to) {
      dates.push({ scheduledFor: new Date(cursor), serviceId: null });
      cursor.setUTCDate(cursor.getUTCDate() + interval);
    }
    return dates;
  }

  private async notifyAssigned(servantId: string, occurrenceId: string) {
    await this.notificationsService.notifyServantLinkedUser(servantId, { type: 'MINISTRY_TASK_ASSIGNED', title: 'Nova tarefa ministerial atribuida', message: 'Uma tarefa foi atribuida para voce.', link: '/ministry-tasks/my', metadata: { occurrenceId } });
  }

  private async notifyUnassigned(servantId: string, occurrenceId: string) {
    await this.notificationsService.notifyServantLinkedUser(servantId, {
      type: 'MINISTRY_TASK_UNASSIGNED_AFTER_SCALE_CHANGE',
      title: 'Tarefa removida da sua lista',
      message: 'Uma tarefa foi removida apos alteracao de escala.',
      link: '/ministry-tasks/my',
      metadata: { occurrenceId },
    });
  }

  private async notifyCompleted(occurrenceId: string, churchId: string | null, ministryId: string) {
    const users = await this.prisma.user.findMany({ where: { status: 'ACTIVE', churchId: churchId ?? undefined, OR: [{ role: Role.ADMIN }, { role: Role.SUPER_ADMIN }, { role: Role.COORDENADOR, coordinatedMinistries: { some: { id: ministryId } } }, { role: Role.COORDENADOR, scopeBindings: { some: { ministryId } } }] }, select: { id: true } });
    await this.notificationsService.createMany(users.map((u) => ({ userId: u.id, type: 'MINISTRY_TASK_COMPLETED', title: 'Tarefa ministerial concluida', message: 'Uma ocorrencia de tarefa foi concluida.', link: '/ministry-tasks', metadata: { occurrenceId } })));
  }

  async runRecurringGenerationJob(input: { dryRun?: boolean; daysAhead?: number; actorUserId?: string } = {}) {
    const dryRun = input.dryRun === true;
    const now = new Date();
    const end = new Date(now.getTime() + (input.daysAhead ?? 30) * 24 * 60 * 60 * 1000);
    const templates = await this.prisma.ministryTaskTemplate.findMany({
      where: {
        deletedAt: null,
        active: true,
        recurrenceType: { not: MinistryTaskRecurrenceType.MANUAL },
      },
      include: { checklistItems: true },
    });

    let created = 0;
    let skipped = 0;
    for (const template of templates) {
      const dates = await this.recurrenceDates(template, now, end);
      for (const item of dates) {
        const existing = await this.prisma.ministryTaskOccurrence.findFirst({
          where: {
            deletedAt: null,
            templateId: template.id,
            serviceId: item.serviceId,
            scheduledFor: item.scheduledFor,
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        if (dryRun) {
          created += 1;
          continue;
        }
        await this.prisma.ministryTaskOccurrence.create({
          data: {
            churchId: template.churchId,
            templateId: template.id,
            ministryId: template.ministryId,
            serviceId: item.serviceId,
            scheduledFor: item.scheduledFor,
            dueAt: item.scheduledFor,
            priority: MinistryTaskOccurrencePriority.MEDIUM,
            criticality: MinistryTaskOccurrenceCriticality.MEDIUM,
            checklistItems: {
              create: template.checklistItems.map((i) => ({
                templateChecklistItemId: i.id,
                label: i.label,
                description: i.description,
                position: i.position,
                required: i.required,
                status: MinistryTaskChecklistItemStatus.PENDING,
              })),
            },
          },
        });
        created += 1;
      }
    }

    if (!dryRun) {
      await this.auditService.log({
        action: AuditAction.MINISTRY_TASK_RECURRING_GENERATED,
        entity: 'MinistryTaskOccurrence',
        entityId: `recurrence-job:${now.toISOString()}`,
        userId: input.actorUserId,
        metadata: { templates: templates.length, created, skipped, daysAhead: input.daysAhead ?? 30 },
      });
      await this.eventBus.emit({
        name: 'MINISTRY_TASK_RECURRING_GENERATED',
        occurredAt: new Date(),
        actorUserId: input.actorUserId,
        payload: { templates: templates.length, created, skipped },
      });
    }

    return { templatesProcessed: templates.length, created, skipped, dryRun };
  }

  async markOverdueAndDueSoon() {
    const now = new Date();
    const soonLimit = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const [overdueCandidates, dueSoonCandidates] = await Promise.all([
      this.prisma.ministryTaskOccurrence.findMany({
        where: {
          deletedAt: null,
          dueAt: { lt: now },
          status: { in: [MinistryTaskOccurrenceStatus.PENDING, MinistryTaskOccurrenceStatus.ASSIGNED, MinistryTaskOccurrenceStatus.IN_PROGRESS] },
        },
        select: { id: true, churchId: true },
        take: 200,
      }),
      this.prisma.ministryTaskOccurrence.findMany({
        where: {
          deletedAt: null,
          dueAt: { gte: now, lte: soonLimit },
          status: { in: [MinistryTaskOccurrenceStatus.PENDING, MinistryTaskOccurrenceStatus.ASSIGNED, MinistryTaskOccurrenceStatus.IN_PROGRESS] },
        },
        select: { id: true, churchId: true },
        take: 200,
      }),
    ]);

    for (const item of overdueCandidates) {
      await this.prisma.ministryTaskOccurrence.update({
        where: { id: item.id },
        data: { status: MinistryTaskOccurrenceStatus.OVERDUE },
      });
      await this.eventBus.emit({
        name: 'MINISTRY_TASK_OVERDUE',
        occurredAt: new Date(),
        churchId: item.churchId,
        payload: { occurrenceId: item.id },
      });
    }
    for (const item of dueSoonCandidates) {
      await this.eventBus.emit({
        name: 'MINISTRY_TASK_DUE_SOON',
        occurredAt: new Date(),
        churchId: item.churchId,
        payload: { occurrenceId: item.id },
      });
    }

    return { overdueMarked: overdueCandidates.length, dueSoonEmitted: dueSoonCandidates.length };
  }

  private async applyAssignmentChange(input: {
    occurrenceId: string;
    fromServantId: string | null;
    toServantId: string | null;
    actorId: string;
    churchId: string | null;
    mode: 'assign' | 'reassign' | 'auto' | 'unassign';
    preserveProgress: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    const data = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ministryTaskOccurrence.update({
        where: { id: input.occurrenceId },
        data: {
          assignedServantId: input.toServantId,
          status: input.toServantId ? MinistryTaskOccurrenceStatus.ASSIGNED : MinistryTaskOccurrenceStatus.PENDING,
          reallocationStatus: input.toServantId
            ? MinistryTaskReallocationStatus.REASSIGNED
            : MinistryTaskReallocationStatus.UNASSIGNED,
          lastReassignedAt: new Date(),
          lastReassignedBy: input.actorId,
          originAssignedServantId: input.fromServantId ?? undefined,
        },
        include: this.occurrenceInclude(),
      });

      if (input.fromServantId && input.fromServantId !== input.toServantId) {
        await tx.ministryTaskOccurrenceAssignee.updateMany({
          where: {
            occurrenceId: input.occurrenceId,
            servantId: input.fromServantId,
            role: MinistryTaskAssigneeRole.PRIMARY,
            active: true,
          },
          data: { active: false, removedAt: new Date(), removedBy: input.actorId },
        });
      }
      if (input.toServantId) {
        await tx.ministryTaskOccurrenceAssignee.upsert({
          where: {
            occurrenceId_servantId_role: {
              occurrenceId: input.occurrenceId,
              servantId: input.toServantId,
              role: MinistryTaskAssigneeRole.PRIMARY,
            },
          },
          update: { active: true, removedAt: null, removedBy: null },
          create: {
            occurrenceId: input.occurrenceId,
            servantId: input.toServantId,
            role: MinistryTaskAssigneeRole.PRIMARY,
            createdBy: input.actorId,
          },
        });
      }

      await tx.ministryTaskOccurrenceAssignmentHistory.create({
        data: {
          occurrenceId: input.occurrenceId,
          fromServantId: input.fromServantId,
          toServantId: input.toServantId,
          changedBy: input.actorId,
          preserveProgress: input.preserveProgress,
          reason: input.reason,
          changeType:
            input.mode === 'assign'
              ? MinistryTaskAssignmentChangeType.ASSIGN
              : input.mode === 'auto'
                ? MinistryTaskAssignmentChangeType.REASSIGN_AUTO
                : input.mode === 'unassign'
                  ? MinistryTaskAssignmentChangeType.UNASSIGN
                  : MinistryTaskAssignmentChangeType.REASSIGN_MANUAL,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      return updated;
    });

    if (input.fromServantId && input.fromServantId !== input.toServantId) {
      await this.notifyUnassigned(input.fromServantId, input.occurrenceId);
    }
    if (input.toServantId) {
      await this.notifyAssigned(input.toServantId, input.occurrenceId);
    }

    const auditAction =
      input.mode === 'assign'
        ? AuditAction.MINISTRY_TASK_ASSIGNED
        : input.mode === 'auto'
          ? AuditAction.MINISTRY_TASK_REALLOCATED_AUTOMATICALLY
          : input.mode === 'unassign'
            ? AuditAction.MINISTRY_TASK_UNASSIGNED_AFTER_SCALE_CHANGE
            : AuditAction.MINISTRY_TASK_REASSIGNED;
    await this.auditService.log({
      action: auditAction,
      entity: 'MinistryTaskOccurrence',
      entityId: input.occurrenceId,
      userId: input.actorId,
      before: { assignedServantId: input.fromServantId },
      after: {
        assignedServantId: input.toServantId,
        preserveProgress: input.preserveProgress,
      },
      metadata: { mode: input.mode, reason: input.reason, ...(input.metadata ?? {}) },
    });

    const eventName =
      input.mode === 'assign'
        ? 'MINISTRY_TASK_ASSIGNED'
        : input.mode === 'auto'
          ? 'MINISTRY_TASK_REALLOCATED_AUTOMATICALLY'
          : input.mode === 'unassign'
            ? 'MINISTRY_TASK_UNASSIGNED_AFTER_SCALE_CHANGE'
            : 'MINISTRY_TASK_REASSIGNED';
    await this.eventBus.emit({
      name: eventName,
      occurredAt: new Date(),
      actorUserId: input.actorId,
      churchId: input.churchId,
      payload: {
        occurrenceId: input.occurrenceId,
        fromServantId: input.fromServantId,
        toServantId: input.toServantId,
        reason: input.reason,
      },
    });

    return data;
  }

  private async reallocateManual(
    impacted: Array<any>,
    dto: ReallocateFromRemovedServantDto,
    actorId: string,
  ) {
    const manualAssignments = dto.manualAssignments ?? [];
    const map = new Map(manualAssignments.map((item) => [item.occurrenceId, item.newAssignedServantId]));
    let reassigned = 0;
    let unassigned = 0;
    const affected: string[] = [];

    for (const occurrence of impacted) {
      const nextServantId = map.get(occurrence.id) ?? null;
      if (nextServantId) {
        await this.assertServantEligible({
          templateId: occurrence.templateId,
          ministryId: occurrence.ministryId,
          serviceId: occurrence.serviceId,
          servantId: nextServantId,
          scheduledFor: occurrence.scheduledFor,
          occurrenceId: occurrence.id,
        });
      }
      await this.applyAssignmentChange({
        occurrenceId: occurrence.id,
        fromServantId: occurrence.assignedServantId,
        toServantId: nextServantId,
        actorId,
        churchId: occurrence.churchId,
        mode: nextServantId ? 'reassign' : 'unassign',
        preserveProgress: true,
        reason: dto.reason,
        metadata: { source: 'manual-reallocation' },
      });
      affected.push(occurrence.id);
      if (nextServantId) reassigned += 1;
      else unassigned += 1;
    }

    await this.eventBus.emit({
      name: 'MINISTRY_TASK_REALLOCATED_MANUALLY',
      occurredAt: new Date(),
      actorUserId: actorId,
      churchId: impacted[0]?.churchId ?? null,
      payload: {
        serviceId: dto.serviceId,
        removedServantId: dto.removedServantId,
        reassigned,
        unassigned,
      },
    });
    await this.auditService.log({
      action: AuditAction.MINISTRY_TASK_REALLOCATED_MANUALLY,
      entity: 'MinistryTaskOccurrence',
      entityId: dto.serviceId,
      userId: actorId,
      metadata: { serviceId: dto.serviceId, removedServantId: dto.removedServantId, reassigned, unassigned },
    });

    return { impacted: impacted.length, reassigned, unassigned, mode: MinistryTaskReallocationMode.MANUAL, occurrenceIds: affected };
  }

  private async reallocateAutomaticEqual(
    impacted: Array<any>,
    dto: ReallocateFromRemovedServantDto,
    actorId: string,
  ) {
    const serviceId = dto.serviceId;
    const serviceSchedules = await this.prisma.schedule.findMany({
      where: { deletedAt: null, serviceId, status: { not: 'CANCELLED' } },
      select: { servantId: true, ministryId: true },
    });
    const existingAssignments = await this.prisma.ministryTaskOccurrence.findMany({
      where: {
        deletedAt: null,
        serviceId,
        assignedServantId: { not: null },
        status: { notIn: [MinistryTaskOccurrenceStatus.CANCELLED, MinistryTaskOccurrenceStatus.COMPLETED] },
      },
      select: { id: true, ministryId: true, assignedServantId: true },
    });
    const currentLoadByServant = new Map<string, number>();
    for (const item of existingAssignments) {
      if (!item.assignedServantId) continue;
      currentLoadByServant.set(item.assignedServantId, (currentLoadByServant.get(item.assignedServantId) ?? 0) + 1);
    }

    let reassigned = 0;
    let unassigned = 0;
    const pendingIds: string[] = [];
    for (const occurrence of impacted.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())) {
      const candidateServants = serviceSchedules
        .filter((item) => item.ministryId === occurrence.ministryId)
        .map((item) => item.servantId)
        .filter((servantId) => servantId !== dto.removedServantId);
      const uniqueCandidates = [...new Set(candidateServants)];
      const eligibleCandidates: string[] = [];

      for (const candidateId of uniqueCandidates) {
        try {
          await this.assertServantEligible({
            templateId: occurrence.templateId,
            ministryId: occurrence.ministryId,
            serviceId: occurrence.serviceId,
            servantId: candidateId,
            scheduledFor: occurrence.scheduledFor,
            occurrenceId: occurrence.id,
          });
          eligibleCandidates.push(candidateId);
        } catch {
          continue;
        }
      }

      if (!eligibleCandidates.length) {
        await this.applyAssignmentChange({
          occurrenceId: occurrence.id,
          fromServantId: occurrence.assignedServantId,
          toServantId: null,
          actorId,
          churchId: occurrence.churchId,
          mode: 'unassign',
          preserveProgress: true,
          reason: dto.reason ?? 'No eligible servants available in schedule',
          metadata: { source: 'auto-equal-reallocation', noEligibleCandidates: true },
        });
        await this.prisma.ministryTaskOccurrence.update({
          where: { id: occurrence.id },
          data: { reallocationStatus: MinistryTaskReallocationStatus.PENDING_REALLOCATION },
        });
        pendingIds.push(occurrence.id);
        unassigned += 1;
        continue;
      }

      const chosen = eligibleCandidates
        .map((servantId) => ({
          servantId,
          load: currentLoadByServant.get(servantId) ?? 0,
        }))
        .sort((a, b) => (a.load !== b.load ? a.load - b.load : a.servantId.localeCompare(b.servantId)))[0];

      await this.applyAssignmentChange({
        occurrenceId: occurrence.id,
        fromServantId: occurrence.assignedServantId,
        toServantId: chosen.servantId,
        actorId,
        churchId: occurrence.churchId,
        mode: 'auto',
        preserveProgress: true,
        reason: dto.reason ?? 'Auto equal distribution after schedule change',
        metadata: { source: 'auto-equal-reallocation', chosenLoad: chosen.load },
      });
      currentLoadByServant.set(chosen.servantId, (currentLoadByServant.get(chosen.servantId) ?? 0) + 1);
      reassigned += 1;
    }

    await this.auditService.log({
      action: AuditAction.MINISTRY_TASK_REALLOCATED_AUTOMATICALLY,
      entity: 'MinistryTaskOccurrence',
      entityId: dto.serviceId,
      userId: actorId,
      metadata: {
        serviceId: dto.serviceId,
        removedServantId: dto.removedServantId,
        reassigned,
        unassigned,
        pendingReallocationIds: pendingIds,
      },
    });

    return {
      impacted: impacted.length,
      reassigned,
      unassigned,
      pendingReallocation: pendingIds.length,
      mode: MinistryTaskReallocationMode.AUTO_EQUAL_DISTRIBUTION,
      pendingReallocationIds: pendingIds,
    };
  }

  private async unassignImpactedOccurrences(
    impacted: Array<any>,
    dto: ReallocateFromRemovedServantDto,
    actorId: string,
  ) {
    let unassigned = 0;
    const occurrenceIds: string[] = [];
    for (const occurrence of impacted) {
      await this.applyAssignmentChange({
        occurrenceId: occurrence.id,
        fromServantId: occurrence.assignedServantId,
        toServantId: null,
        actorId,
        churchId: occurrence.churchId,
        mode: 'unassign',
        preserveProgress: true,
        reason: dto.reason ?? 'Unassigned after schedule change',
        metadata: { source: 'explicit-unassign' },
      });
      await this.prisma.ministryTaskOccurrence.update({
        where: { id: occurrence.id },
        data: { reallocationStatus: MinistryTaskReallocationStatus.UNASSIGNED },
      });
      unassigned += 1;
      occurrenceIds.push(occurrence.id);
    }
    return { impacted: impacted.length, reassigned: 0, unassigned, mode: MinistryTaskReallocationMode.UNASSIGN, occurrenceIds };
  }

  private assertTemplateView(actor: JwtPayload) {
    if (actor.role === Role.SERVO) throw new ForbiddenException('You do not have permission to view templates');
  }
  private assertTemplateManage(actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN && actor.role !== Role.COORDENADOR) throw new ForbiddenException('You do not have permission to manage templates');
  }
  private assertOccurrenceView(actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN && actor.role !== Role.PASTOR && actor.role !== Role.COORDENADOR && actor.role !== Role.SERVO) throw new ForbiddenException('You do not have permission to view occurrences');
  }
  private assertOccurrenceManage(actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN && actor.role !== Role.COORDENADOR) throw new ForbiddenException('You do not have permission to manage occurrences');
  }

  private async ensureMinistry(ministryId: string, churchId: string | null) {
    const ministry = await this.prisma.ministry.findFirst({
      where: { id: ministryId, deletedAt: null, ...(churchId ? { churchId } : {}) },
      select: { id: true },
    });
    if (!ministry) throw new NotFoundException('Ministry not found');
  }

  private async ensureService(serviceId: string, churchId: string | null) {
    const service = await this.prisma.worshipService.findFirst({
      where: { id: serviceId, deletedAt: null, ...(churchId ? { churchId } : {}) },
      select: { id: true, type: true },
    });
    if (!service) throw new NotFoundException('Worship service not found');
    return service;
  }

  private resolveDashboardPeriod(query: MinistryTaskDashboardQueryDto) {
    const now = new Date();
    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const end = query.endDate
      ? new Date(query.endDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { start, end };
  }
}
