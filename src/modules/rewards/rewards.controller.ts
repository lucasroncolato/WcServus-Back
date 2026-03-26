import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListServantRewardsQueryDto } from './dto/list-servant-rewards-query.dto';
import { RewardsService } from './rewards.service';

@ApiTags('Rewards')
@ApiBearerAuth()
@Controller('rewards')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  list(@Query() query: ListServantRewardsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.rewardsService.list(query, user);
  }

  @Get('leaderboard')
  leaderboard(@CurrentUser() user: JwtPayload) {
    return this.rewardsService.leaderboard(user);
  }
}
