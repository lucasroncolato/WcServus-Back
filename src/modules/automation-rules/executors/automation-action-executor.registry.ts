import { Injectable } from '@nestjs/common';
import { PastoralAlertSeverity, PastoralAlertSource, Prisma } from '@prisma/client';
import { TimelineEventType } from 'src/common/timeline/timeline-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { AuditAction } from '@prisma/client';
import { TimelinePublisherService } from 'src/modules/timeline/timeline-publisher.service';

export type AutomationActionInput = {
  action: string;
  config?: Record<string, unknown>;
};

export type AutomationExecutionContext = {
  churchId: string;
  ruleId: string;
  triggerKey: string;
  sourceRefId?: string | null;
  actorUserId?: string | null;
  payload: Record<string, unknown>;
  dryRun?: boolean;
};

export type AutomationActionResult = {
  action: string;
  success: boolean;
  processed: number;
  message: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class AutomationActionExecutorRegistry {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly timelinePublisher: TimelinePublisherService,
  ) {}

  async execute(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    switch (input.action) {
      case 'create_pastoral_alert':
        return this.createPastoralAlert(input, ctx);
      case 'open_pastoral_record':
        return this.openPastoralRecord(input, ctx);
      case 'create_pastoral_followup':
        return this.createPastoralFollowUp(input, ctx);
      case 'notify_leader':
      case 'notify_pastor':
      case 'notify_servant':
        return this.notifyUsers(input, ctx);
      case 'resend_schedule_notification':
        return this.resendScheduleNotification(input, ctx);
      case 'suggest_substitute':
        return this.suggestSubstitute(input, ctx);
      case 'flag_slot_attention':
        return this.flagSlotAttention(input, ctx);
      case 'write_timeline_entry':
        return this.writeTimelineEntry(input, ctx);
      case 'write_audit_log':
        return this.writeAuditLog(input, ctx);
      case 'create_task':
        return this.createTask(input, ctx);
      case 'assign_task_to_leader':
        return this.assignTaskToLeader(input, ctx);
      default:
        return {
          action: input.action,
          success: false,
          processed: 0,
          message: `Action not supported: ${input.action}`,
        };
    }
  }

  private async createPastoralAlert(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const servantId = String(input.config?.servantId ?? ctx.payload.servantId ?? '');
    if (!servantId) {
      return { action: input.action, success: false, processed: 0, message: 'servantId is required' };
    }

    const alertType = String(input.config?.alertType ?? 'AUTOMATION_ALERT');
    const message = String(input.config?.message ?? 'Sinal automatico para acompanhamento pastoral.');
    const dedupeKey = String(input.config?.dedupeKey ?? `${ctx.ruleId}:${ctx.triggerKey}:${servantId}:${ctx.sourceRefId ?? 'none'}`);

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: pastoral alert would be created' };
    }

    const existing = await this.prisma.pastoralAlert.findFirst({
      where: { churchId: ctx.churchId, dedupeKey, status: 'OPEN', deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return { action: input.action, success: true, processed: 0, message: 'Skipped by pastoral dedupeKey', details: { dedupeKey } };
    }

    await this.prisma.pastoralAlert.create({
      data: {
        churchId: ctx.churchId,
        servantId,
        alertType,
        message,
        trigger: ctx.triggerKey,
        source: PastoralAlertSource.AUTOMATION,
        severity: (String(input.config?.severity ?? 'MEDIUM') as PastoralAlertSeverity) ?? PastoralAlertSeverity.MEDIUM,
        sourceRefId: ctx.sourceRefId ?? null,
        dedupeKey,
        metadata: { origin: 'automation-rule', ruleId: ctx.ruleId } as Prisma.InputJsonValue,
      },
    });

    return { action: input.action, success: true, processed: 1, message: 'Pastoral alert created', details: { dedupeKey } };
  }

  private async openPastoralRecord(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const servantId = String(input.config?.servantId ?? ctx.payload.servantId ?? '');
    const createdByUserId = String(input.config?.createdByUserId ?? ctx.actorUserId ?? '');
    if (!servantId || !createdByUserId) {
      return { action: input.action, success: false, processed: 0, message: 'servantId and createdByUserId are required' };
    }

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: pastoral record would be opened' };
    }

    await this.prisma.pastoralVisit.create({
      data: {
        churchId: ctx.churchId,
        servantId,
        createdByUserId,
        reason: String(input.config?.reason ?? 'Acompanhamento gerado por automacao'),
        title: String(input.config?.title ?? 'Acompanhamento automatico'),
        notes: String(input.config?.notes ?? ''),
      },
    });

    return { action: input.action, success: true, processed: 1, message: 'Pastoral record opened' };
  }

  private async createPastoralFollowUp(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const pastoralVisitId = String(input.config?.pastoralVisitId ?? '');
    const createdByUserId = String(input.config?.createdByUserId ?? ctx.actorUserId ?? '');
    if (!pastoralVisitId || !createdByUserId) {
      return { action: input.action, success: false, processed: 0, message: 'pastoralVisitId and createdByUserId are required' };
    }

    const scheduledAt = new Date(String(input.config?.scheduledAt ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()));

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: pastoral follow-up would be created' };
    }

    await this.prisma.pastoralFollowUp.create({
      data: {
        churchId: ctx.churchId,
        pastoralVisitId,
        createdByUserId,
        scheduledAt,
        notes: String(input.config?.notes ?? ''),
      },
    });

    return { action: input.action, success: true, processed: 1, message: 'Pastoral follow-up created' };
  }

  private async notifyUsers(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const roleMap: Record<string, Array<'ADMIN' | 'PASTOR' | 'COORDENADOR'>> = {
      notify_leader: ['COORDENADOR'],
      notify_pastor: ['PASTOR', 'ADMIN'],
      notify_servant: [],
    };

    let recipients: Array<{ id: string }> = [];

    if (input.action === 'notify_servant') {
      const servantId = String(input.config?.servantId ?? ctx.payload.servantId ?? '');
      if (!servantId) {
        return { action: input.action, success: false, processed: 0, message: 'servantId is required' };
      }
      const user = await this.prisma.user.findFirst({ where: { churchId: ctx.churchId, servantId, deletedAt: null }, select: { id: true } });
      if (user) recipients = [user];
    } else {
      recipients = await this.prisma.user.findMany({
        where: { churchId: ctx.churchId, role: { in: roleMap[input.action] as any }, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
        take: 100,
      });
    }

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: recipients.length, message: 'Dry-run: notifications would be created' };
    }

    const title = String(input.config?.title ?? 'Automacao do sistema');
    const message = String(input.config?.message ?? 'Uma automacao foi executada e requer atencao.');

    for (const recipient of recipients) {
      await this.prisma.notification.create({
        data: {
          userId: recipient.id,
          churchId: ctx.churchId,
          type: 'AUTOMATION',
          title,
          message,
          metadata: { ruleId: ctx.ruleId, triggerKey: ctx.triggerKey } as Prisma.InputJsonValue,
        },
      });
    }

    return { action: input.action, success: true, processed: recipients.length, message: 'Notifications created' };
  }

  private async resendScheduleNotification(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const slotId = String(input.config?.slotId ?? ctx.payload.slotId ?? '');
    if (!slotId) {
      return { action: input.action, success: false, processed: 0, message: 'slotId is required' };
    }

    const slot = await this.prisma.scheduleSlot.findFirst({
      where: { id: slotId, churchId: ctx.churchId, deletedAt: null },
      select: { assignedServantId: true },
    });
    if (!slot?.assignedServantId) {
      return { action: input.action, success: false, processed: 0, message: 'Slot has no servant assigned' };
    }

    const user = await this.prisma.user.findFirst({ where: { churchId: ctx.churchId, servantId: slot.assignedServantId, deletedAt: null }, select: { id: true } });
    if (!user) {
      return { action: input.action, success: false, processed: 0, message: 'No user found for servant' };
    }

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: schedule notification would be resent' };
    }

    await this.prisma.notification.create({
      data: {
        userId: user.id,
        churchId: ctx.churchId,
        type: 'SCHEDULE_REMINDER',
        title: 'Lembrete de escala',
        message: 'Voce possui uma escala pendente de confirmacao.',
        metadata: { slotId, ruleId: ctx.ruleId } as Prisma.InputJsonValue,
      },
    });

    return { action: input.action, success: true, processed: 1, message: 'Schedule notification resent' };
  }

  private async suggestSubstitute(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const slotId = String(input.config?.slotId ?? ctx.payload.slotId ?? '');
    if (!slotId) {
      return { action: input.action, success: false, processed: 0, message: 'slotId is required' };
    }

    const slot = await this.prisma.scheduleSlot.findFirst({
      where: { id: slotId, churchId: ctx.churchId, deletedAt: null },
      select: { ministryId: true, scheduleId: true },
    });
    if (!slot) {
      return { action: input.action, success: false, processed: 0, message: 'Slot not found' };
    }

    const candidates = await this.prisma.servant.findMany({
      where: {
        churchId: ctx.churchId,
        deletedAt: null,
        OR: [
          { mainMinistryId: slot.ministryId },
          { servantMinistries: { some: { ministryId: slot.ministryId } } },
        ],
      },
      select: { id: true },
      take: 3,
    });

    return {
      action: input.action,
      success: true,
      processed: candidates.length,
      message: 'Substitute candidates suggested',
      details: { slotId, candidates: candidates.map((item) => item.id) },
    };
  }

  private async flagSlotAttention(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const slotId = String(input.config?.slotId ?? ctx.payload.slotId ?? '');
    if (!slotId) {
      return { action: input.action, success: false, processed: 0, message: 'slotId is required' };
    }

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: slot attention flag would be created' };
    }

    await this.timelinePublisher.publish({
      churchId: ctx.churchId,
      eventType: 'TIMELINE_AUTOMATION_CREATED_ALERT',
      actorType: 'AUTOMATION',
      actorUserId: ctx.actorUserId ?? null,
      subjectType: 'SLOT',
      subjectId: slotId,
      relatedEntityType: 'AUTOMATION_RULE',
      relatedEntityId: ctx.ruleId,
      dedupeKey: `automation:flag_slot_attention:${ctx.churchId}:${ctx.ruleId}:${slotId}`,
      title: 'Slot em atencao',
      message: 'Uma automacao sinalizou um slot que requer acompanhamento.',
      metadata: { slotId, ruleId: ctx.ruleId },
    });

    return { action: input.action, success: true, processed: 1, message: 'Slot flagged for attention' };
  }

  private async writeTimelineEntry(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: timeline entry would be written' };
    }

    const eventType = this.resolveAutomationTimelineEventType(input, ctx);

    await this.timelinePublisher.publish({
      churchId: ctx.churchId,
      eventType,
      actorType: 'AUTOMATION',
      actorUserId: ctx.actorUserId ?? null,
      subjectType: 'AUTOMATION_RULE',
      subjectId: ctx.ruleId,
      relatedEntityType: 'AUTOMATION_TRIGGER',
      relatedEntityId: ctx.triggerKey,
      dedupeKey: `automation:timeline:${eventType}:${ctx.churchId}:${ctx.ruleId}:${ctx.triggerKey}`,
      title: String(input.config?.title ?? 'Automacao executada'),
      message: String(input.config?.description ?? 'A regra automatica foi executada com sucesso.'),
      metadata: { ruleId: ctx.ruleId, triggerKey: ctx.triggerKey },
    });

    return { action: input.action, success: true, processed: 1, message: 'Timeline entry written' };
  }

  private async writeAuditLog(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: audit log would be written' };
    }

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'AutomationExecution',
      entityId: ctx.ruleId,
      churchId: ctx.churchId,
      metadata: {
        triggerKey: ctx.triggerKey,
        sourceRefId: ctx.sourceRefId,
        payload: ctx.payload,
      },
    });

    return { action: input.action, success: true, processed: 1, message: 'Audit log written' };
  }

  private async createTask(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const ministryId = String(input.config?.ministryId ?? ctx.payload.ministryId ?? '');
    const templateId = String(input.config?.templateId ?? '');
    if (!ministryId || !templateId) {
      return { action: input.action, success: false, processed: 0, message: 'ministryId and templateId are required' };
    }

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: task would be created' };
    }

    await this.prisma.ministryTaskOccurrence.create({
      data: {
        churchId: ctx.churchId,
        ministryId,
        templateId,
        scheduledFor: new Date(String(input.config?.scheduledFor ?? new Date().toISOString())),
        notes: String(input.config?.notes ?? 'Criada por automacao'),
      },
    });

    return { action: input.action, success: true, processed: 1, message: 'Task created' };
  }

  private async assignTaskToLeader(input: AutomationActionInput, ctx: AutomationExecutionContext): Promise<AutomationActionResult> {
    const occurrenceId = String(input.config?.occurrenceId ?? ctx.payload.occurrenceId ?? '');
    if (!occurrenceId) {
      return { action: input.action, success: false, processed: 0, message: 'occurrenceId is required' };
    }

    const occurrence = await this.prisma.ministryTaskOccurrence.findFirst({
      where: { id: occurrenceId, churchId: ctx.churchId, deletedAt: null },
      select: { id: true, ministryId: true },
    });
    if (!occurrence) {
      return { action: input.action, success: false, processed: 0, message: 'Occurrence not found' };
    }

    const leader = await this.prisma.user.findFirst({
      where: { churchId: ctx.churchId, role: { in: ['COORDENADOR', 'PASTOR', 'ADMIN'] }, status: 'ACTIVE', deletedAt: null },
      select: { servantId: true },
    });
    if (!leader?.servantId) {
      return { action: input.action, success: false, processed: 0, message: 'No leader with servant profile found' };
    }

    if (ctx.dryRun) {
      return { action: input.action, success: true, processed: 1, message: 'Dry-run: task would be assigned to leader' };
    }

    await this.prisma.ministryTaskOccurrence.update({
      where: { id: occurrence.id },
      data: { assignedServantId: leader.servantId },
    });

    return { action: input.action, success: true, processed: 1, message: 'Task assigned to leader' };
  }

  private resolveAutomationTimelineEventType(input: AutomationActionInput, ctx: AutomationExecutionContext): TimelineEventType {
    if (input.action === 'create_pastoral_alert') {
      return 'TIMELINE_AUTOMATION_CREATED_ALERT';
    }
    if (ctx.triggerKey.toLowerCase().includes('skip')) {
      return 'TIMELINE_AUTOMATION_RULE_SKIPPED';
    }
    return 'TIMELINE_AUTOMATION_RULE_EXECUTED';
  }
}
