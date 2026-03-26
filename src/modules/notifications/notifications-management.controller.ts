import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListNotificationManagementLogsQueryDto } from './dto/list-notification-management-logs-query.dto';
import {
  NotificationManagementChannel,
  NotificationManagementChannelParamDto,
} from './dto/notification-management-channel.dto';
import { SendNotificationManagementTestDto } from './dto/send-notification-management-test.dto';
import { UpdateNotificationManagementChannelDto } from './dto/update-notification-management-channel.dto';
import { UpdateNotificationManagementPreferencesDto } from './dto/update-notification-management-preferences.dto';
import { NotificationsManagementService } from './notifications-management.service';

@ApiTags('Notifications Management')
@ApiBearerAuth()
@Controller('notifications-management')
export class NotificationsManagementController {
  constructor(private readonly managementService: NotificationsManagementService) {}

  @Get('channels')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  listChannels() {
    return this.managementService.listChannels();
  }

  @Patch('channels/:channel')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  setChannelEnabled(
    @Param() params: NotificationManagementChannelParamDto,
    @Body() dto: UpdateNotificationManagementChannelDto,
  ) {
    return this.managementService.setChannelEnabled(params.channel, dto.enabled);
  }

  @Get('users/:userId/preferences')
  getUserPreferences(@Param('userId') userId: string, @CurrentUser() actor: JwtPayload) {
    return this.managementService.getUserPreferences(userId, actor);
  }

  @Patch('users/:userId/preferences')
  updateUserPreferences(
    @Param('userId') userId: string,
    @Body() dto: UpdateNotificationManagementPreferencesDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.managementService.updateUserPreferences(userId, dto, actor);
  }

  @Get('templates')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  listTemplates() {
    return this.managementService.listTemplates();
  }

  @Post('templates')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  createTemplate(
    @Body() dto: { name: string; event: string; channel: NotificationManagementChannel; content: string },
  ) {
    return this.managementService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: { name?: string; event?: string; channel?: NotificationManagementChannel; content?: string },
  ) {
    return this.managementService.updateTemplate(id, dto);
  }

  @Patch('templates/:id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  setTemplateActive(@Param('id') id: string, @Body() dto: { isActive: boolean }) {
    return this.managementService.setTemplateActive(id, dto.isActive);
  }

  @Get('delivery-logs')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  listDeliveryLogs(@Query() query: ListNotificationManagementLogsQueryDto) {
    return this.managementService.listDeliveryLogs(query);
  }

  @Post('test')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  sendTestMessage(@Body() dto: SendNotificationManagementTestDto) {
    return this.managementService.sendTestMessage(dto);
  }

  @Get('settings')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getSettingsSummary() {
    return this.managementService.getSettingsSummary();
  }
}
