import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AutomationActionType,
  AutomationDedupeStrategy,
  AutomationExecutionStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { AUTOMATION_ACTION_CATALOG } from 'src/common/automations/automation-action-catalog';
import { AUTOMATION_CONDITION_CATALOG } from 'src/common/automations/automation-condition-catalog';
import { normalizeActionKeys, normalizeConditionKeys, validateAutomationRuleShape } from 'src/common/automations/automation-policy';
import { AUTOMATION_TRIGGER_CATALOG } from 'src/common/automations/automation-trigger-catalog';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { AutomationRuleLogsQueryDto } from './dto/automation-rule-logs-query.dto';
import { RunAutomationRuleTestDto } from './dto/run-automation-rule-test.dto';
import { AutomationsEngineService } from './automations-engine.service';
import { AutomationsSchedulerService } from './automations-scheduler.service';

@Injectable()
export class AutomationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly engine: AutomationsEngineService,
    private readonly scheduler: AutomationsSchedulerService,
  ) {}

  async list(actor: JwtPayload) {
    this.assertReadAccess(actor);
    const where = this.buildActorScope(actor);

    return this.prisma.automationRule.findMany({
      where,
      include: {
        executionLogs: {
          orderBy: { executedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getById(id: string, actor: JwtPayload) {
    this.assertReadAccess(actor);
    const data = await this.prisma.automationRule.findFirst({
      where: {
        id,
        ...this.buildActorScope(actor),
      },
      include: {
        executionLogs: {
          orderBy: { executedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!data) {
      throw new NotFoundException('Automation rule not found');
    }

    return { data };
  }

  async catalog() {
    return {
      triggers: AUTOMATION_TRIGGER_CATALOG,
      conditions: AUTOMATION_CONDITION_CATALOG,
      actions: AUTOMATION_ACTION_CATALOG,
    };
  }

  async executionLogs(actor: JwtPayload, query: AutomationRuleLogsQueryDto) {
    this.assertReadAccess(actor);
    const churchId = actor.role === Role.SUPER_ADMIN ? actor.churchId : this.resolveChurchId(actor);
    return this.prisma.automationExecutionLog.findMany({
      where: {
        ...(churchId ? { churchId } : {}),
        ...(query.status
          ? {
              status: query.status as AutomationExecutionStatus,
            }
          : {}),
        ...(query.triggerKey ? { triggerKey: query.triggerKey } : {}),
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            triggerType: true,
            triggerKey: true,
            enabled: true,
          },
        },
      },
      orderBy: { executedAt: 'desc' },
      take: 200,
    });
  }

  async ruleExecutionLogs(id: string, actor: JwtPayload, query: AutomationRuleLogsQueryDto) {
    this.assertReadAccess(actor);

    const rule = await this.prisma.automationRule.findFirst({
      where: {
        id,
        ...this.buildActorScope(actor),
      },
      select: { id: true },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return this.prisma.automationExecutionLog.findMany({
      where: {
        churchId: this.resolveChurchId(actor),
        ruleId: id,
        ...(query.status
          ? {
              status: query.status as AutomationExecutionStatus,
            }
          : {}),
      },
      orderBy: { executedAt: 'desc' },
      take: 200,
    });
  }

  async create(dto: CreateAutomationRuleDto, actor: JwtPayload) {
    this.assertWriteAccess(actor);
    const churchId = this.resolveChurchId(actor, dto.churchId);

    validateAutomationRuleShape({
      triggerKey: dto.triggerKey,
      conditionConfig: dto.conditionConfig,
      actionConfig: dto.actionConfig,
      cooldownMinutes: dto.cooldownMinutes,
      dedupeStrategy: dto.dedupeStrategy,
    });

    const data = await this.prisma.automationRule.create({
      data: {
        churchId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        triggerType: dto.triggerType,
        triggerKey: dto.triggerKey,
        triggerConfig: dto.triggerConfig as Prisma.InputJsonValue | undefined,
        conditionConfig: dto.conditionConfig as Prisma.InputJsonValue | undefined,
        actionConfig: dto.actionConfig as Prisma.InputJsonValue,
        actionType: this.resolveLegacyActionType(dto),
        cooldownMinutes: dto.cooldownMinutes ?? 0,
        dedupeStrategy: dto.dedupeStrategy ?? AutomationDedupeStrategy.BY_EVENT,
        severity: dto.severity ?? 'MEDIUM',
        enabled: dto.enabled ?? true,
        createdBy: actor.sub,
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'AutomationRule',
      entityId: data.id,
      churchId: data.churchId,
      userId: actor.sub,
      after: {
        name: data.name,
        triggerType: data.triggerType,
        triggerKey: data.triggerKey,
        enabled: data.enabled,
      },
      metadata: {
        actions: normalizeActionKeys(dto.actionConfig),
        conditions: normalizeConditionKeys(dto.conditionConfig),
      },
    });

    return { data };
  }

  async update(id: string, dto: UpdateAutomationRuleDto, actor: JwtPayload) {
    this.assertWriteAccess(actor);
    const existing = await this.prisma.automationRule.findFirst({
      where: {
        id,
        ...this.buildActorScope(actor),
      },
    });

    if (!existing) {
      throw new NotFoundException('Automation rule not found');
    }

    const triggerKey = dto.triggerKey ?? existing.triggerKey;
    const conditionConfig = dto.conditionConfig ?? existing.conditionConfig;
    const actionConfig = dto.actionConfig ?? (existing.actionConfig as unknown);
    const cooldownMinutes = dto.cooldownMinutes ?? existing.cooldownMinutes;
    const dedupeStrategy = dto.dedupeStrategy ?? existing.dedupeStrategy;

    validateAutomationRuleShape({
      triggerKey,
      conditionConfig,
      actionConfig,
      cooldownMinutes,
      dedupeStrategy,
    });

    const data = await this.prisma.automationRule.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        triggerType: dto.triggerType,
        triggerKey: dto.triggerKey,
        triggerConfig: dto.triggerConfig as Prisma.InputJsonValue | undefined,
        conditionConfig: dto.conditionConfig as Prisma.InputJsonValue | undefined,
        actionConfig: dto.actionConfig as Prisma.InputJsonValue | undefined,
        actionType: dto.actionType ?? this.resolveLegacyActionType(dto, existing.actionType),
        cooldownMinutes: dto.cooldownMinutes,
        dedupeStrategy: dto.dedupeStrategy,
        severity: dto.severity,
        enabled: dto.enabled,
        ...(actor.role === Role.SUPER_ADMIN && dto.churchId ? { churchId: dto.churchId } : {}),
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'AutomationRule',
      entityId: existing.id,
      churchId: data.churchId,
      userId: actor.sub,
      before: {
        name: existing.name,
        triggerType: existing.triggerType,
        triggerKey: existing.triggerKey,
        enabled: existing.enabled,
      },
      after: {
        name: data.name,
        triggerType: data.triggerType,
        triggerKey: data.triggerKey,
        enabled: data.enabled,
      },
      metadata: {
        actions: normalizeActionKeys(dto.actionConfig ?? existing.actionConfig),
        conditions: normalizeConditionKeys(dto.conditionConfig ?? existing.conditionConfig),
      },
    });

    return { data };
  }

  async enable(id: string, actor: JwtPayload) {
    this.assertWriteAccess(actor);
    return this.update(id, { enabled: true }, actor);
  }

  async disable(id: string, actor: JwtPayload) {
    this.assertWriteAccess(actor);
    return this.update(id, { enabled: false }, actor);
  }

  async remove(id: string, actor: JwtPayload) {
    this.assertWriteAccess(actor);
    const existing = await this.prisma.automationRule.findFirst({
      where: {
        id,
        ...this.buildActorScope(actor),
      },
      select: { id: true, churchId: true, name: true },
    });
    if (!existing) {
      throw new NotFoundException('Automation rule not found');
    }

    await this.prisma.automationRule.update({
      where: { id: existing.id },
      data: {
        enabled: false,
        deletedAt: new Date(),
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      action: AuditAction.DELETE,
      entity: 'AutomationRule',
      entityId: existing.id,
      churchId: existing.churchId,
      userId: actor.sub,
      metadata: {
        name: existing.name,
      },
    });

    return { message: 'Automation rule removed successfully' };
  }

  async runTest(id: string, dto: RunAutomationRuleTestDto, actor: JwtPayload) {
    this.assertWriteAccess(actor);

    const rule = await this.prisma.automationRule.findFirst({
      where: {
        id,
        ...this.buildActorScope(actor),
      },
    });
    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return this.engine.runRuleTest(rule, {
      churchId: rule.churchId,
      payload: dto.payload ?? {},
      sourceRefId: dto.sourceRefId,
      actorUserId: actor.sub,
    });
  }

  async internalStatus(actor: JwtPayload) {
    this.assertInternalAccess(actor);

    const churchId = actor.role === Role.SUPER_ADMIN ? actor.churchId : this.resolveChurchId(actor);

    const where = churchId ? { churchId } : {};

    const [checkpoints, totals] = await Promise.all([
      this.prisma.automationCheckpoint.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.automationExecutionLog.groupBy({
        by: ['status'],
        where: churchId ? { churchId } : undefined,
        _count: { _all: true },
      }),
    ]);

    return {
      scheduler: this.scheduler.status(),
      checkpoints,
      totals,
    };
  }

  async internalReprocess(
    actor: JwtPayload,
    input?: { churchId?: string; triggerKey?: string },
  ) {
    this.assertInternalAccess(actor);

    const churchId = this.resolveChurchId(actor, input?.churchId);
    return this.scheduler.runOnce({ churchId, triggerKey: input?.triggerKey });
  }

  async handleEventTrigger(event: {
    churchId: string;
    triggerKey: string;
    payload: Record<string, unknown>;
    sourceRefId?: string;
    actorUserId?: string;
  }) {
    return this.engine.handleEventTrigger(event);
  }

  async isActionEnabled(churchId: string, actionType: AutomationActionType) {
    const rule = await this.prisma.automationRule.findFirst({
      where: {
        churchId,
        enabled: true,
        deletedAt: null,
        actionType,
      },
      select: { id: true },
    });
    return Boolean(rule);
  }

  async shouldRunGlobalAction(actionType: AutomationActionType) {
    const totalRules = await this.prisma.automationRule.count({ where: { deletedAt: null } });
    if (totalRules === 0) {
      return true;
    }

    const enabled = await this.prisma.automationRule.count({
      where: {
        enabled: true,
        deletedAt: null,
        actionType,
      },
    });
    return enabled > 0;
  }

  private assertReadAccess(actor: JwtPayload) {
    if (actor.role === Role.SERVO) {
      throw new ForbiddenException('Servants cannot access automation module');
    }
  }

  private assertWriteAccess(actor: JwtPayload) {
    if (
      actor.role !== Role.SUPER_ADMIN &&
      actor.role !== Role.ADMIN &&
      actor.role !== Role.PASTOR
    ) {
      throw new ForbiddenException('Only pastor/admin profiles can manage automation rules');
    }
  }

  private assertInternalAccess(actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can access automation internals');
    }
  }

  private buildActorScope(actor: JwtPayload): Prisma.AutomationRuleWhereInput {
    if (actor.role === Role.SUPER_ADMIN && !actor.churchId) {
      return { deletedAt: null };
    }

    return {
      churchId: this.resolveChurchId(actor),
      deletedAt: null,
    };
  }

  private resolveChurchId(actor: JwtPayload, explicitChurchId?: string) {
    if (actor.role === Role.SUPER_ADMIN && explicitChurchId) {
      return explicitChurchId;
    }
    if (!actor.churchId) {
      throw new ForbiddenException('Actor must be bound to a church context');
    }
    return actor.churchId;
  }

  private resolveLegacyActionType(
    dto: Pick<CreateAutomationRuleDto | UpdateAutomationRuleDto, 'actionType' | 'actionConfig'>,
    fallback: AutomationActionType | null = AutomationActionType.JOURNEY_REGISTER_EVENT,
  ) {
    if (dto.actionType) {
      return dto.actionType;
    }

    const firstAction = Array.isArray(dto.actionConfig) ? dto.actionConfig[0]?.action : undefined;
    switch (firstAction) {
      case 'resend_schedule_notification':
        return AutomationActionType.SCHEDULE_ALERT_UNCONFIRMED;
      case 'flag_slot_attention':
      case 'suggest_substitute':
        return AutomationActionType.SCHEDULE_ALERT_INCOMPLETE;
      case 'create_task':
      case 'assign_task_to_leader':
        return AutomationActionType.TASK_NOTIFY_COORDINATOR_OVERDUE;
      default:
        return fallback ?? AutomationActionType.JOURNEY_REGISTER_EVENT;
    }
  }
}
