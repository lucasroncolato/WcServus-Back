import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { capabilities } from 'src/common/auth/capabilities';
import { AnalyticsSnapshotScheduler } from './analytics-snapshot.scheduler';
import { AnalyticsSnapshotService } from './analytics-snapshot.service';

@ApiTags('AnalyticsOps')
@ApiBearerAuth()
@Controller('analytics/internal')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AnalyticsOpsController {
  constructor(
    private readonly scheduler: AnalyticsSnapshotScheduler,
    private readonly snapshots: AnalyticsSnapshotService,
  ) {}

  @Post('refresh-snapshots')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  refreshAll(@Query('churchId') churchId?: string) {
    return this.scheduler.runNow(churchId);
  }

  @Post('refresh-snapshots/church/:churchId')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  refreshChurch(@Param('churchId') churchId: string) {
    return this.scheduler.runNow(churchId);
  }

  @Post('refresh-snapshots/ministry/:ministryId')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  refreshMinistry(@Param('ministryId') ministryId: string) {
    return this.snapshots.refreshMinistryById(ministryId);
  }

  @Post('refresh-snapshots/team/:teamId')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  refreshTeam(@Param('teamId') teamId: string) {
    return this.snapshots.refreshTeamById(teamId);
  }

  @Post('refresh-snapshots/servant/:servantId')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  refreshServant(@Param('servantId') servantId: string) {
    return this.snapshots.refreshServantById(servantId);
  }

  @Get('snapshot-status')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  status() {
    return this.snapshots.getSnapshotStatus();
  }
}
