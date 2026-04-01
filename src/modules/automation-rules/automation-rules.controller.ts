import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { capabilities } from 'src/common/auth/capabilities';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AutomationRulesService } from './automation-rules.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { AutomationRuleLogsQueryDto } from './dto/automation-rule-logs-query.dto';
import { RunAutomationRuleTestDto } from './dto/run-automation-rule-test.dto';

@ApiTags('Automation Rules')
@ApiBearerAuth()
@Controller('automation-rules')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class AutomationRulesController {
  constructor(private readonly automationRulesService: AutomationRulesService) {}

  @Get()
  @RequireCapabilities(capabilities.automationReadChurch)
  list(@CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.list(actor);
  }

  @Get('catalog/triggers')
  @RequireCapabilities(capabilities.automationReadChurch)
  async triggerCatalog() {
    const catalog = await this.automationRulesService.catalog();
    return catalog.triggers;
  }

  @Get('catalog/conditions')
  @RequireCapabilities(capabilities.automationReadChurch)
  async conditionCatalog() {
    const catalog = await this.automationRulesService.catalog();
    return catalog.conditions;
  }

  @Get('catalog/actions')
  @RequireCapabilities(capabilities.automationReadChurch)
  async actionCatalog() {
    const catalog = await this.automationRulesService.catalog();
    return catalog.actions;
  }

  @Get('logs')
  @RequireCapabilities(capabilities.automationReadChurch)
  logs(@CurrentUser() actor: JwtPayload, @Query() query: AutomationRuleLogsQueryDto) {
    return this.automationRulesService.executionLogs(actor, query);
  }

  @Get(':id')
  @RequireCapabilities(capabilities.automationReadChurch)
  getById(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.getById(id, actor);
  }

  @Get(':id/executions')
  @RequireCapabilities(capabilities.automationReadChurch)
  executionByRule(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
    @Query() query: AutomationRuleLogsQueryDto,
  ) {
    return this.automationRulesService.ruleExecutionLogs(id, actor, query);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  @RequireCapabilities(capabilities.automationManageChurch)
  create(@Body() dto: CreateAutomationRuleDto, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  @RequireCapabilities(capabilities.automationManageChurch)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.automationRulesService.update(id, dto, actor);
  }

  @Patch(':id/enable')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  @RequireCapabilities(capabilities.automationManageChurch)
  enable(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.enable(id, actor);
  }

  @Patch(':id/disable')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  @RequireCapabilities(capabilities.automationManageChurch)
  disable(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.disable(id, actor);
  }

  @Patch(':id/remove')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  @RequireCapabilities(capabilities.automationManageChurch)
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.remove(id, actor);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  @RequireCapabilities(capabilities.automationManageChurch)
  removeLegacy(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.remove(id, actor);
  }

  @Post(':id/run-test')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  @RequireCapabilities(capabilities.automationManageChurch)
  runTest(
    @Param('id') id: string,
    @Body() dto: RunAutomationRuleTestDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.automationRulesService.runTest(id, dto, actor);
  }

  @Get('internal/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequireCapabilities(capabilities.automationManageChurch)
  internalStatus(@CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.internalStatus(actor);
  }

  @Post('internal/reprocess')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequireCapabilities(capabilities.automationManageChurch)
  internalReprocess(
    @CurrentUser() actor: JwtPayload,
    @Body() body?: { churchId?: string; triggerKey?: string },
  ) {
    return this.automationRulesService.internalReprocess(actor, body);
  }
}
