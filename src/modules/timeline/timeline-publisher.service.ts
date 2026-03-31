import { Injectable } from '@nestjs/common';
import { Prisma, TimelineActorType, TimelineScope, TimelineSeverity } from '@prisma/client';
import {
  TimelineEventType,
  buildTimelineMessage,
  buildTimelineTitle,
  getTimelineCategory,
  getTimelineSeverity,
  isTimelineEventAggregatable,
  isTimelineEventType,
  sanitizeTimelineMetadata,
  shouldPublishTimelineEvent,
  TIMELINE_POLICY,
} from 'src/common/timeline/timeline-policy';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PrismaService } from 'src/prisma/prisma.service';

export type TimelinePublishEvent = {
  churchId: string;
  eventType: TimelineEventType | string;
  title?: string;
  message?: string;
  scope?: TimelineScope;
  severity?: TimelineSeverity;
  actorType?: TimelineActorType;
  actorUserId?: string | null;
  actorName?: string | null;
  ministryId?: string | null;
  servantId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

@Injectable()
export class TimelinePublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
  ) {}

  async publish(event: TimelinePublishEvent) {
    if (!isTimelineEventType(event.eventType)) {
      this.metrics.incrementCounter('timeline_publish_unknown_event_total', 1);
      return { published: false, reason: 'unknown_event_type' as const };
    }

    if (!shouldPublishTimelineEvent(event.eventType)) {
      this.metrics.incrementCounter('timeline_publish_filtered_total', 1);
      return { published: false, reason: 'policy_filtered' as const };
    }

    const dedupeResolution = await this.resolveDedupe(event);
    if (dedupeResolution.type === 'skip') {
      this.metrics.incrementCounter('timeline_publish_deduped_total', 1);
      return { published: false, reason: 'dedupe', entryId: dedupeResolution.entryId };
    }

    if (dedupeResolution.type === 'aggregated') {
      this.metrics.incrementCounter('timeline_publish_aggregated_total', 1);
      return { published: true, aggregated: true, entryId: dedupeResolution.entryId };
    }

    const created = await this.persistTimelineEntry(event);
    this.metrics.incrementCounter('timeline_publish_total', 1);

    return {
      published: true,
      aggregated: false,
      entryId: created.id,
    };
  }

  async publishBatch(events: TimelinePublishEvent[]) {
    const summary = {
      published: 0,
      skipped: 0,
      aggregated: 0,
    };

    for (const event of events) {
      const result = await this.publish(event);
      if (!result.published) {
        summary.skipped += 1;
      } else if (result.aggregated) {
        summary.aggregated += 1;
      } else {
        summary.published += 1;
      }
    }

    return summary;
  }

  private async resolveDedupe(event: TimelinePublishEvent) {
    if (!isTimelineEventType(event.eventType)) {
      return { type: 'none' as const };
    }

    const policy = TIMELINE_POLICY[event.eventType];
    if (!policy.dedupe || !event.dedupeKey) {
      return { type: 'none' as const };
    }

    const latest = await this.prisma.timelineEntry.findFirst({
      where: {
        churchId: event.churchId,
        dedupeKey: event.dedupeKey,
      },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        occurredAt: true,
        metadata: true,
      },
    });

    if (!latest) {
      return { type: 'none' as const };
    }

    if (!isTimelineEventAggregatable(event.eventType)) {
      return {
        type: 'skip' as const,
        entryId: latest.id,
      };
    }

    const windowMinutes = policy.aggregationWindowMinutes ?? 15;
    const now = event.occurredAt ?? new Date();
    if (now.getTime() - latest.occurredAt.getTime() > windowMinutes * 60 * 1000) {
      return { type: 'none' as const };
    }

    const previousMetadata = (latest.metadata as Record<string, unknown> | null) ?? {};
    const previousCount = Number(previousMetadata.aggregatedCount ?? 1);
    const sanitizedMetadata = sanitizeTimelineMetadata(event.metadata ?? {});

    const nextMetadata = {
      ...previousMetadata,
      ...sanitizedMetadata,
      aggregatedCount: previousCount + 1,
      windowStart:
        (typeof previousMetadata.windowStart === 'string' && previousMetadata.windowStart) ||
        latest.occurredAt.toISOString(),
      windowEnd: now.toISOString(),
      lastSubjectId: event.subjectId ?? null,
    } as Prisma.InputJsonValue;

    await this.prisma.timelineEntry.update({
      where: { id: latest.id },
      data: {
        occurredAt: now,
        metadata: nextMetadata,
        message: `${buildTimelineMessage(event.eventType, event.message)} (x${previousCount + 1})`,
      },
    });

    return {
      type: 'aggregated' as const,
      entryId: latest.id,
    };
  }

  private async persistTimelineEntry(event: TimelinePublishEvent) {
    if (!isTimelineEventType(event.eventType)) {
      throw new Error('Invalid timeline event type');
    }

    const scope = event.scope ?? (event.servantId ? TimelineScope.SERVANT : event.ministryId ? TimelineScope.MINISTRY : TimelineScope.CHURCH);

    const data: Prisma.TimelineEntryCreateInput = {
      church: { connect: { id: event.churchId } },
      ministry: event.ministryId ? { connect: { id: event.ministryId } } : undefined,
      servant: event.servantId ? { connect: { id: event.servantId } } : undefined,
      actorUser: event.actorUserId ? { connect: { id: event.actorUserId } } : undefined,
      actorType: event.actorType ?? (event.actorUserId ? TimelineActorType.USER : TimelineActorType.SYSTEM),
      actorName: event.actorName ?? null,
      scope,
      type: this.mapLegacyType(event.eventType),
      category: getTimelineCategory(event.eventType),
      eventType: event.eventType,
      severity: event.severity ?? getTimelineSeverity(event.eventType),
      title: buildTimelineTitle(event.eventType, event.title),
      message: buildTimelineMessage(event.eventType, event.message),
      description: event.message ?? buildTimelineMessage(event.eventType, event.message),
      subjectType: event.subjectType ?? null,
      subjectId: event.subjectId ?? null,
      relatedEntityType: event.relatedEntityType ?? null,
      relatedEntityId: event.relatedEntityId ?? null,
      dedupeKey: event.dedupeKey ?? null,
      metadata: sanitizeTimelineMetadata(event.metadata ?? {}) as Prisma.InputJsonValue,
      occurredAt: event.occurredAt ?? new Date(),
    };

    const created = await this.prisma.timelineEntry.create({ data });

    this.logService.event({
      level: 'info',
      module: 'timeline',
      action: 'timeline.publish',
      message: 'Timeline event published',
      churchId: event.churchId,
      metadata: {
        entryId: created.id,
        eventType: event.eventType,
        category: created.category,
        severity: created.severity,
      },
    });

    return created;
  }

  private mapLegacyType(eventType: TimelineEventType) {
    if (eventType.startsWith('TIMELINE_SCHEDULE_')) return 'SCHEDULE_PUBLISHED' as const;
    if (eventType.startsWith('TIMELINE_ATTENDANCE_')) return 'SERVICE_COMPLETED' as const;
    if (eventType.startsWith('TIMELINE_AUTOMATION_')) return 'AUTOMATION_TRIGGERED' as const;
    if (eventType.startsWith('TIMELINE_TASK_')) return 'TASK_COMPLETED' as const;
    if (eventType.startsWith('TIMELINE_TRAINING_')) return 'TRAINING_COMPLETED' as const;
    if (eventType.startsWith('TIMELINE_PASTORAL_')) return 'PASTORAL_ALERT' as const;
    return 'GENERIC_EVENT' as const;
  }
}
