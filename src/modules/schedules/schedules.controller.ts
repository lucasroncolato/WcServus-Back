import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { DuplicateScheduleDto } from './dto/duplicate-schedule.dto';
import { GenerateMonthScheduleDto } from './dto/generate-month-schedule.dto';
import { GeneratePeriodScheduleDto } from './dto/generate-period-schedule.dto';
import { GenerateServiceScheduleDto } from './dto/generate-service-schedule.dto';
import { GenerateServicesScheduleDto } from './dto/generate-services-schedule.dto';
import { GenerateYearScheduleDto } from './dto/generate-year-schedule.dto';
import { ListSchedulesQueryDto } from './dto/list-schedules-query.dto';
import { ListSwapHistoryQueryDto } from './dto/list-swap-history-query.dto';
import { SwapScheduleDto } from './dto/swap-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(@Query() query: ListSchedulesQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.findAll(query, user);
  }

  @Get(':id/history')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  history(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.history(id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.create(dto, user);
  }

  @Post('generate-month')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateMonth(@Body() dto: GenerateMonthScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateMonth(dto, user);
  }

  @Post('generate-period')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generatePeriod(@Body() dto: GeneratePeriodScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generatePeriod(dto, user);
  }

  @Post('generate-service')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateService(@Body() dto: GenerateServiceScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateService(dto, user);
  }

  @Post('generate-services')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateServices(@Body() dto: GenerateServicesScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateServices(dto, user);
  }

  @Post('generate-year')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateYear(@Body() dto: GenerateYearScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateYear(dto, user);
  }

  @Post('swap')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  swap(@Body() dto: SwapScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.swap(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.update(id, dto, user);
  }

  @Post(':id/duplicate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  @ApiOperation({ summary: 'Duplicar uma escala para outro culto' })
  @ApiCreatedResponse({ description: 'Escala duplicada com sucesso.' })
  @ApiBadRequestResponse({ description: 'Payload inválido.' })
  @ApiForbiddenResponse({ description: 'Sem permissão de escopo para duplicar esta escala.' })
  @ApiNotFoundResponse({ description: 'Escala origem ou culto destino não encontrado.' })
  @ApiConflictResponse({ description: 'Conflito de escala duplicada no culto destino.' })
  duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateScheduleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.duplicate(id, dto, user);
  }

  @Get('swap-history')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  swapHistory(@Query() query: ListSwapHistoryQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.swapHistory(query, user);
  }
}
