import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ChurchModuleKey, Role, UserScope } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import {
  UpdateChurchAutomationPreferencesDto,
  UpdateChurchBrandingDto,
  UpdateChurchSettingsDto,
  UpsertChurchModuleDto,
} from './dto/church-admin.dto';

@Injectable()
export class ChurchAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async get(churchId: string, actor: JwtPayload) {
    this.assertAccess(actor, churchId);
    const church = await this.prisma.church.findUnique({ where: { id: churchId } });
    if (!church) throw new NotFoundException('Church not found');

    const [settings, branding, modules, automationPreferences, plan] = await Promise.all([
      this.prisma.churchSettings.findUnique({ where: { churchId } }),
      this.prisma.churchBranding.findUnique({ where: { churchId } }),
      this.prisma.churchModule.findMany({ where: { churchId }, orderBy: { moduleKey: 'asc' } }),
      this.prisma.churchAutomationPreference.findUnique({ where: { churchId } }),
      this.prisma.churchPlan.findUnique({ where: { churchId }, include: { plan: true } }),
    ]);

    return { church, settings, branding, modules, automationPreferences, plan };
  }

  async updateSettings(churchId: string, dto: UpdateChurchSettingsDto, actor: JwtPayload) {
    this.assertAccess(actor, churchId);
    const data = await this.prisma.churchSettings.upsert({
      where: { churchId },
      create: {
        churchId,
        timezone: dto.timezone ?? 'America/Sao_Paulo',
        locale: dto.locale ?? 'pt-BR',
        operationalWeekStartsOn: dto.operationalWeekStartsOn ?? 1,
        defaultJourneyEnabled: dto.defaultJourneyEnabled ?? true,
        requireScheduleConfirmation: dto.requireScheduleConfirmation ?? true,
      },
      update: {
        timezone: dto.timezone,
        locale: dto.locale,
        operationalWeekStartsOn: dto.operationalWeekStartsOn,
        defaultJourneyEnabled: dto.defaultJourneyEnabled,
        requireScheduleConfirmation: dto.requireScheduleConfirmation,
      },
    });
    await this.auditService.log({ action: AuditAction.UPDATE, entity: 'ChurchSettings', entityId: data.id, churchId, userId: actor.sub, after: { ...dto } });
    return { data };
  }

  async updateBranding(churchId: string, dto: UpdateChurchBrandingDto, actor: JwtPayload) {
    this.assertAccess(actor, churchId);
    const data = await this.prisma.churchBranding.upsert({
      where: { churchId },
      create: {
        churchId,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        accentColor: dto.accentColor,
        welcomeMessage: dto.welcomeMessage,
      },
      update: {
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        accentColor: dto.accentColor,
        welcomeMessage: dto.welcomeMessage,
      },
    });
    await this.auditService.log({ action: AuditAction.UPDATE, entity: 'ChurchBranding', entityId: data.id, churchId, userId: actor.sub, after: { ...dto } });
    return { data };
  }

  async upsertModules(churchId: string, modules: UpsertChurchModuleDto[], actor: JwtPayload) {
    this.assertAccess(actor, churchId);
    for (const item of modules) {
      if (!(item.moduleKey in ChurchModuleKey)) {
        continue;
      }
      await this.prisma.churchModule.upsert({
        where: {
          churchId_moduleKey: { churchId, moduleKey: item.moduleKey as ChurchModuleKey },
        },
        create: {
          churchId,
          moduleKey: item.moduleKey as ChurchModuleKey,
          enabled: item.enabled,
        },
        update: { enabled: item.enabled },
      });
    }
    await this.auditService.log({ action: AuditAction.UPDATE, entity: 'ChurchModule', entityId: churchId, churchId, userId: actor.sub, metadata: { modules: [...modules] } });
    return this.prisma.churchModule.findMany({ where: { churchId }, orderBy: { moduleKey: 'asc' } });
  }

  async updateAutomationPreferences(
    churchId: string,
    dto: UpdateChurchAutomationPreferencesDto,
    actor: JwtPayload,
  ) {
    this.assertAccess(actor, churchId);
    const data = await this.prisma.churchAutomationPreference.upsert({
      where: { churchId },
      create: {
        churchId,
        enabled: dto.enabled ?? true,
        overdueGraceDays: dto.overdueGraceDays ?? 0,
        stalledTrackDays: dto.stalledTrackDays ?? 30,
        noServiceAlertDays: dto.noServiceAlertDays ?? 45,
        incompleteScheduleWindowHrs: dto.incompleteScheduleWindowHrs ?? 48,
      },
      update: {
        enabled: dto.enabled,
        overdueGraceDays: dto.overdueGraceDays,
        stalledTrackDays: dto.stalledTrackDays,
        noServiceAlertDays: dto.noServiceAlertDays,
        incompleteScheduleWindowHrs: dto.incompleteScheduleWindowHrs,
      },
    });
    await this.auditService.log({ action: AuditAction.UPDATE, entity: 'ChurchAutomationPreference', entityId: data.id, churchId, userId: actor.sub, after: { ...dto } });
    return { data };
  }

  async provision(churchId: string, actor: JwtPayload, input?: { adminEmail?: string; adminName?: string; adminPassword?: string }) {
    this.assertAccess(actor, churchId);
    const church = await this.prisma.church.findUnique({ where: { id: churchId } });
    if (!church) throw new NotFoundException('Church not found');

    await this.prisma.churchSettings.upsert({ where: { churchId }, create: { churchId }, update: {} });
    await this.prisma.churchBranding.upsert({ where: { churchId }, create: { churchId }, update: {} });
    await this.prisma.churchAutomationPreference.upsert({ where: { churchId }, create: { churchId }, update: {} });

    const existingModuleCount = await this.prisma.churchModule.count({ where: { churchId } });
    if (existingModuleCount === 0) {
      await this.prisma.churchModule.createMany({
        data: Object.values(ChurchModuleKey).map((moduleKey) => ({ churchId, moduleKey, enabled: true })),
      });
    }

    let createdAdminId: string | null = null;
    if (input?.adminEmail && input?.adminName && input?.adminPassword) {
      const exists = await this.prisma.user.findUnique({ where: { email: input.adminEmail.toLowerCase() } });
      if (!exists) {
        const created = await this.prisma.user.create({
          data: {
            name: input.adminName,
            email: input.adminEmail.toLowerCase(),
            passwordHash: await bcrypt.hash(input.adminPassword, 10),
            role: Role.ADMIN,
            scope: UserScope.GLOBAL,
            churchId,
          },
        });
        createdAdminId = created.id;
      }
    }

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ChurchProvisioning',
      entityId: churchId,
      churchId,
      userId: actor.sub,
      metadata: { createdAdminId },
    });

    return { message: 'Provisioning completed', churchId, createdAdminId };
  }

  private assertAccess(actor: JwtPayload, churchId: string) {
    if (actor.role === Role.SUPER_ADMIN) {
      return;
    }
    if (actor.role !== Role.ADMIN || !actor.churchId || actor.churchId !== churchId) {
      throw new ForbiddenException('You do not have permission for this church');
    }
  }
}
