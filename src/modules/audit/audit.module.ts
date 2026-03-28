import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit-log.service';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditLogService],
  exports: [AuditService, AuditLogService],
})
export class AuditModule {}
