import { Controller, Get, Query } from '@nestjs/common';
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
@Controller('timeline/me')
export class TimelineMeController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  @Roles(Role.SERVO)
  @RequireCapabilities(capabilities.timelineReadOwn)
  list(@CurrentUser() actor: JwtPayload, @Query() query: TimelineQueryDto) {
    return this.timelineService.listOwn(actor, query);
  }
}

