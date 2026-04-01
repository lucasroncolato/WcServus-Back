import { Module } from '@nestjs/common';
import { SchedulerLockModule } from 'src/common/scheduler-lock/scheduler-lock.module';
import { AuditModule } from '../audit/audit.module';
import { TimelineModule } from '../timeline/timeline.module';
import { AutomationRulesController } from './automation-rules.controller';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationActionExecutorRegistry } from './executors/automation-action-executor.registry';
import { AutomationsEngineService } from './automations-engine.service';
import { AutomationsSchedulerService } from './automations-scheduler.service';
import { AutomationsSchedulerRunner } from './automations-scheduler.runner';
import { AutomationCheckpointService } from './automation-checkpoint.service';

@Module({
  imports: [AuditModule, TimelineModule, SchedulerLockModule],
  controllers: [AutomationRulesController],
  providers: [
    AutomationRulesService,
    AutomationActionExecutorRegistry,
    AutomationsEngineService,
    AutomationsSchedulerService,
    AutomationsSchedulerRunner,
    AutomationCheckpointService,
  ],
  exports: [AutomationRulesService, AutomationsEngineService, AutomationsSchedulerService],
})
export class AutomationRulesModule {}
