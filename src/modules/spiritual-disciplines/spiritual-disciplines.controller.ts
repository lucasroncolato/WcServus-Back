import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListDailyDevotionalsQueryDto } from './dto/list-daily-devotionals-query.dto';
import { ListMonthlyFastingsQueryDto } from './dto/list-monthly-fastings-query.dto';
import { RegisterDailyDevotionalDto } from './dto/register-daily-devotional.dto';
import { RegisterMonthlyFastingDto } from './dto/register-monthly-fasting.dto';
import { SpiritualDisciplinesService } from './spiritual-disciplines.service';

@ApiTags('Spiritual Disciplines')
@ApiBearerAuth()
@Controller('spiritual-disciplines')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.SERVO)
export class SpiritualDisciplinesController {
  constructor(private readonly spiritualDisciplinesService: SpiritualDisciplinesService) {}

  @Post('devotionals')
  registerDailyDevotional(
    @Body() dto: RegisterDailyDevotionalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.spiritualDisciplinesService.registerDailyDevotional(dto, user);
  }

  @Get('devotionals')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  listDailyDevotionals(
    @Query() query: ListDailyDevotionalsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.spiritualDisciplinesService.listDailyDevotionals(query, user);
  }

  @Post('fastings')
  registerMonthlyFasting(
    @Body() dto: RegisterMonthlyFastingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.spiritualDisciplinesService.registerMonthlyFasting(dto, user);
  }

  @Get('fastings')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  listMonthlyFastings(
    @Query() query: ListMonthlyFastingsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.spiritualDisciplinesService.listMonthlyFastings(query, user);
  }
}
