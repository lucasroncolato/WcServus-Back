import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServantsController } from './servants.controller';
import { ServantsService } from './servants.service';

@Module({
  imports: [AuditModule, NotificationsModule, GamificationModule],
  controllers: [ServantsController],
  providers: [ServantsService],
  exports: [ServantsService],
})
export class ServantsModule {}
