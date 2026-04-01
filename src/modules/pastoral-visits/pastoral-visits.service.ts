import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AlertStatus,
  AuditAction,
  PastoralPriority,
  PastoralReasonType,
  PastoralFollowUpStatus,
  PastoralVisitStatus,
  Prisma,
} from '@prisma/client';
import {
  assertServantAccess,
  getPastoralVisitAccessWhere,
  getServantAccessWhere,
} from 'src/common/auth/access-scope';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventBusService } from 'src/common/events/event-bus.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompletePastoralFollowUpDto } from './dto/complete-pastoral-follow-up.dto';
import { CreatePastoralFollowUpDto } from './dto/create-pastoral-follow-up.dto';
import { CreatePastoralNoteDto } from './dto/create-pastoral-note.dto';
import { CreatePastoralVisitDto } from './dto/create-pastoral-visit.dto';
import { ListPastoralAlertsQueryDto } from './dto/list-pastoral-alerts-query.dto';
import { ListPastoralVisitsQueryDto } from './dto/list-pastoral-visits-query.dto';
import { ResolvePastoralAlertDto } from './dto/resolve-pastoral-alert.dto';
import { ResolvePastoralVisitDto } from './dto/resolve-pastoral-visit.dto';
import { UpdatePastoralVisitDto } from './dto/update-pastoral-visit.dto';

