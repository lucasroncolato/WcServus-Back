import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AutomationRulesModule } from '../automation-rules/automation-rules.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MinistryTasksController } from './ministry-tasks.controller';
import { MinistryTasksService } from './ministry-tasks.service';
import { MinistryTasksScheduler } from './ministry-tasks.scheduler';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, AutomationRulesModule],
  controllers: [MinistryTasksController],
  providers: [MinistryTasksService, MinistryTasksScheduler],
  exports: [MinistryTasksService],
})
export class MinistryTasksModule {}
