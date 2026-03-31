import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { PastoralAlertSchedulerService } from './pastoral-alert-scheduler.service';

@ApiTags('Pastoral Internal Ops')
@ApiBearerAuth()
@Controller('pastoral/internal')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class PastoralOpsController {
  constructor(
    private readonly schedulerService: PastoralAlertSchedulerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('reprocess-alerts')
  reprocessAlerts(@Query('churchId') churchId?: string) {
    return this.schedulerService.runNow(churchId);
  }

  @Get('engine-status')
  async engineStatus() {
    const [openAlerts, highOpenAlerts, resolvedLast7d] = await Promise.all([
      this.prisma.pastoralAlert.count({
        where: { status: 'OPEN', deletedAt: null },
      }),
      this.prisma.pastoralAlert.count({
        where: { status: 'OPEN', severity: 'HIGH', deletedAt: null },
      }),
      this.prisma.pastoralAlert.count({
        where: {
          status: 'RESOLVED',
          deletedAt: null,
          resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      openAlerts,
      highOpenAlerts,
      resolvedLast7d,
      engineEnabled: process.env.PASTORAL_ALERT_ENGINE_ENABLED !== 'false',
      intervalMs: Number(process.env.PASTORAL_ALERT_ENGINE_INTERVAL_MS ?? 24 * 60 * 60 * 1000),
    };
  }
}
