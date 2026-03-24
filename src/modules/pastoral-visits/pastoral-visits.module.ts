import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PastoralVisitsController } from './pastoral-visits.controller';
import { PastoralVisitsService } from './pastoral-visits.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [PastoralVisitsController],
  providers: [PastoralVisitsService],
  exports: [PastoralVisitsService],
})
export class PastoralVisitsModule {}
