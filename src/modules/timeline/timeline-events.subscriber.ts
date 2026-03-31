import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService } from 'src/common/events/event-bus.service';
import { TimelineEventType } from 'src/common/timeline/timeline-policy';
import { TimelinePublisherService } from './timeline-publisher.service';

@Injectable()
export class TimelineEventsSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly publisher: TimelinePublisherService,
  ) {}

  onModuleInit() {
    const map: Record<string, TimelineEventType> = {
      SLOT_ASSIGNED: 'TIMELINE_SCHEDULE_ASSIGNED',
      SLOT_CONFIRMED: 'TIMELINE_SCHEDULE_CONFIRMED',
      SLOT_DECLINED: 'TIMELINE_SCHEDULE_DECLINED',
      SCHEDULE_GENERATED: 'TIMELINE_SCHEDULE_AUTO_FILLED',
      ATTENDANCE_REGISTERED: 'TIMELINE_ATTENDANCE_RECORDED',
      TRAINING_COMPLETED: 'TIMELINE_TRAINING_COMPLETED',
      MINISTRY_TASK_COMPLETED: 'TIMELINE_TASK_COMPLETED',
      JOURNEY_RETURN_AFTER_GAP: 'TIMELINE_JOURNEY_RETURN_AFTER_GAP',
      JOURNEY_NEW_MINISTRY_SERVICE: 'TIMELINE_JOURNEY_NEW_MINISTRY_SERVICE',
      PASTORAL_ALERT_CREATED: 'TIMELINE_PASTORAL_ALERT_CREATED',
      PASTORAL_CASE_OPENED: 'TIMELINE_PASTORAL_CASE_OPENED',
      PASTORAL_FOLLOWUP_CREATED: 'TIMELINE_PASTORAL_FOLLOWUP_CREATED',
      PASTORAL_ALERT_RESOLVED: 'TIMELINE_PASTORAL_ALERT_RESOLVED',
      AUTOMATION_RULE_EXECUTED: 'TIMELINE_AUTOMATION_RULE_EXECUTED',
      AUTOMATION_RULE_SKIPPED: 'TIMELINE_AUTOMATION_RULE_SKIPPED',
    };

    for (const [eventName, eventType] of Object.entries(map)) {
      this.eventBus.on(eventName as any, async (event) => {
        if (!event.churchId) {
          return;
        }
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        const subjectId = this.asString(payload.subjectId);

        await this.publisher.publish({
          churchId: event.churchId,
          eventType,
          actorUserId: event.actorUserId ?? null,
          ministryId: this.asString(payload.ministryId),
          servantId: this.asString(payload.servantId),
          subjectType: this.asString(payload.subjectType),
          subjectId,
          relatedEntityType: this.asString(payload.relatedEntityType),
          relatedEntityId: this.asString(payload.relatedEntityId),
          dedupeKey: `${eventType}:${event.churchId}:${subjectId ?? 'none'}`,
          metadata: {
            origin: 'event-bus',
            eventName,
            ...payload,
          },
          occurredAt: event.occurredAt,
        });
      });
    }
  }

  private asString(value: unknown) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
}
