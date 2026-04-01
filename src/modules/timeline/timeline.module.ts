import { Module } from '@nestjs/common';
import { TimelineMeController } from './timeline-me.controller';
import { TimelineController } from './timeline.controller';
import { TimelineEventsSubscriber } from './timeline-events.subscriber';
import { TimelinePublisherService } from './timeline-publisher.service';
import { TimelineService } from './timeline.service';

@Module({
  controllers: [TimelineMeController, TimelineController],
  providers: [TimelineService, TimelinePublisherService, TimelineEventsSubscriber],
  exports: [TimelineService, TimelinePublisherService],
})
export class TimelineModule {}
