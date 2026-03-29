import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, ChurchModuleKey, PlanInterval, Role, SubscriptionStatus, UserScope } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PublicOnboardingChurchDto, PublicOnboardingSetupDto } from './dto/public-onboarding.dto';

@Injectable()
export class PublicOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createChurch(dto: PublicOnboardingChurchDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.adminEmail.toLowerCase() } });
    if (existing) {
      throw new BadRequestException('Admin email already in use');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const church = await tx.church.create({
        data: { name: dto.churchName.trim(), city: dto.city?.trim(), state: dto.state?.trim() },
      });

      const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
      const admin = await tx.user.create({
        data: {
          name: dto.adminName.trim(),
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          role: Role.ADMIN,
          scope: UserScope.GLOBAL,
          churchId: church.id,
        },
      });

      await tx.churchSettings.create({ data: { churchId: church.id } });
      await tx.churchBranding.create({ data: { churchId: church.id } });
      await tx.churchAutomationPreference.create({ data: { churchId: church.id } });

      const baseModules = Object.values(ChurchModuleKey).map((moduleKey) => ({
        churchId: church.id,
        moduleKey,
        enabled: true,
      }));
      await tx.churchModule.createMany({ data: baseModules });

      const starterPlan =
        (await tx.plan.findUnique({ where: { code: 'STARTER' } })) ??
        (await tx.plan.create({
          data: {
            code: 'STARTER',
            name: 'Starter',
            description: 'Plano inicial para onboarding',
            interval: PlanInterval.MONTHLY,
            priceCents: 0,
            active: true,
          },
        }));

      await tx.churchPlan.upsert({
        where: { churchId: church.id },
        create: {
          churchId: church.id,
          planId: starterPlan.id,
          status: SubscriptionStatus.TRIAL,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        update: {
          planId: starterPlan.id,
          status: SubscriptionStatus.TRIAL,
        },
      });

      await tx.subscription.create({
        data: {
          churchId: church.id,
          planId: starterPlan.id,
          status: SubscriptionStatus.TRIAL,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          startsAt: new Date(),
          createdBy: admin.id,
          metadata: { source: 'public-onboarding' },
        },
      });

      return { church, admin };
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ChurchOnboarding',
      entityId: created.church.id,
      churchId: created.church.id,
      userId: created.admin.id,
      metadata: { source: 'public' },
    });

    return {
      message: 'Church onboarding started',
      churchId: created.church.id,
      adminUserId: created.admin.id,
    };
  }

  async setup(dto: PublicOnboardingSetupDto) {
    await this.prisma.churchBranding.upsert({
      where: { churchId: dto.churchId },
      create: {
        churchId: dto.churchId,
        primaryColor: dto.primaryColor,
        logoUrl: dto.logoUrl,
        welcomeMessage: dto.welcomeMessage,
      },
      update: {
        primaryColor: dto.primaryColor,
        logoUrl: dto.logoUrl,
        welcomeMessage: dto.welcomeMessage,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'ChurchOnboardingSetup',
      entityId: dto.churchId,
      churchId: dto.churchId,
      metadata: { source: 'public-setup' },
    });

    return { message: 'Setup completed', churchId: dto.churchId };
  }
}
