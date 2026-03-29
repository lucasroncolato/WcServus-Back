import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ChurchAdminController } from './church-admin.controller';
import { ChurchAdminService } from './church-admin.service';

@Module({
  imports: [AuditModule],
  controllers: [ChurchAdminController],
  providers: [ChurchAdminService],
  exports: [ChurchAdminService],
})
export class ChurchAdminModule {}
