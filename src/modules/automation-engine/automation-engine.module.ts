import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MinistryTasksModule } from '../ministry-tasks/ministry-tasks.module';
import { TimelineModule } from '../timeline/timeline.module';
import { AutomationEngineScheduler } from './automation-engine.scheduler';
import { AutomationEngineService } from './automation-engine.service';

@Module({
  imports: [MinistryTasksModule, AuditModule, TimelineModule],
  providers: [AutomationEngineService, AutomationEngineScheduler],
  exports: [AutomationEngineService],
})
export class AutomationEngineModule {}
