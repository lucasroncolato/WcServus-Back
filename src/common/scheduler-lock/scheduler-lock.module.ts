import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SchedulerLockService } from './scheduler-lock.service';

@Module({
  imports: [PrismaModule],
  providers: [SchedulerLockService],
  exports: [SchedulerLockService],
})
export class SchedulerLockModule {}

