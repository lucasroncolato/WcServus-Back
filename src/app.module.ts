import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ChurchScopeGuard } from './common/guards/church-scope.guard';
import { PasswordChangeRequiredGuard } from './common/guards/password-change-required.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CapabilitiesGuard } from './common/guards/capabilities.guard';
import { AppCacheModule } from './common/cache/cache.module';
import { EventsModule } from './common/events/events.module';
import { LogModule } from './common/log/log.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { RequestMetricsInterceptor } from './common/observability/request-metrics.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ServantsModule } from './modules/servants/servants.module';
import { WorshipServicesModule } from './modules/worship-services/worship-services.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { AttendancesModule } from './modules/attendances/attendances.module';
import { PastoralVisitsModule } from './modules/pastoral-visits/pastoral-visits.module';
import { TalentsModule } from './modules/talents/talents.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MeModule } from './modules/me/me.module';
import { TeamsModule } from './modules/teams/teams.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PastoralWeeklyFollowUpsModule } from './modules/pastoral-weekly-follow-ups/pastoral-weekly-follow-ups.module';
import { SpiritualDisciplinesModule } from './modules/spiritual-disciplines/spiritual-disciplines.module';
import { SupportRequestsModule } from './modules/support-requests/support-requests.module';
import { MinistriesModule } from './modules/ministries/ministries.module';
import { MinistryTasksModule } from './modules/ministry-tasks/ministry-tasks.module';
import { JourneyModule } from './modules/journey/journey.module';
import { AutomationRulesModule } from './modules/automation-rules/automation-rules.module';
import { AutomationEngineModule } from './modules/automation-engine/automation-engine.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { ChurchAdminModule } from './modules/church-admin/church-admin.module';
import { PublicOnboardingModule } from './modules/public-onboarding/public-onboarding.module';
import { IntegrityModule } from './modules/integrity/integrity.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { PermissionPolicyService } from './common/auth/permission-policy.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    LogModule,
    ObservabilityModule,
    EventsModule,
    AppCacheModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ServantsModule,
    WorshipServicesModule,
    SchedulesModule,
    AttendancesModule,
    PastoralVisitsModule,
    TalentsModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
    NotificationsModule,
    MeModule,
    TeamsModule,
    SettingsModule,
    PastoralWeeklyFollowUpsModule,
    SpiritualDisciplinesModule,
    SupportRequestsModule,
    MinistriesModule,
    MinistryTasksModule,
    JourneyModule,
    AutomationRulesModule,
    AutomationEngineModule,
    AnalyticsModule,
    TimelineModule,
    ChurchAdminModule,
    PublicOnboardingModule,
    IntegrityModule,
  ],
  controllers: [HealthController],
  providers: [
    PermissionPolicyService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PasswordChangeRequiredGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ChurchScopeGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CapabilitiesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
