import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { WorshipServicesController } from './worship-services.controller';
import { WorshipServicesService } from './worship-services.service';

@Module({
  imports: [AuditModule, NotificationsModule, SchedulesModule],
  controllers: [WorshipServicesController],
  providers: [WorshipServicesService],
  exports: [WorshipServicesService],
})
export class WorshipServicesModule {}
