import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MinistryTasksModule } from '../ministry-tasks/ministry-tasks.module';
import { AutomationEngineScheduler } from './automation-engine.scheduler';
import { AutomationEngineService } from './automation-engine.service';

@Module({
  imports: [MinistryTasksModule, AuditModule],
  providers: [AutomationEngineService, AutomationEngineScheduler],
  exports: [AutomationEngineService],
})
export class AutomationEngineModule {}
