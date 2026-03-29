import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppCacheService } from 'src/common/cache/cache.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AnalyticsAggregatorService } from './analytics-aggregator.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AppCacheService,
    private readonly aggregator: AnalyticsAggregatorService,
  ) {}

  async church(actor: JwtPayload, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const { startDate, endDate } = this.resolvePeriod(query);
    return this.cacheService.getOrSet(
      `analytics:church:${churchId}:${startDate.toISOString()}:${endDate.toISOString()}`,
      () => this.aggregator.churchSummary(churchId, startDate, endDate),
      30_000,
    );
  }

  async ministry(actor: JwtPayload, ministryId: string, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const { startDate, endDate } = this.resolvePeriod(query);
    const ministry = await this.prisma.ministry.findFirst({ where: { id: ministryId, churchId, deletedAt: null } });
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }

    const [attendance, tasks, tracks, trainingsPending] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          churchId,
          createdAt: { gte: startDate, lte: endDate },
          servant: { mainMinistryId: ministryId, deletedAt: null },
        },
        _count: { _all: true },
      }),
      this.prisma.ministryTaskOccurrence.groupBy({
        by: ['status'],
        where: { churchId, ministryId, scheduledFor: { gte: startDate, lte: endDate }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.servantGrowthProgress.count({ where: { churchId, growthTrack: { ministryId }, completed: false } }),
      this.prisma.servantMinistry.count({
        where: { ministryId, servant: { churchId, deletedAt: null }, trainingStatus: 'PENDING' },
      }),
    ]);

    return { attendance, tasks, tracksInProgress: tracks, trainingsPending };
  }

  async servant(actor: JwtPayload, servantId: string, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const { startDate, endDate } = this.resolvePeriod(query);
    const servant = await this.prisma.servant.findFirst({ where: { id: servantId, churchId, deletedAt: null } });
    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    const [attendance, tasksCompleted, trainings, tracks, journey] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { churchId, servantId, createdAt: { gte: startDate, lte: endDate } },
        _count: { _all: true },
      }),
      this.prisma.ministryTaskOccurrence.count({
        where: {
          churchId,
          assignedServantId: servantId,
          status: 'COMPLETED',
          scheduledFor: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
      }),
      this.prisma.servantMinistry.findMany({ where: { servantId }, select: { ministryId: true, trainingStatus: true } }),
      this.prisma.servantGrowthProgress.findMany({
        where: { churchId, servantId },
        select: { growthTrackId: true, completed: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.servantJourney.findFirst({ where: { servantId, churchId } }),
    ]);

    return { attendance, tasksCompleted, trainings, tracks, journey };
  }

  async team(actor: JwtPayload, teamId: string, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const { startDate, endDate } = this.resolvePeriod(query);
    const team = await this.prisma.team.findFirst({ where: { id: teamId, churchId, deletedAt: null } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const memberIds = (await this.prisma.servant.findMany({ where: { teamId: team.id, churchId, deletedAt: null }, select: { id: true } })).map((s) => s.id);

    const [attendance, tasks] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { churchId, servantId: { in: memberIds }, createdAt: { gte: startDate, lte: endDate } },
        _count: { _all: true },
      }),
      this.prisma.ministryTaskOccurrence.groupBy({
        by: ['status'],
        where: { churchId, assignedServantId: { in: memberIds }, scheduledFor: { gte: startDate, lte: endDate }, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    return { team: { id: team.id, name: team.name }, members: memberIds.length, attendance, tasks };
  }

  async timelineSummary(actor: JwtPayload, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const { startDate, endDate } = this.resolvePeriod(query);

    const rows = await this.prisma.timelineEntry.groupBy({
      by: ['type'],
      where: { churchId, occurredAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
    });

    return {
      period: { startDate, endDate },
      totals: rows,
    };
  }

  private resolveActorChurch(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException('Actor must be bound to a church context');
    }
    return actor.churchId;
  }

  private resolvePeriod(query: AnalyticsQueryDto) {
    const now = new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const endDate = query.endDate
      ? new Date(query.endDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { startDate, endDate };
  }
}
