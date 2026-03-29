import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AutomationActionType, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

@Injectable()
export class AutomationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: JwtPayload) {
    this.assertManageAccess(actor);
    return this.prisma.automationRule.findMany({
      where: this.buildActorScope(actor),
      include: {
        executionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
    });
  }

  async executionLogs(actor: JwtPayload) {
    this.assertManageAccess(actor);
    return this.prisma.automationExecutionLog.findMany({
      where: this.buildActorScope(actor),
      include: {
        rule: { select: { id: true, name: true, actionType: true, triggerType: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async create(dto: CreateAutomationRuleDto, actor: JwtPayload) {
    this.assertManageAccess(actor);
    const churchId = this.resolveChurchId(actor, dto.churchId);
    const data = await this.prisma.automationRule.create({
      data: {
        churchId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig as Prisma.InputJsonValue | undefined,
        actionType: dto.actionType,
        actionConfig: dto.actionConfig as Prisma.InputJsonValue | undefined,
        enabled: dto.enabled ?? true,
        createdBy: actor.sub,
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
        actionType: data.actionType,
        enabled: data.enabled,
      },
    });

    return { data };
  }

  async update(id: string, dto: UpdateAutomationRuleDto, actor: JwtPayload) {
    this.assertManageAccess(actor);
    const existing = await this.prisma.automationRule.findFirst({
      where: {
        id,
        ...this.buildActorScope(actor),
      },
    });
    if (!existing) {
      throw new NotFoundException('Automation rule not found');
    }

    const data = await this.prisma.automationRule.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig as Prisma.InputJsonValue | undefined,
        actionType: dto.actionType,
        actionConfig: dto.actionConfig as Prisma.InputJsonValue | undefined,
        enabled: dto.enabled,
        ...(actor.role === Role.SUPER_ADMIN && dto.churchId
          ? { churchId: dto.churchId }
          : {}),
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
        actionType: existing.actionType,
        enabled: existing.enabled,
      },
      after: {
        name: data.name,
        triggerType: data.triggerType,
        actionType: data.actionType,
        enabled: data.enabled,
      },
    });

    return { data };
  }

  async remove(id: string, actor: JwtPayload) {
    this.assertManageAccess(actor);
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

    await this.prisma.automationRule.delete({ where: { id: existing.id } });

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

  async isActionEnabled(churchId: string, actionType: AutomationActionType) {
    const rule = await this.prisma.automationRule.findFirst({
      where: {
        churchId,
        actionType,
        enabled: true,
      },
      select: { id: true },
    });
    return Boolean(rule);
  }

  async shouldRunGlobalAction(actionType: AutomationActionType) {
    const totalRules = await this.prisma.automationRule.count();
    if (totalRules === 0) {
      return true;
    }

    const enabled = await this.prisma.automationRule.count({
      where: {
        actionType,
        enabled: true,
      },
    });
    return enabled > 0;
  }

  private assertManageAccess(actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can manage automation rules');
    }
  }

  private buildActorScope(actor: JwtPayload) {
    if (actor.role === Role.SUPER_ADMIN && !actor.churchId) {
      return {};
    }
    return { churchId: this.resolveChurchId(actor) };
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
}
