import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MinistryTasksController } from './ministry-tasks.controller';
import { MinistryTasksService } from './ministry-tasks.service';
import { MinistryTasksScheduler } from './ministry-tasks.scheduler';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, GamificationModule],
  controllers: [MinistryTasksController],
  providers: [MinistryTasksService, MinistryTasksScheduler],
  exports: [MinistryTasksService],
})
export class MinistryTasksModule {}
