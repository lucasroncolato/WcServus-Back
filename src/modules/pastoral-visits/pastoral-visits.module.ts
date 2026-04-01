import { Module } from '@nestjs/common';
import { SchedulerLockModule } from 'src/common/scheduler-lock/scheduler-lock.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PastoralAlertEngineService } from './pastoral-alert-engine.service';
import { PastoralAlertSchedulerService } from './pastoral-alert-scheduler.service';
import { PastoralController } from './pastoral.controller';
import { PastoralOpsController } from './pastoral-ops.controller';
import { PastoralVisitsController } from './pastoral-visits.controller';
import { PastoralVisitsService } from './pastoral-visits.service';

@Module({
  imports: [AuditModule, NotificationsModule, SchedulerLockModule],
  controllers: [PastoralVisitsController, PastoralController, PastoralOpsController],
  providers: [PastoralVisitsService, PastoralAlertEngineService, PastoralAlertSchedulerService],
  exports: [PastoralVisitsService, PastoralAlertEngineService, PastoralAlertSchedulerService],
})
export class PastoralVisitsModule {}
