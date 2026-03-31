import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [NotificationsModule, AuditModule, SchedulesModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
