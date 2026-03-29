import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { GamificationController } from './gamification.controller';
import { GamificationScheduler } from './gamification.scheduler';
import { GamificationService } from './gamification.service';

@Module({
  imports: [AuditModule],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationScheduler],
  exports: [GamificationService],
})
export class GamificationModule {}