@Injectable()
export class PastoralVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantIntegrity: TenantIntegrityService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventBus: EventBusService,
    private readonly metrics?: AppMetricsService,
  ) {}

  private actorChurch(actor: JwtPayload) {
    return this.tenantIntegrity.assertActorChurch(actor);
  }

  private parseOptionalDate(input?: string) {
    if (!input) {
      return undefined;
    }
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new ForbiddenException('Invalid date format');
    }
    return date;
  }

  private async getPastoralVisitOrThrow(id: string, actor: JwtPayload) {
    const visit = await this.prisma.pastoralVisit.findUnique({
      where: { id },
      include: {
        servant: true,
      },
    });
    if (!visit) {
      throw new NotFoundException('Pastoral record not found');
    }

    this.tenantIntegrity.assertSameChurch(this.actorChurch(actor), visit.churchId, 'Pastoral record');
    await assertServantAccess(this.prisma, actor, visit.servantId);

    return visit;
  }

  async findAll(query: ListPastoralVisitsQueryDto, actor: JwtPayload) {
    return this.listRecords(query, actor);
  }

  async listRecords(query: ListPastoralVisitsQueryDto, actor: JwtPayload) {
    const scopeWhere = await getPastoralVisitAccessWhere(this.prisma, actor);
    const queryWhere: Prisma.PastoralVisitWhereInput = {
      status: query.status,
      servantId: query.servantId,
      priority: query.priority,
      reasonType: query.reasonType,
      deletedAt: null,
    };
    const where: Prisma.PastoralVisitWhereInput =
      scopeWhere !== undefined ? { AND: [queryWhere, scopeWhere] } : queryWhere;

    return this.prisma.pastoralVisit.findMany({
      where,
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
        pastoralNotes: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        pastoralFollowUps: {
          where: { deletedAt: null },
          include: {
            createdBy: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
          orderBy: { scheduledAt: 'asc' },
        },
      },
      orderBy: [{ priority: 'desc' }, { openedAt: 'desc' }],
    });
  }

  async create(dto: CreatePastoralVisitDto, actor: JwtPayload) {
    return this.createRecord(dto, actor);
  }

  async createRecord(dto: CreatePastoralVisitDto, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, dto.servantId);
    const actorChurchId = this.actorChurch(actor);

    const servant = await this.prisma.servant.findUnique({
      where: { id: dto.servantId },
      select: { id: true, churchId: true },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
    this.tenantIntegrity.assertSameChurch(actorChurchId, servant.churchId, 'Servant');

    const visit = await this.prisma.pastoralVisit.create({
      data: {
        servantId: dto.servantId,
        title: dto.title,
        reason: dto.reason,
        reasonType: dto.reasonType ?? 'OTHER',
        priority: dto.priority ?? 'MEDIUM',
        notes: dto.notes,
        createdByUserId: actor.sub,
        assignedToUserId: dto.assignedToUserId,
        churchId: actorChurchId,
        nextFollowUpAt: this.parseOptionalDate(dto.nextFollowUpAt),
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralVisit',
      entityId: visit.id,
      userId: actor.sub,
      metadata: {
        status: visit.status,
        priority: visit.priority,
        reasonType: visit.reasonType,
      },
    });

    await this.eventBus.emit({
      name: 'PASTORAL_PENDING_OPENED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: visit.churchId,
      payload: { pastoralVisitId: visit.id, servantId: visit.servantId },
    });
    this.metrics?.incrementCounter('pastoral_cases_opened_total', 1);

    return visit;
  }

  async getRecordById(id: string, actor: JwtPayload) {
    await this.getPastoralVisitOrThrow(id, actor);

    return this.prisma.pastoralVisit.findUnique({
      where: { id },
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
        pastoralNotes: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        pastoralFollowUps: {
          where: { deletedAt: null },
          include: {
            createdBy: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
  }

  async updateRecord(id: string, dto: UpdatePastoralVisitDto, actor: JwtPayload) {
    const current = await this.getPastoralVisitOrThrow(id, actor);
    const nextStatus = dto.status ?? current.status;
    const resolving =
      nextStatus === PastoralVisitStatus.RESOLVIDA && current.status !== PastoralVisitStatus.RESOLVIDA;

    const visit = await this.prisma.pastoralVisit.update({
      where: { id },
      data: {
        title: dto.title,
        reason: dto.reason,
        reasonType: dto.reasonType,
        priority: dto.priority,
        status: nextStatus,
        notes: dto.notes,
        assignedToUserId: dto.assignedToUserId,
        nextFollowUpAt: this.parseOptionalDate(dto.nextFollowUpAt),
        resolvedAt: resolving ? new Date() : current.resolvedAt,
        resolvedByUserId: resolving ? actor.sub : current.resolvedByUserId,
      },
    });

    if (resolving) {
      await this.prisma.pastoralAlert.updateMany({
        where: {
          servantId: visit.servantId,
          status: AlertStatus.OPEN,
        },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedByUserId: actor.sub,
          resolvedAt: new Date(),
        },
      });
    }

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralVisit',
      entityId: id,
      userId: actor.sub,
      metadata: { status: visit.status, priority: visit.priority },
    });

    return visit;
  }

  async resolve(id: string, dto: ResolvePastoralVisitDto, actor: JwtPayload) {
    const status = dto.status ?? PastoralVisitStatus.RESOLVIDA;
    return this.updateRecord(
      id,
      {
        status,
        notes: dto.notes,
      },
      actor,
    );
  }

  async addNote(recordId: string, dto: CreatePastoralNoteDto, actor: JwtPayload) {
    const current = await this.getPastoralVisitOrThrow(recordId, actor);

    const note = await this.prisma.pastoralNote.create({
      data: {
        pastoralVisitId: current.id,
        churchId: current.churchId,
        authorUserId: actor.sub,
        note: dto.note,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralNote',
      entityId: note.id,
      userId: actor.sub,
      metadata: { pastoralVisitId: recordId },
    });

    return note;
  }

  async addFollowUp(recordId: string, dto: CreatePastoralFollowUpDto, actor: JwtPayload) {
    const current = await this.getPastoralVisitOrThrow(recordId, actor);

    const followUp = await this.prisma.pastoralFollowUp.create({
      data: {
        pastoralVisitId: current.id,
        churchId: current.churchId,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        createdByUserId: actor.sub,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.prisma.pastoralVisit.update({
      where: { id: current.id },
      data: {
        status:
          current.status === PastoralVisitStatus.RESOLVIDA
            ? PastoralVisitStatus.EM_ANDAMENTO
            : current.status,
        nextFollowUpAt: followUp.scheduledAt,
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralFollowUp',
      entityId: followUp.id,
      userId: actor.sub,
      metadata: { pastoralVisitId: recordId },
    });
    this.metrics?.incrementCounter('pastoral_followups_created_total', 1);

    return followUp;
  }

  async completeFollowUp(followUpId: string, dto: CompletePastoralFollowUpDto, actor: JwtPayload) {
    const followUp = await this.prisma.pastoralFollowUp.findUnique({
      where: { id: followUpId },
      include: {
        pastoralVisit: true,
      },
    });
    if (!followUp || followUp.deletedAt) {
      throw new NotFoundException('Pastoral follow-up not found');
    }
    this.tenantIntegrity.assertSameChurch(this.actorChurch(actor), followUp.churchId, 'Pastoral follow-up');
    await assertServantAccess(this.prisma, actor, followUp.pastoralVisit.servantId);

    const updated = await this.prisma.pastoralFollowUp.update({
      where: { id: followUpId },
      data: {
        status: PastoralFollowUpStatus.DONE,
        completedAt: new Date(),
        completedByUserId: actor.sub,
        notes: dto.notes ?? followUp.notes,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralFollowUp',
      entityId: followUpId,
      userId: actor.sub,
    });

    return updated;
  }

  async listAlerts(query: ListPastoralAlertsQueryDto, actor: JwtPayload) {
    const servantScope = await getServantAccessWhere(this.prisma, actor);
    const where: Prisma.PastoralAlertWhereInput = {
      status: query.status,
      severity: query.severity,
      source: query.source,
      servantId: query.servantId,
      deletedAt: null,
      ...(servantScope ? { servant: servantScope } : {}),
      ...(actor.churchId ? { churchId: actor.churchId } : {}),
    };

    return this.prisma.pastoralAlert.findMany({
      where,
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async resolveAlert(id: string, dto: ResolvePastoralAlertDto, actor: JwtPayload) {
    const alert = await this.prisma.pastoralAlert.findUnique({ where: { id } });
    if (!alert || alert.deletedAt) {
      throw new NotFoundException('Pastoral alert not found');
    }
    this.tenantIntegrity.assertSameChurch(this.actorChurch(actor), alert.churchId, 'Pastoral alert');
    await assertServantAccess(this.prisma, actor, alert.servantId);

    const metadataPatch = dto.resolutionNotes
      ? ({
          ...(typeof alert.metadata === 'object' && alert.metadata !== null ? alert.metadata : {}),
          resolutionNotes: dto.resolutionNotes,
        } as Prisma.JsonObject)
      : undefined;

    const updated = await this.prisma.pastoralAlert.update({
      where: { id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedByUserId: actor.sub,
        ...(metadataPatch ? { metadata: metadataPatch } : {}),
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralAlert',
      entityId: id,
      userId: actor.sub,
      metadata: { resolutionNotes: dto.resolutionNotes },
    });

    return updated;
  }

  async openRecordFromAlert(alertId: string, actor: JwtPayload) {
    const alert = await this.prisma.pastoralAlert.findUnique({ where: { id: alertId } });
    if (!alert || alert.deletedAt) {
      throw new NotFoundException('Pastoral alert not found');
    }
    this.tenantIntegrity.assertSameChurch(this.actorChurch(actor), alert.churchId, 'Pastoral alert');
    await assertServantAccess(this.prisma, actor, alert.servantId);

    const existing = await this.prisma.pastoralVisit.findFirst({
      where: {
        churchId: alert.churchId,
        servantId: alert.servantId,
        status: { in: [PastoralVisitStatus.ABERTA, PastoralVisitStatus.EM_ANDAMENTO] },
        deletedAt: null,
      },
      orderBy: { openedAt: 'desc' },
    });
    if (existing) {
      return existing;
    }

    const severityToPriority: Record<string, PastoralPriority> = {
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    };
    const reasonByAlertType: Record<string, PastoralReasonType> = {
      NO_SHOW_IMMEDIATE: 'NO_SHOW',
      RECURRENT_ABSENCE: 'ABSENCE',
      PROLONGED_INACTIVITY: 'INACTIVITY',
      REPEATED_DECLINE: 'OTHER',
      NO_RESPONSE_TO_SCHEDULE: 'OTHER',
      CONSTANCY_DROP: 'JOURNEY_SIGNAL',
      LOW_READINESS_SIGNAL: 'JOURNEY_SIGNAL',
      RETURN_AFTER_GAP: 'JOURNEY_SIGNAL',
    };

    const created = await this.prisma.pastoralVisit.create({
      data: {
        churchId: alert.churchId,
        servantId: alert.servantId,
        title: `Caso originado por alerta ${alert.alertType}`,
        reason: alert.message,
        reasonType: reasonByAlertType[alert.alertType] ?? 'OTHER',
        priority: severityToPriority[alert.severity] ?? 'MEDIUM',
        status: PastoralVisitStatus.ABERTA,
        createdByUserId: actor.sub,
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralVisit',
      entityId: created.id,
      userId: actor.sub,
      metadata: {
        sourceAlertId: alertId,
        alertType: alert.alertType,
      },
    });
    this.metrics?.incrementCounter('pastoral_cases_opened_total', 1);

    return created;
  }

  async historyByServant(servantId: string, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, servantId);
    await this.tenantIntegrity.assertServantChurch(servantId, actor);

    const [records, alerts, followUps] = await Promise.all([
      this.prisma.pastoralVisit.findMany({
        where: {
          servantId,
          deletedAt: null,
          ...(actor.churchId ? { churchId: actor.churchId } : {}),
        },
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.pastoralAlert.findMany({
        where: {
          servantId,
          deletedAt: null,
          ...(actor.churchId ? { churchId: actor.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pastoralFollowUp.findMany({
        where: {
          pastoralVisit: {
            servantId,
          },
          deletedAt: null,
          ...(actor.churchId ? { churchId: actor.churchId } : {}),
        },
        orderBy: { scheduledAt: 'desc' },
      }),
    ]);

    return {
      records,
      alerts,
      followUps,
    };
  }

  async summaryByServant(servantId: string, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, servantId);
    await this.tenantIntegrity.assertServantChurch(servantId, actor);

    const [openCases, inProgressCases, openAlerts, highAlerts, pendingFollowUps, lastAttendance] =
      await Promise.all([
        this.prisma.pastoralVisit.count({
          where: {
            servantId,
            deletedAt: null,
            status: PastoralVisitStatus.ABERTA,
            ...(actor.churchId ? { churchId: actor.churchId } : {}),
          },
        }),
        this.prisma.pastoralVisit.count({
          where: {
            servantId,
            deletedAt: null,
            status: PastoralVisitStatus.EM_ANDAMENTO,
            ...(actor.churchId ? { churchId: actor.churchId } : {}),
          },
        }),
        this.prisma.pastoralAlert.count({
          where: {
            servantId,
            deletedAt: null,
            status: AlertStatus.OPEN,
            ...(actor.churchId ? { churchId: actor.churchId } : {}),
          },
        }),
        this.prisma.pastoralAlert.count({
          where: {
            servantId,
            deletedAt: null,
            status: AlertStatus.OPEN,
            severity: 'HIGH',
            ...(actor.churchId ? { churchId: actor.churchId } : {}),
          },
        }),
        this.prisma.pastoralFollowUp.count({
          where: {
            deletedAt: null,
            status: PastoralFollowUpStatus.OPEN,
            pastoralVisit: { servantId },
            ...(actor.churchId ? { churchId: actor.churchId } : {}),
          },
        }),
        this.prisma.attendance.findFirst({
          where: {
            servantId,
            deletedAt: null,
            ...(actor.churchId ? { churchId: actor.churchId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: {
            status: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      servantId,
      openCases,
      inProgressCases,
      openAlerts,
      highAlerts,
      pendingFollowUps,
      lastAttendance,
    };
  }
}
