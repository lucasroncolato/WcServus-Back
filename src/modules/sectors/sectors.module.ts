import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SectorsController } from './sectors.controller';
import { SectorsService } from './sectors.service';

@Module({
  imports: [AuditModule],
  controllers: [SectorsController],
  providers: [SectorsService],
  exports: [SectorsService],
})
export class SectorsModule {}