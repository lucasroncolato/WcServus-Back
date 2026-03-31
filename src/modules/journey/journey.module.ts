import { Module } from '@nestjs/common';
import { JourneyCheckpointService } from './journey-checkpoint.service';
import { JourneyController } from './journey.controller';
import { JourneyOpsController } from './journey-ops.controller';
import { JourneyProjectorService } from './journey-projector.service';
import { JourneyReconcileScheduler } from './journey-reconcile.scheduler';
import { JourneyReconcileService } from './journey-reconcile.service';
import { JourneyService } from './journey.service';

@Module({
  controllers: [JourneyController, JourneyOpsController],
  providers: [
    JourneyService,
    JourneyProjectorService,
    JourneyCheckpointService,
    JourneyReconcileService,
    JourneyReconcileScheduler,
  ],
  exports: [JourneyService, JourneyReconcileService],
})
export class JourneyModule {}
