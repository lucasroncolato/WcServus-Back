import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreatePastoralWeeklyFollowUpDto } from './dto/create-pastoral-weekly-follow-up.dto';
import { ListPastoralWeeklyFollowUpsQueryDto } from './dto/list-pastoral-weekly-follow-ups-query.dto';
import { ListPendingPastoralWeeklyFollowUpsQueryDto } from './dto/list-pending-pastoral-weekly-follow-ups-query.dto';
import { PastoralWeeklyFollowUpsService } from './pastoral-weekly-follow-ups.service';

@ApiTags('Pastoral Weekly Follow-Ups')
@ApiBearerAuth()
@Controller('pastoral-weekly-follow-ups')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class PastoralWeeklyFollowUpsController {
  constructor(private readonly pastoralWeeklyFollowUpsService: PastoralWeeklyFollowUpsService) {}

  @Get()
  findAll(@Query() query: ListPastoralWeeklyFollowUpsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.pastoralWeeklyFollowUpsService.findAll(query, user);
  }

  @Get('pending')
  pending(@Query() query: ListPendingPastoralWeeklyFollowUpsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.pastoralWeeklyFollowUpsService.listPendingByWeek(query, user);
  }

  @Post()
  create(@Body() dto: CreatePastoralWeeklyFollowUpDto, @CurrentUser() user: JwtPayload) {
    return this.pastoralWeeklyFollowUpsService.create(dto, user);
  }
}
