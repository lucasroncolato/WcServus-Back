import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
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
  async me(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getMyJourney(servantId, user.churchId ?? null);
  }

  @Get('me/summary')
  @Roles(Role.SERVO)
  async summary(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getSummary(servantId, user.churchId ?? null);
  }

  @Get('me/milestones')
  @Roles(Role.SERVO)
  async milestones(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getMilestones(servantId, user.churchId ?? null);
  }

  @Get('me/logs')
  @Roles(Role.SERVO)
  async logs(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getLogs(servantId, user.churchId ?? null);
  }

  @Get('me/indicators')
  @Roles(Role.SERVO)
  async indicators(@CurrentUser() user: JwtPayload) {
    const servantId = this.resolveServantFromAuth(user);
    return this.journeyService.getIndicators(servantId, user.churchId ?? null);
  }
}
