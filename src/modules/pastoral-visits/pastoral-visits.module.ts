import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PastoralVisitsController } from './pastoral-visits.controller';
import { PastoralVisitsService } from './pastoral-visits.service';

@Module({
  imports: [AuditModule],
  controllers: [PastoralVisitsController],
  providers: [PastoralVisitsService],
  exports: [PastoralVisitsService],
})
export class PastoralVisitsModule {}