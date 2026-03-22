import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ServantsController } from './servants.controller';
import { ServantsService } from './servants.service';

@Module({
  imports: [AuditModule],
  controllers: [ServantsController],
  providers: [ServantsService],
  exports: [ServantsService],
})
export class ServantsModule {}