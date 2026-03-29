import { Module } from '@nestjs/common';
import { TimelineController } from './timeline.controller';
import { TimelineEventsSubscriber } from './timeline-events.subscriber';
import { TimelineService } from './timeline.service';

@Module({
  controllers: [TimelineController],
  providers: [TimelineService, TimelineEventsSubscriber],
  exports: [TimelineService],
})
export class TimelineModule {}
