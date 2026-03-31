import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { resolveAnalyticsWindow } from 'src/common/analytics/analytics-policy';
import { assertServantAccess, resolveScopedMinistryIds } from 'src/common/auth/access-scope';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AnalyticsAggregatorService } from './analytics-aggregator.service';
import { AnalyticsCacheFacade } from './analytics-cache.facade';
import { AnalyticsSnapshotService } from './analytics-snapshot.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

type Period = {
  window: string;
  startDate: Date;
  endDate: Date;
  explicitRange: boolean;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AnalyticsCacheFacade,
    private readonly aggregator: AnalyticsAggregatorService,
    private readonly snapshots: AnalyticsSnapshotService,
    private readonly metrics: AppMetricsService,
  ) {}

  async church(actor: JwtPayload, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const period = this.resolvePeriod(query);

    return this.cache.getOrSet(
      ['analytics', 'church', churchId, period.window, period.startDate.toISOString(), period.endDate.toISOString()],
      120,
      async () => {
        const snapshot = await this.tryResolveSnapshot('church', period, {
          churchId,
        });
        if (snapshot) {
          return snapshot;
        }

        this.metrics.incrementCounter('analytics_snapshot_fallback_total', 1);
        const computed = await this.aggregator.churchSummary(churchId, period.startDate, period.endDate, period.window);
        await this.tryPersistSnapshot('church', period, computed, { churchId });
        return this.withSourceMeta(computed, { isSnapshot: false, fallback: true });
      },
    );
  }

  async churchTrends(actor: JwtPayload, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const period = this.resolvePeriod(query);
    const groupBy = query.groupBy === 'day' || query.groupBy === 'week' || query.groupBy === 'month' ? query.groupBy : 'week';

    return this.cache.getOrSet(
      [
        'analytics',
        'church',
        'trends',
        churchId,
        period.window,
        groupBy,
        period.startDate.toISOString(),
        period.endDate.toISOString(),
      ],
      180,
      () => this.aggregator.churchTrends(churchId, period.startDate, period.endDate, period.window, groupBy),
    );
  }

  async churchPastoral(actor: JwtPayload, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const period = this.resolvePeriod(query);
    return this.cache.getOrSet(
      ['analytics', 'church', 'pastoral', churchId, period.window, period.startDate.toISOString(), period.endDate.toISOString()],
      120,
      () => this.aggregator.churchPastoralSummary(churchId, period.startDate, period.endDate, period.window),
    );
  }

  async ministry(actor: JwtPayload, ministryId: string, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const period = this.resolvePeriod(query);
    await this.assertMinistryScopeAccess(actor, ministryId, churchId);

    const ministry = await this.prisma.ministry.findFirst({
      where: { id: ministryId, churchId, deletedAt: null },
      select: { id: true },
    });
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }

    return this.cache.getOrSet(
      ['analytics', 'ministry', churchId, ministryId, period.window, period.startDate.toISOString(), period.endDate.toISOString()],
      120,
      async () => {
        const snapshot = await this.tryResolveSnapshot('ministry', period, { churchId, ministryId });
        if (snapshot) {
          return snapshot;
        }

        this.metrics.incrementCounter('analytics_snapshot_fallback_total', 1);
        const computed = await this.aggregator.ministrySummary(
          churchId,
          ministryId,
          period.startDate,
          period.endDate,
          period.window,
        );
        await this.tryPersistSnapshot('ministry', period, computed, { churchId, ministryId });
        return this.withSourceMeta(computed, { isSnapshot: false, fallback: true });
      },
    );
  }

  async team(actor: JwtPayload, teamId: string, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const period = this.resolvePeriod(query);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, churchId, deletedAt: null },
      select: { id: true, ministryId: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await this.assertMinistryScopeAccess(actor, team.ministryId, churchId);

    return this.cache.getOrSet(
      ['analytics', 'team', churchId, teamId, period.window, period.startDate.toISOString(), period.endDate.toISOString()],
      120,
      async () => {
        const snapshot = await this.tryResolveSnapshot('team', period, { churchId, teamId });
        if (snapshot) {
          return snapshot;
        }

        this.metrics.incrementCounter('analytics_snapshot_fallback_total', 1);
        const computed = await this.aggregator.teamSummary(churchId, teamId, period.startDate, period.endDate, period.window);
        await this.tryPersistSnapshot('team', period, computed, { churchId, teamId });
        return this.withSourceMeta(computed, { isSnapshot: false, fallback: true });
      },
    );
  }

  async servant(actor: JwtPayload, servantId: string, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const period = this.resolvePeriod(query);

    await assertServantAccess(this.prisma, actor, servantId);
    const servant = await this.prisma.servant.findFirst({
      where: { id: servantId, churchId, deletedAt: null },
      select: { id: true },
    });
    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    return this.cache.getOrSet(
      ['analytics', 'servant', churchId, servantId, period.window, period.startDate.toISOString(), period.endDate.toISOString()],
      90,
      async () => {
        const snapshot = await this.tryResolveSnapshot('servant', period, { churchId, servantId });
        if (snapshot) {
          return snapshot;
        }

        this.metrics.incrementCounter('analytics_snapshot_fallback_total', 1);
        const computed = await this.aggregator.servantOperationalSummary(
          churchId,
          servantId,
          period.startDate,
          period.endDate,
          period.window,
        );
        await this.tryPersistSnapshot('servant', period, computed, { churchId, servantId });
        return this.withSourceMeta(computed, { isSnapshot: false, fallback: true });
      },
    );
  }

  async timelineSummary(actor: JwtPayload, query: AnalyticsQueryDto) {
    const churchId = this.resolveActorChurch(actor);
    const period = this.resolvePeriod(query);
    return this.cache.getOrSet(
      ['analytics', 'timeline-summary', churchId, period.window, period.startDate.toISOString(), period.endDate.toISOString()],
      120,
      () => this.aggregator.timelineSummary(churchId, period.startDate, period.endDate, period.window),
    );
  }

  private shouldTrySnapshot(period: Period) {
    return !period.explicitRange && (period.window === '30d' || period.window === '90d' || period.window === 'month');
  }

  private async tryResolveSnapshot(
    scope: 'church' | 'ministry' | 'team' | 'servant',
    period: Period,
    ids: { churchId: string; ministryId?: string; teamId?: string; servantId?: string },
  ) {
    if (!this.shouldTrySnapshot(period)) {
      return null;
    }

    if (scope === 'church') {
      const hit = await this.snapshots.getChurchSnapshot(ids.churchId, period.window, period.startDate, period.endDate);
      return hit ? this.withSourceMeta(hit.summary as Record<string, unknown>, { isSnapshot: true, fallback: false, generatedAt: hit.generatedAt }) : null;
    }

    if (scope === 'ministry') {
      const hit = await this.snapshots.getMinistrySnapshot(
        ids.churchId,
        ids.ministryId ?? '',
        period.window,
        period.startDate,
        period.endDate,
      );
      return hit ? this.withSourceMeta(hit.summary as Record<string, unknown>, { isSnapshot: true, fallback: false, generatedAt: hit.generatedAt }) : null;
    }

    if (scope === 'team') {
      const hit = await this.snapshots.getTeamSnapshot(ids.churchId, ids.teamId ?? '', period.window, period.startDate, period.endDate);
      return hit ? this.withSourceMeta(hit.summary as Record<string, unknown>, { isSnapshot: true, fallback: false, generatedAt: hit.generatedAt }) : null;
    }

    const hit = await this.snapshots.getServantSnapshot(
      ids.churchId,
      ids.servantId ?? '',
      period.window,
      period.startDate,
      period.endDate,
    );
    return hit ? this.withSourceMeta(hit.summary as Record<string, unknown>, { isSnapshot: true, fallback: false, generatedAt: hit.generatedAt }) : null;
  }

  private async tryPersistSnapshot(
    scope: 'church' | 'ministry' | 'team' | 'servant',
    period: Period,
    payload: unknown,
    ids: { churchId: string; ministryId?: string; teamId?: string; servantId?: string },
  ) {
    if (!this.shouldTrySnapshot(period)) {
      return;
    }

    if (scope === 'church') {
      await this.snapshots.upsertChurchSnapshot(ids.churchId, period.window, period.startDate, period.endDate, payload);
      return;
    }

    if (scope === 'ministry') {
      await this.snapshots.upsertMinistrySnapshot(
        ids.churchId,
        ids.ministryId ?? '',
        period.window,
        period.startDate,
        period.endDate,
        payload,
      );
      return;
    }

    if (scope === 'team') {
      await this.snapshots.upsertTeamSnapshot(
        ids.churchId,
        ids.teamId ?? '',
        period.window,
        period.startDate,
        period.endDate,
        payload,
      );
      return;
    }

    await this.snapshots.upsertServantSnapshot(
      ids.churchId,
      ids.servantId ?? '',
      period.window,
      period.startDate,
      period.endDate,
      payload,
    );
  }

  private withSourceMeta(
    envelope: Record<string, unknown>,
    input: { isSnapshot: boolean; fallback: boolean; generatedAt?: Date },
  ) {
    const currentMeta = (envelope.meta as Record<string, unknown> | undefined) ?? {};
    return {
      ...envelope,
      meta: {
        ...currentMeta,
        isSnapshot: input.isSnapshot,
        fallback: input.fallback,
        generatedAt: currentMeta.generatedAt ?? new Date().toISOString(),
        snapshotGeneratedAt: input.generatedAt ? input.generatedAt.toISOString() : null,
      },
    };
  }

  private resolveActorChurch(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException('Actor must be bound to a church context');
    }
    return actor.churchId;
  }

  private resolvePeriod(query: AnalyticsQueryDto): Period {
    const window = resolveAnalyticsWindow(query.window);
    const explicitStart = query.from ?? query.startDate;
    const explicitEnd = query.to ?? query.endDate;

    if (explicitStart && explicitEnd) {
      return {
        window,
        startDate: new Date(explicitStart),
        endDate: new Date(explicitEnd),
        explicitRange: true,
      };
    }

    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (window) {
      case '7d':
        startDate.setDate(now.getDate() - 6);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 29);
        break;
      case '60d':
        startDate.setDate(now.getDate() - 59);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 89);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate.setMonth(quarter * 3, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      default:
        startDate.setDate(now.getDate() - 29);
        break;
    }
    startDate.setHours(0, 0, 0, 0);

    return { window, startDate, endDate, explicitRange: false };
  }

  private async assertMinistryScopeAccess(actor: JwtPayload, ministryId: string, churchId: string) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
      return;
    }

    const scopedMinistryIds = await resolveScopedMinistryIds(this.prisma, actor);
    if (!scopedMinistryIds.includes(ministryId)) {
      throw new ForbiddenException('Out of ministry scope');
    }

    const ministry = await this.prisma.ministry.findFirst({
      where: { id: ministryId, churchId, deletedAt: null },
      select: { id: true },
    });
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }
  }
}
