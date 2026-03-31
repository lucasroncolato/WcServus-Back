import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CompletePastoralFollowUpDto } from './dto/complete-pastoral-follow-up.dto';
import { CreatePastoralFollowUpDto } from './dto/create-pastoral-follow-up.dto';
import { CreatePastoralNoteDto } from './dto/create-pastoral-note.dto';
import { CreatePastoralVisitDto } from './dto/create-pastoral-visit.dto';
import { ListPastoralAlertsQueryDto } from './dto/list-pastoral-alerts-query.dto';
import { ListPastoralVisitsQueryDto } from './dto/list-pastoral-visits-query.dto';
import { ResolvePastoralAlertDto } from './dto/resolve-pastoral-alert.dto';
import { UpdatePastoralVisitDto } from './dto/update-pastoral-visit.dto';
import { PastoralVisitsService } from './pastoral-visits.service';

@ApiTags('Pastoral')
@ApiBearerAuth()
@Controller('pastoral')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class PastoralController {
  constructor(private readonly pastoralService: PastoralVisitsService) {}

  @Get('alerts')
  listAlerts(@Query() query: ListPastoralAlertsQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.pastoralService.listAlerts(query, actor);
  }

  @Patch('alerts/:id/resolve')
  resolveAlert(
    @Param('id') id: string,
    @Body() dto: ResolvePastoralAlertDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.pastoralService.resolveAlert(id, dto, actor);
  }

  @Post('alerts/:id/open-record')
  openRecordFromAlert(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.pastoralService.openRecordFromAlert(id, actor);
  }

  @Get('records')
  listRecords(@Query() query: ListPastoralVisitsQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.pastoralService.listRecords(query, actor);
  }

  @Post('records')
  createRecord(@Body() dto: CreatePastoralVisitDto, @CurrentUser() actor: JwtPayload) {
    return this.pastoralService.createRecord(dto, actor);
  }

  @Get('records/:id')
  getRecord(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.pastoralService.getRecordById(id, actor);
  }

  @Patch('records/:id')
  updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdatePastoralVisitDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.pastoralService.updateRecord(id, dto, actor);
  }

  @Post('records/:id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: CreatePastoralNoteDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.pastoralService.addNote(id, dto, actor);
  }

  @Post('records/:id/follow-ups')
  addFollowUp(
    @Param('id') id: string,
    @Body() dto: CreatePastoralFollowUpDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.pastoralService.addFollowUp(id, dto, actor);
  }

  @Patch('follow-ups/:id/complete')
  completeFollowUp(
    @Param('id') id: string,
    @Body() dto: CompletePastoralFollowUpDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.pastoralService.completeFollowUp(id, dto, actor);
  }

  @Get('servants/:servantId/summary')
  servantSummary(@Param('servantId') servantId: string, @CurrentUser() actor: JwtPayload) {
    return this.pastoralService.summaryByServant(servantId, actor);
  }

  @Get('servants/:servantId/history')
  servantHistory(@Param('servantId') servantId: string, @CurrentUser() actor: JwtPayload) {
    return this.pastoralService.historyByServant(servantId, actor);
  }
}
