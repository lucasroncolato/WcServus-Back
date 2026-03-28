import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MinistriesController } from './ministries.controller';
import { MinistriesService } from './ministries.service';

@Module({
  imports: [AuditModule],
  providers: [MinistriesService],
  controllers: [MinistriesController],
})
export class MinistriesModule {}
