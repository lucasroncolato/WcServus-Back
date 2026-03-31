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
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
@RequireCapabilities(capabilities.timelineReadChurch)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  list(@CurrentUser() actor: JwtPayload, @Query() query: TimelineQueryDto) {
    return this.timelineService.list(actor, query);
  }

  @Get('summary')
  summary(@CurrentUser() actor: JwtPayload, @Query() query: TimelineQueryDto) {
    return this.timelineService.summary(actor, query);
  }

  @Get(':id')
  detail(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.timelineService.detail(actor, id);
  }
}
