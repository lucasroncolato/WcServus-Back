import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsController } from './settings.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
