import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { capabilities } from 'src/common/auth/capabilities';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('church')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  church(@CurrentUser() actor: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.church(actor, query);
  }

  @Get('ministry/:id')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  ministry(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.ministry(actor, id, query);
  }

  @Get('servant/:id')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  servant(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.servant(actor, id, query);
  }

  @Get('team/:id')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  team(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.team(actor, id, query);
  }

  @Get('timeline/summary')
  @RequireCapabilities(capabilities.analyticsReadChurch)
  timelineSummary(@CurrentUser() actor: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.timelineSummary(actor, query);
  }
}
