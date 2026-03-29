import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { capabilities } from 'src/common/auth/capabilities';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import {
  UpdateChurchAutomationPreferencesDto,
  UpdateChurchBrandingDto,
  UpdateChurchSettingsDto,
  UpsertChurchModuleDto,
} from './dto/church-admin.dto';
import { ChurchAdminService } from './church-admin.service';

@ApiTags('Church Admin')
@ApiBearerAuth()
@Controller('admin/churchs')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class ChurchAdminController {
  constructor(private readonly service: ChurchAdminService) {}

  @Get(':id/settings')
  @RequireCapabilities(capabilities.churchSettingsManage)
  get(@Param('id') churchId: string, @CurrentUser() actor: JwtPayload) {
    return this.service.get(churchId, actor);
  }

  @Patch(':id/settings')
  @RequireCapabilities(capabilities.churchSettingsManage)
  updateSettings(
    @Param('id') churchId: string,
    @Body() dto: UpdateChurchSettingsDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.updateSettings(churchId, dto, actor);
  }

  @Patch(':id/branding')
  @RequireCapabilities(capabilities.churchBrandingManage)
  updateBranding(
    @Param('id') churchId: string,
    @Body() dto: UpdateChurchBrandingDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.updateBranding(churchId, dto, actor);
  }

  @Patch(':id/modules')
  @RequireCapabilities(capabilities.churchSettingsManage)
  updateModules(
    @Param('id') churchId: string,
    @Body() modules: UpsertChurchModuleDto[],
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.upsertModules(churchId, modules, actor);
  }

  @Patch(':id/automation-preferences')
  @RequireCapabilities(capabilities.automationManageChurch)
  updateAutomationPreferences(
    @Param('id') churchId: string,
    @Body() dto: UpdateChurchAutomationPreferencesDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.updateAutomationPreferences(churchId, dto, actor);
  }

  @Post(':id/provision')
  @RequireCapabilities(capabilities.onboardingProvision)
  provision(
    @Param('id') churchId: string,
    @Body() input: { adminEmail?: string; adminName?: string; adminPassword?: string },
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.provision(churchId, actor, input);
  }
}
