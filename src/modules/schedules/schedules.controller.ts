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
import { AutoGenerateScheduleSlotsDto } from './dto/auto-generate-schedule-slots.dto';
import { AssignScheduleSlotDto } from './dto/assign-schedule-slot.dto';
import { ContextualSwapScheduleSlotDto } from './dto/contextual-swap-schedule-slot.dto';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { ListSchedulesQueryDto } from './dto/list-schedules-query.dto';
import { ListEligibleScheduleServantsQueryDto } from './dto/list-eligible-schedule-servants-query.dto';
import { ListScheduleMobileContextQueryDto } from './dto/list-schedule-mobile-context-query.dto';
import { ListScheduleWorkspaceQueryDto } from './dto/list-schedule-workspace-query.dto';
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
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  findAll(@Query() query: ListSchedulesQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.findAll(query, user);
  }

  @Get('eligible-servants')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  eligibleServants(@Query() query: ListEligibleScheduleServantsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.listEligibleServants(query, user);
  }

  @Get('mobile-context')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  mobileContext(@Query() query: ListScheduleMobileContextQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.mobileContext(query, user);
  }

  @Get('operation-modes')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  operationModes() {
    return this.schedulesService.operationModes();
  }

  @Get('period-summary')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  periodSummary(@Query() query: ListScheduleWorkspaceQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.periodSummary(query, user);
  }

  @Get('services-operational-status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  servicesOperationalStatus(@Query() query: ListScheduleWorkspaceQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.servicesOperationalStatus(query, user);
  }

  @Get('services/:serviceId/board')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  serviceBoard(
    @Param('serviceId') serviceId: string,
    @Query() query: ListScheduleWorkspaceQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.serviceBoard(serviceId, query, user);
  }

  @Post('services/:serviceId/slots')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  createSlot(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateScheduleSlotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.createSlot(serviceId, dto, user);
  }

  @Patch('slots/:slotId/assign')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  assignSlot(
    @Param('slotId') slotId: string,
    @Body() dto: AssignScheduleSlotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.assignSlot(slotId, dto, user);
  }

  @Post('slots/:slotId/swap')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  contextualSwapSlot(
    @Param('slotId') slotId: string,
    @Body() dto: ContextualSwapScheduleSlotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.contextualSwapSlot(slotId, dto, user);
  }

  @Post('slots/:slotId/fill')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  fillSlot(
    @Param('slotId') slotId: string,
    @Body() dto: ContextualSwapScheduleSlotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.fillSlot(slotId, dto, user);
  }

  @Post('auto-generate-explained')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  autoGenerateExplained(@Body() dto: AutoGenerateScheduleSlotsDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.autoGenerateExplained(dto, user);
  }

  @Get(':id/history')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  history(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.history(id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  @ApiOperation({ summary: 'Criacao manual de escala (slot especifico)' })
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.create(dto, user);
  }

  @Post('generate-month')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  @ApiOperation({ summary: 'Geracao automatica por mes (ano/mes)' })
  generateMonth(@Body() dto: GenerateMonthScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateMonth(dto, user);
  }

  @Post('generate-period')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  @ApiOperation({ summary: 'Geracao automatica por periodo (data inicial/final)' })
  generatePeriod(@Body() dto: GeneratePeriodScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generatePeriod(dto, user);
  }

  @Post('generate-service')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  @ApiOperation({ summary: 'Geracao automatica para um culto/data especifica' })
  generateService(@Body() dto: GenerateServiceScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateService(dto, user);
  }

  @Post('generate-services')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  @ApiOperation({ summary: 'Geracao automatica para uma lista de cultos' })
  generateServices(@Body() dto: GenerateServicesScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateServices(dto, user);
  }

  @Post('generate-year')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  @ApiOperation({ summary: 'Geracao automatica anual (todos os cultos do ano)' })
  generateYear(@Body() dto: GenerateYearScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.generateYear(dto, user);
  }

  @Post('swap')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  swap(@Body() dto: SwapScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.swap(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.update(id, dto, user);
  }

  @Post(':id/duplicate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
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
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  swapHistory(@Query() query: ListSwapHistoryQueryDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.swapHistory(query, user);
  }
}
