import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EligibilityEngine } from './eligibility/eligibility.engine';
import { ActiveRule } from './eligibility/rules/active.rule';
import { AvailabilityRule } from './eligibility/rules/availability.rule';
import { ConflictRule } from './eligibility/rules/conflict.rule';
import { PastoralRule } from './eligibility/rules/pastoral.rule';
import { TalentRule } from './eligibility/rules/talent.rule';
import { TrainingRule } from './eligibility/rules/training.rule';
import { EligibilityScoreService } from './eligibility/eligibility-score.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [SchedulesController],
  providers: [
    SchedulesService,
    EligibilityEngine,
    ActiveRule,
    TrainingRule,
    PastoralRule,
    AvailabilityRule,
    ConflictRule,
    TalentRule,
    EligibilityScoreService,
  ],
  exports: [SchedulesService],
})
export class SchedulesModule {}
