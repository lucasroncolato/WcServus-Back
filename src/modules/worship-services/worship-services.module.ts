import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WorshipServicesController } from './worship-services.controller';
import { WorshipServicesService } from './worship-services.service';

@Module({
  imports: [AuditModule],
  controllers: [WorshipServicesController],
  providers: [WorshipServicesService],
  exports: [WorshipServicesService],
})
export class WorshipServicesModule {}