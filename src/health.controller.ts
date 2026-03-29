import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { AppMetricsService } from './common/observability/app-metrics.service';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metricsService: AppMetricsService,
  ) {}

  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('db')
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', target: 'db', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', target: 'db' });
    }
  }

  @Public()
  @Get('redis')
  redis() {
    const configured = Boolean(this.configService.get<string>('REDIS_URL'));
    return {
      status: configured ? 'ok' : 'not_configured',
      target: 'redis',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('queue')
  queue() {
    const configured = Boolean(this.configService.get<string>('QUEUE_DRIVER'));
    return {
      status: configured ? 'ok' : 'not_configured',
      target: 'queue',
      timestamp: new Date().toISOString(),
    };
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('metrics')
  metrics() {
    return {
      status: 'ok',
      target: 'metrics',
      timestamp: new Date().toISOString(),
      application: this.metricsService.getSnapshot(),
    };
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('metrics/routes')
  routeMetrics() {
    return {
      status: 'ok',
      target: 'metrics.routes',
      timestamp: new Date().toISOString(),
      routes: this.metricsService.getRoutesSnapshot(),
    };
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('metrics/jobs')
  jobMetrics() {
    return {
      status: 'ok',
      target: 'metrics.jobs',
      timestamp: new Date().toISOString(),
      jobs: this.metricsService.getJobsSnapshot(),
    };
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('metrics/cache')
  cacheMetrics() {
    return {
      status: 'ok',
      target: 'metrics.cache',
      timestamp: new Date().toISOString(),
      cache: this.metricsService.getCacheSnapshot(),
    };
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('metrics/db')
  dbMetrics() {
    return {
      status: 'ok',
      target: 'metrics.db',
      timestamp: new Date().toISOString(),
      db: this.metricsService.getDbSnapshot(),
    };
  }
}
