import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MinistryTaskAssigneeRole, Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { MinistryTasksService } from './ministry-tasks.service';
import { AssignMinistryTaskOccurrenceDto } from './dto/assign-ministry-task-occurrence.dto';
import { CancelMinistryTaskOccurrenceDto } from './dto/cancel-ministry-task-occurrence.dto';
import { CreateMinistryTaskTemplateDto } from './dto/create-ministry-task-template.dto';
import { CreateMinistryTaskOccurrenceDto } from './dto/create-ministry-task-occurrence.dto';
import { CompleteMinistryTaskOccurrenceDto } from './dto/complete-ministry-task-occurrence.dto';
import { GenerateMinistryTaskOccurrencesDto } from './dto/generate-ministry-task-occurrences.dto';
import { ListMinistryTaskOccurrencesQueryDto } from './dto/list-ministry-task-occurrences-query.dto';
import { ListMinistryTaskTemplatesQueryDto } from './dto/list-ministry-task-templates-query.dto';
import { UpdateMinistryTaskChecklistDto } from './dto/update-ministry-task-checklist.dto';
import { UpdateMinistryTaskTemplateDto } from './dto/update-ministry-task-template.dto';
import { ReassignMinistryTaskOccurrenceDto } from './dto/reassign-ministry-task-occurrence.dto';
import { ReallocateFromRemovedServantDto } from './dto/reallocate-from-removed-servant.dto';
import { AddMinistryTaskOccurrenceAssigneeDto } from './dto/add-ministry-task-occurrence-assignee.dto';
import { MinistryTaskDashboardQueryDto } from './dto/ministry-task-dashboard-query.dto';

@ApiTags('Ministry Tasks')
@ApiBearerAuth()
@Controller('ministry-tasks')
export class MinistryTasksController {
  constructor(private readonly ministryTasksService: MinistryTasksService) {}

  @Get('templates')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  listTemplates(@Query() query: ListMinistryTaskTemplatesQueryDto, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.listTemplates(query, user);
  }

  @Get('templates/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  getTemplate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.getTemplate(id, user);
  }

  @Post('templates')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  createTemplate(@Body() dto: CreateMinistryTaskTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.createTemplate(dto, user);
  }

  @Patch('templates/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateMinistryTaskTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.updateTemplate(id, dto, user);
  }

  @Delete('templates/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  removeTemplate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.removeTemplate(id, user);
  }

  @Post('templates/:id/generate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateOccurrences(
    @Param('id') id: string,
    @Body() dto: GenerateMinistryTaskOccurrencesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.generateOccurrences(id, dto, user);
  }

  @Get('occurrences')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  listOccurrences(@Query() query: ListMinistryTaskOccurrencesQueryDto, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.listOccurrences(query, user);
  }

  @Get('occurrences/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  getOccurrence(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.getOccurrence(id, user);
  }

  @Post('occurrences')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  createOccurrence(@Body() dto: CreateMinistryTaskOccurrenceDto, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.createOccurrence(dto, user);
  }

  @Patch('occurrences/:id/assign')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  assignOccurrence(
    @Param('id') id: string,
    @Body() dto: AssignMinistryTaskOccurrenceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.assignOccurrence(id, dto, user);
  }

  @Patch('occurrences/:id/reassign')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  reassignOccurrence(
    @Param('id') id: string,
    @Body() dto: ReassignMinistryTaskOccurrenceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.reassignOccurrence(id, dto, user);
  }

  @Post('occurrences/:id/assignees')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  addAssignee(
    @Param('id') id: string,
    @Body() dto: AddMinistryTaskOccurrenceAssigneeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.addAssignee(id, dto, user);
  }

  @Delete('occurrences/:id/assignees/:servantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  removeAssignee(
    @Param('id') id: string,
    @Param('servantId') servantId: string,
    @Query('role') role: MinistryTaskAssigneeRole | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.removeAssignee(id, servantId, role, user);
  }

  @Patch('occurrences/:id/checklist')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.SERVO)
  updateChecklist(
    @Param('id') id: string,
    @Body() dto: UpdateMinistryTaskChecklistDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.updateChecklist(id, dto, user);
  }

  @Patch('occurrences/:id/complete')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.SERVO)
  completeOccurrence(
    @Param('id') id: string,
    @Body() dto: CompleteMinistryTaskOccurrenceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.completeOccurrence(id, dto, user);
  }

  @Patch('occurrences/:id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  cancelOccurrence(
    @Param('id') id: string,
    @Body() dto: CancelMinistryTaskOccurrenceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.cancelOccurrence(id, dto, user);
  }

  @Post('reallocate-from-removed-servant')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  reallocateFromRemovedServant(
    @Body() dto: ReallocateFromRemovedServantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.reallocateFromRemovedServant(dto, user);
  }

  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  dashboard(@Query() query: MinistryTaskDashboardQueryDto, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.dashboard(query, user);
  }

  @Get('dashboard/my')
  @Roles(Role.SERVO)
  dashboardMy(@Query() query: MinistryTaskDashboardQueryDto, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.dashboard(query, user);
  }

  @Get('dashboard/ministry/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  dashboardByMinistry(
    @Param('id') id: string,
    @Query() query: MinistryTaskDashboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministryTasksService.dashboard(query, user, id);
  }

  @Post('jobs/recurrence-run')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  runRecurrenceJob(@Query('dryRun') dryRun: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.ministryTasksService.runRecurringGenerationJob({
      dryRun: dryRun === 'true',
      actorUserId: user.sub,
    });
  }
}
