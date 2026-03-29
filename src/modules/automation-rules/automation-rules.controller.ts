import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AutomationRulesService } from './automation-rules.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

@ApiTags('Automation Rules')
@ApiBearerAuth()
@Controller('automation-rules')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AutomationRulesController {
  constructor(private readonly automationRulesService: AutomationRulesService) {}

  @Get()
  list(@CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.list(actor);
  }

  @Get('logs')
  logs(@CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.executionLogs(actor);
  }

  @Post()
  create(@Body() dto: CreateAutomationRuleDto, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.automationRulesService.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.remove(id, actor);
  }
}
