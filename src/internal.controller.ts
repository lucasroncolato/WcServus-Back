import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Roles } from './common/decorators/roles.decorator';
import { AppMetricsService } from './common/observability/app-metrics.service';
import { AnalyticsSnapshotScheduler } from './modules/analytics/analytics-snapshot.scheduler';
import { AutomationsSchedulerService } from './modules/automation-rules/automations-scheduler.service';
import { JourneyReconcileScheduler } from './modules/journey/journey-reconcile.scheduler';
import { PastoralAlertSchedulerService } from './modules/pastoral-visits/pastoral-alert-scheduler.service';
import { PrismaService } from './prisma/prisma.service';

@Controller('internal')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metricsService: AppMetricsService,
    private readonly analyticsSnapshotScheduler: AnalyticsSnapshotScheduler,
    private readonly automationsSchedulerService: AutomationsSchedulerService,
    private readonly pastoralAlertSchedulerService: PastoralAlertSchedulerService,
    private readonly journeyReconcileScheduler: JourneyReconcileScheduler,
  ) {}

  @Get('metrics')
  metrics() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      application: this.metricsService.getSnapshot(),
      routes: this.metricsService.getRoutesSnapshot(),
      jobs: this.metricsService.getJobsSnapshot(),
      cache: this.metricsService.getCacheSnapshot(),
      db: this.metricsService.getDbSnapshot(),
    };
  }

  @Get('status')
  status() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? 'development',
        uptimeSec: Math.round(process.uptime()),
        schedulersEnabled: {
          analyticsSnapshot: this.analyticsSnapshotScheduler.isEnabled(),
          automations: this.automationsSchedulerService.isEnabled(),
          pastoralAlert: this.pastoralAlertSchedulerService.isEnabled(),
          journeyReconcile: this.journeyReconcileScheduler.isEnabled(),
        },
      },
      integrations: {
        redisConfigured: Boolean(this.configService.get<string>('REDIS_URL')),
        queueConfigured: Boolean(this.configService.get<string>('QUEUE_DRIVER')),
      },
    };
  }

  @Get('schedulers')
  schedulers() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      schedulers: {
        analyticsSnapshot: this.analyticsSnapshotScheduler.status(),
        automations: this.automationsSchedulerService.status(),
        pastoralAlert: this.pastoralAlertSchedulerService.status(),
        journeyReconcile: this.journeyReconcileScheduler.status(),
      },
    };
  }

  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: 'ok',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp: new Date().toISOString(),
        db: 'unavailable',
      });
    }
  }
}
