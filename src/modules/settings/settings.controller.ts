import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateWhatsappGlobalSettingDto } from '../notifications/dto/update-whatsapp-global-setting.dto';
import { NotificationSettingsService } from '../notifications/notification-settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly notificationSettingsService: NotificationSettingsService) {}

  @Get('global')
  @Roles(Role.SUPER_ADMIN)
  getGlobalSettings() {
    return this.notificationSettingsService.getWhatsappGlobalSetting();
  }

  @Patch('global')
  @Roles(Role.SUPER_ADMIN)
  updateGlobalSettings(@Body() dto: UpdateWhatsappGlobalSettingDto) {
    return this.notificationSettingsService.updateWhatsappGlobalSetting(dto.enabled);
  }

  @Get('operational')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getOperationalSettings() {
    return this.notificationSettingsService.getWhatsappOperationalSetting();
  }

  @Patch('operational')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateOperationalSettings(@Body() dto: UpdateWhatsappGlobalSettingDto) {
    return this.notificationSettingsService.updateWhatsappOperationalSetting(dto.enabled);
  }
}
