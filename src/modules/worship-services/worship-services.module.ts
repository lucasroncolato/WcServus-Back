import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorshipServicesController } from './worship-services.controller';
import { WorshipServicesService } from './worship-services.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [WorshipServicesController],
  providers: [WorshipServicesService],
  exports: [WorshipServicesService],
})
export class WorshipServicesModule {}
