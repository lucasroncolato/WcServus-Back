import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { capabilities } from 'src/common/auth/capabilities';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { TimelineQueryDto } from './dto/timeline-query.dto';
import { TimelineService } from './timeline.service';

@ApiTags('Timeline')
@ApiBearerAuth()
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('church')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  @RequireCapabilities(capabilities.timelineReadChurch)
  church(@CurrentUser() actor: JwtPayload, @Query() query: TimelineQueryDto) {
    return this.timelineService.church(actor, query);
  }

  @Get('ministry/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  @RequireCapabilities(capabilities.timelineReadChurch)
  ministry(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Query() query: TimelineQueryDto) {
    return this.timelineService.ministry(actor, id, query);
  }

  @Get('servant/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  @RequireCapabilities(capabilities.timelineReadChurch)
  servant(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Query() query: TimelineQueryDto) {
    return this.timelineService.servant(actor, id, query);
  }

  @Get('me')
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.timelineReadOwn)
  me(@CurrentUser() actor: JwtPayload, @Query() query: TimelineQueryDto) {
    return this.timelineService.me(actor, query);
  }
}
