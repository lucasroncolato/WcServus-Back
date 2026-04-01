import { Module } from '@nestjs/common';
import { SchedulerLockModule } from 'src/common/scheduler-lock/scheduler-lock.module';
import { JourneyCheckpointService } from './journey-checkpoint.service';
import { JourneyController } from './journey.controller';
import { JourneyOpsController } from './journey-ops.controller';
import { JourneyProjectorService } from './journey-projector.service';
import { JourneyReconcileScheduler } from './journey-reconcile.scheduler';
import { JourneyReconcileService } from './journey-reconcile.service';
import { JourneyService } from './journey.service';

@Module({
  imports: [SchedulerLockModule],
  controllers: [JourneyController, JourneyOpsController],
  providers: [
    JourneyService,
    JourneyProjectorService,
    JourneyCheckpointService,
    JourneyReconcileService,
    JourneyReconcileScheduler,
  ],
  exports: [JourneyService, JourneyReconcileService, JourneyReconcileScheduler],
})
export class JourneyModule {}
