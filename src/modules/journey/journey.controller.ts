import { Body, Controller, ForbiddenException, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { capabilities } from 'src/common/auth/capabilities';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { DismissNextStepDto } from './dto/dismiss-next-step.dto';
import { ListJourneyIndicatorsQueryDto } from './dto/list-journey-indicators.query.dto';
import { ListJourneyLogsQueryDto } from './dto/list-journey-logs.query.dto';
import { JourneyService } from './journey.service';

@ApiTags('Journey')
@ApiBearerAuth()
@Controller('journey')
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  private resolveServantFromAuth(user: JwtPayload) {
    if (user.role !== Role.SERVO) {
      throw new ForbiddenException('Journey is private and available only for SERVO');
    }
    const servantId = user.servantId;
    if (!servantId) {
      throw new ForbiddenException('User is not linked to a servant');
    }
    return servantId;
  }

  @Get('me')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.journeyReadSelf)
  async me(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getMyJourney(servantId, user.churchId ?? null);
  }

  @Get('me/summary')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.journeyReadSelf)
  async summary(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getSummary(servantId, user.churchId ?? null);
  }

  @Get('me/milestones')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.journeyReadSelf)
  async milestones(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getMilestones(servantId, user.churchId ?? null);
  }

  @Get('me/logs')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.journeyReadSelf)
  async logs(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListJourneyLogsQueryDto,
  ) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getLogs(servantId, user.churchId ?? null, query);
  }

  @Get('me/indicators')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.journeyReadSelf)
  async indicators(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListJourneyIndicatorsQueryDto,
  ) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getIndicators(servantId, user.churchId ?? null, query);
  }

  @Get('me/next-steps')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.journeyReadSelf)
  async nextSteps(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getNextSteps(servantId, user.churchId ?? null);
  }

  @Patch('me/next-steps/:id/dismiss')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.journeyReadSelf)
  async dismissNextStep(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() _body: DismissNextStepDto,
  ) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.dismissNextStep(servantId, user.churchId ?? null, id);
  }
}
