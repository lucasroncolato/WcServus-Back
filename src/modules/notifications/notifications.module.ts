import { Module } from '@nestjs/common';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationsManagementController } from './notifications-management.controller';
import { NotificationsManagementService } from './notifications-management.service';
import { NotificationTemplatesController } from './notification-templates.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WhatsappController } from './whatsapp.controller';
import { NotificationTemplatesService } from './notification-templates.service';
import { MetaCloudWhatsappProvider } from './whatsapp/providers/meta-cloud-whatsapp.provider';
import { MockWhatsappProvider } from './whatsapp/providers/mock-whatsapp.provider';
import { WhatsappProviderService } from './whatsapp/whatsapp-provider.service';
import { WhatsappService } from './whatsapp/whatsapp.service';

@Module({
  controllers: [
    NotificationsController,
    NotificationsManagementController,
    NotificationTemplatesController,
    NotificationSettingsController,
    WhatsappController,
  ],
  providers: [
    NotificationsService,
    NotificationsManagementService,
    NotificationSettingsService,
    NotificationTemplatesService,
    WhatsappService,
    WhatsappProviderService,
    MockWhatsappProvider,
    MetaCloudWhatsappProvider,
  ],
  exports: [NotificationsService, WhatsappService, NotificationTemplatesService, NotificationSettingsService],
})
export class NotificationsModule {}
