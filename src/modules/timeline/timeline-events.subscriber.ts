import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, TimelineEntryType, TimelineScope } from '@prisma/client';
import { EventBusService } from 'src/common/events/event-bus.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TimelineEventsSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const map: Record<string, TimelineEntryType> = {
      SERVANT_CREATED: TimelineEntryType.CHURCH_MILESTONE,
      SLOT_ASSIGNED: TimelineEntryType.SCHEDULE_PUBLISHED,
      SLOT_CONFIRMED: TimelineEntryType.SERVICE_COMPLETED,
      SLOT_DECLINED: TimelineEntryType.GENERIC_EVENT,
      SCHEDULE_GENERATED: TimelineEntryType.SCHEDULE_PUBLISHED,
      ATTENDANCE_REGISTERED: TimelineEntryType.SERVICE_COMPLETED,
      MINISTRY_TASK_COMPLETED: TimelineEntryType.TASK_COMPLETED,
      MINISTRY_TASK_OVERDUE: TimelineEntryType.TASK_OVERDUE,
      TRAINING_COMPLETED: TimelineEntryType.TRAINING_COMPLETED,
      MINISTRY_TASK_DUE_SOON: TimelineEntryType.GENERIC_EVENT,
    };

    for (const [eventName, type] of Object.entries(map)) {
      this.eventBus.on(eventName as any, async (event) => {
        if (!event.churchId) {
          return;
        }

        await this.prisma.timelineEntry.create({
          data: {
            churchId: event.churchId,
            actorUserId: event.actorUserId ?? null,
            scope: TimelineScope.CHURCH,
            type,
            title: event.name,
            description: `Evento ${event.name} registrado automaticamente.`,
            metadata: {
              origin: 'event-bus',
              payload: JSON.parse(JSON.stringify(event.payload)),
            } as Prisma.InputJsonValue,
            occurredAt: event.occurredAt,
          },
        });
      });
    }
  }
}
