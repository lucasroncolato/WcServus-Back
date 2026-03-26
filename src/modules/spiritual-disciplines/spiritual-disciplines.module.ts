import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RewardsModule } from '../rewards/rewards.module';
import { SpiritualDisciplinesController } from './spiritual-disciplines.controller';
import { SpiritualDisciplinesService } from './spiritual-disciplines.service';

@Module({
  imports: [AuditModule, RewardsModule],
  controllers: [SpiritualDisciplinesController],
  providers: [SpiritualDisciplinesService],
  exports: [SpiritualDisciplinesService],
})
export class SpiritualDisciplinesModule {}
