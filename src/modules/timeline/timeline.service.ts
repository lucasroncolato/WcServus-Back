import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { assertServantAccess, getServantAccessWhere, resolveScopedMinistryIds } from 'src/common/auth/access-scope';
import { sanitizeTimelineMetadata } from 'src/common/timeline/timeline-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { TimelineQueryDto } from './dto/timeline-query.dto';

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: JwtPayload, query: TimelineQueryDto) {
    this.assertAdminTimelineAccess(actor);
    const churchId = this.requireChurch(actor);
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const where = await this.buildListWhere(actor, query, churchId);
    const cursor = this.parseCursor(query.cursor);

    const entries = await this.prisma.timelineEntry.findMany({
      where: {
        ...where,
        ...(cursor
          ? {
              OR: [
                { occurredAt: { lt: cursor.occurredAt } },
                {
                  occurredAt: cursor.occurredAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const hasMore = entries.length > limit;
    const sliced = hasMore ? entries.slice(0, limit) : entries;
    const last = sliced[sliced.length - 1];

    const data = sliced.map((entry) => this.serializeEntry(entry));

    return {
      data,
      pageInfo: {
        hasMore,
        nextCursor: hasMore && last ? this.encodeCursor(last.occurredAt, last.id) : null,
      },
      meta: {
        limit,
      },
      dataQualityWarnings: this.buildWarnings(data),
    };
  }

  async detail(actor: JwtPayload, id: string) {
    this.assertAdminTimelineAccess(actor);
    const churchId = this.requireChurch(actor);

    const where = await this.buildListWhere(actor, {}, churchId);

    const entry = await this.prisma.timelineEntry.findFirst({
      where: {
        id,
        ...where,
      },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Timeline event not found');
    }

    return {
      data: this.serializeEntry(entry),
    };
  }

  async summary(actor: JwtPayload, query: TimelineQueryDto) {
    this.assertAdminTimelineAccess(actor);
    const churchId = this.requireChurch(actor);
    const where = await this.buildListWhere(actor, query, churchId);

    const [byCategory, bySeverity, criticalRecent, total] = await Promise.all([
      this.prisma.timelineEntry.groupBy({
        by: ['category'],
        where,
        _count: { _all: true },
      }),
      this.prisma.timelineEntry.groupBy({
        by: ['severity'],
        where,
        _count: { _all: true },
      }),
      this.prisma.timelineEntry.findMany({
        where: {
          ...where,
          severity: 'CRITICAL',
        },
        orderBy: { occurredAt: 'desc' },
        take: 5,
      }),
      this.prisma.timelineEntry.count({ where }),
    ]);

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      totals: {
        events: total,
      },
      byCategory: byCategory.map((item) => ({ category: item.category, count: item._count._all })),
      bySeverity: bySeverity.map((item) => ({ severity: item.severity, count: item._count._all })),
      criticalRecent: criticalRecent.map((item) => this.serializeEntry(item as any)),
    };
  }

  private async buildListWhere(actor: JwtPayload, query: Partial<TimelineQueryDto>, churchId: string) {
    const baseWhere: Prisma.TimelineEntryWhereInput = {
      churchId,
      ...(query.category ? { category: query.category as any } : {}),
      ...(query.severity ? { severity: query.severity as any } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.actorType ? { actorType: query.actorType as any } : {}),
      ...(query.subjectType ? { subjectType: query.subjectType } : {}),
      ...(query.ministryId ? { ministryId: query.ministryId } : {}),
      ...(query.servantId ? { servantId: query.servantId } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    if (query.servantId) {
      await assertServantAccess(this.prisma, actor, query.servantId);
    }

    if (actor.role === Role.COORDENADOR) {
      const scopedMinistryIds = await resolveScopedMinistryIds(this.prisma, actor);
      const servantScopeWhere = await getServantAccessWhere(this.prisma, actor);
      return {
        ...baseWhere,
        AND: [
          {
            OR: [
              scopedMinistryIds.length > 0 ? { ministryId: { in: scopedMinistryIds } } : { id: '__none__' },
              servantScopeWhere ? { servant: servantScopeWhere } : { id: '__none__' },
            ],
          },
        ],
      } as Prisma.TimelineEntryWhereInput;
    }

    return baseWhere;
  }

  private serializeEntry(entry: {
    id: string;
    category: string;
    eventType: string;
    severity: string;
    title: string;
    message: string | null;
    actorType: string;
    actorUserId: string | null;
    actorName: string | null;
    subjectType: string | null;
    subjectId: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    metadata: Prisma.JsonValue | null;
    occurredAt: Date;
    createdAt: Date;
    actorUser?: { id: string; name: string } | null;
  }) {
    return {
      id: entry.id,
      category: entry.category,
      eventType: entry.eventType,
      severity: entry.severity,
      title: entry.title,
      message: entry.message,
      actorType: entry.actorType,
      actorUserId: entry.actorUserId,
      actorName: entry.actorName ?? entry.actorUser?.name ?? null,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      relatedEntityType: entry.relatedEntityType,
      relatedEntityId: entry.relatedEntityId,
      metadata: sanitizeTimelineMetadata((entry.metadata as Record<string, unknown>) ?? {}),
      occurredAt: entry.occurredAt,
      createdAt: entry.createdAt,
    };
  }

  private buildWarnings(
    data: Array<{
      metadata?: Record<string, unknown>;
      subjectType?: string | null;
      subjectId?: string | null;
    }>,
  ) {
    const warnings: string[] = [];

    const missingSubject = data.some((item) => item.subjectType && !item.subjectId);
    if (missingSubject) {
      warnings.push('Alguns eventos estao sem subjectId completo.');
    }

    return warnings;
  }

  private assertAdminTimelineAccess(actor: JwtPayload) {
    if (actor.role === Role.SERVO) {
      throw new ForbiddenException('Servants cannot access administrative timeline');
    }
  }

  private requireChurch(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException('Actor must be bound to a church context');
    }
    return actor.churchId;
  }

  private parseCursor(cursor?: string) {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as { id: string; occurredAt: string };
      if (!parsed?.id || !parsed?.occurredAt) return null;
      return {
        id: parsed.id,
        occurredAt: new Date(parsed.occurredAt),
      };
    } catch {
      return null;
    }
  }

  private encodeCursor(occurredAt: Date, id: string) {
    return Buffer.from(
      JSON.stringify({ occurredAt: occurredAt.toISOString(), id }),
      'utf-8',
    ).toString('base64');
  }
}
