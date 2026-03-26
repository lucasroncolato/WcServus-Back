import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ServantsModule } from './modules/servants/servants.module';
import { SectorsModule } from './modules/sectors/sectors.module';
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
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ServantsModule,
    SectorsModule,
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
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
