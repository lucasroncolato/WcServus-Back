import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateWhatsappGlobalSettingDto } from './dto/update-whatsapp-global-setting.dto';
import { NotificationSettingsService } from './notification-settings.service';

@ApiTags('Notification Settings')
@ApiBearerAuth()
@Controller('notifications/settings')
export class NotificationSettingsController {
  constructor(private readonly settingsService: NotificationSettingsService) {}

  @Get('whatsapp-global')
  @Roles(Role.SUPER_ADMIN)
  getWhatsappGlobalSetting() {
    return this.settingsService.getWhatsappGlobalSetting();
  }

  @Patch('whatsapp-global')
  @Roles(Role.SUPER_ADMIN)
  updateWhatsappGlobalSetting(@Body() dto: UpdateWhatsappGlobalSettingDto) {
    return this.settingsService.updateWhatsappGlobalSetting(dto.enabled);
  }

  @Get('operational')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getOperationalSettings() {
    return this.settingsService.getWhatsappOperationalSetting();
  }

  @Patch('operational')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateOperationalSettings(@Body() dto: UpdateWhatsappGlobalSettingDto) {
    return this.settingsService.updateWhatsappOperationalSetting(dto.enabled);
  }
}
