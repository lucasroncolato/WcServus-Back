import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JourneyReconcileService } from './journey-reconcile.service';

@ApiTags('JourneyOps')
@ApiBearerAuth()
@Controller('journey/internal')
export class JourneyOpsController {
  constructor(private readonly reconcileService: JourneyReconcileService) {}

  @Post('reconcile')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async runReconcile(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.reconcileService.reconcileDaily(Number.isFinite(parsed) && parsed > 0 ? parsed : 200);
  }

  @Post('rebuild/servant/:servantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async rebuildServant(
    @Param('servantId') servantId: string,
    @Body() body: { churchId?: string | null },
  ) {
    return this.reconcileService.rebuildJourneyForServant(servantId, body?.churchId ?? null);
  }

  @Post('rebuild/all')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async rebuildAll(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.reconcileService.rebuildAllJourneys(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
  }

  @Get('status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async status() {
    return this.reconcileService.getCheckpointStatus();
  }
}

