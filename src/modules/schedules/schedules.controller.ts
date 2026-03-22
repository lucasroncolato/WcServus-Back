import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GenerateMonthScheduleDto } from './dto/generate-month-schedule.dto';
import { GenerateYearScheduleDto } from './dto/generate-year-schedule.dto';
import { ListSchedulesQueryDto } from './dto/list-schedules-query.dto';
import { SwapScheduleDto } from './dto/swap-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(@Query() query: ListSchedulesQueryDto) {
    return this.schedulesService.findAll(query);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.create(dto, user.sub);
  }

  @Post('generate-month')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateMonth(@Body() dto: GenerateMonthScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateMonth(dto, user.sub);
  }

  @Post('generate-year')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateYear(@Body() dto: GenerateYearScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateYear(dto, user.sub);
  }

  @Post('swap')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  swap(@Body() dto: SwapScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.swap(dto, user.sub);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.update(id, dto, user.sub);
  }

  @Get('swap-history')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  swapHistory(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(Number(limit) || 100, 200);
    return this.schedulesService.swapHistory(parsedLimit);
  }
}
