import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AutomationRulesController } from './automation-rules.controller';
import { AutomationRulesService } from './automation-rules.service';

@Module({
  imports: [AuditModule],
  controllers: [AutomationRulesController],
  providers: [AutomationRulesService],
  exports: [AutomationRulesService],
})
export class AutomationRulesModule {}
