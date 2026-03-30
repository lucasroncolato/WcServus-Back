import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { ServiceTemplatesController } from './service-templates.controller';
import { ServiceTemplatesService } from './service-templates.service';

@Module({
  imports: [SchedulesModule, AuditModule],
  controllers: [ServiceTemplatesController],
  providers: [ServiceTemplatesService],
  exports: [ServiceTemplatesService],
})
export class ServiceTemplatesModule {}
