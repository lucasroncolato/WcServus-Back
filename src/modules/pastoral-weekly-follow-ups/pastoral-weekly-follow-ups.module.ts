import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PastoralWeeklyFollowUpsController } from './pastoral-weekly-follow-ups.controller';
import { PastoralWeeklyFollowUpsService } from './pastoral-weekly-follow-ups.service';

@Module({
  imports: [AuditModule],
  controllers: [PastoralWeeklyFollowUpsController],
  providers: [PastoralWeeklyFollowUpsService],
  exports: [PastoralWeeklyFollowUpsService],
})
export class PastoralWeeklyFollowUpsModule {}
