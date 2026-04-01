import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveAnalyticsWindow, type AnalyticsWindowKey } from 'src/common/analytics/analytics-policy';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AnalyticsAggregatorService } from './analytics-aggregator.service';

type SnapshotRow = {
  summary: unknown;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
};

type MaterializationSummary = {
  churchesAnalyzed: number;
  refreshed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  windows: AnalyticsWindowKey[];
  byScope: {
    church: number;
    ministry: number;
    team: number;
    servant: number;
  };
};

type RefreshOptions = {
  churchId?: string;
  windows?: AnalyticsWindowKey[];
  maxMinistries?: number;
  maxTeams?: number;
  maxServants?: number;
};

@Injectable()
export class AnalyticsSnapshotService {
  private lastRun: (MaterializationSummary & { startedAt: string; finishedAt: string; success: boolean }) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregator: AnalyticsAggregatorService,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
  ) {}

  getConfiguredWindows(): AnalyticsWindowKey[] {
    const raw = process.env.ANALYTICS_SNAPSHOT_WINDOWS ?? '30d,90d,month';
    const parsed = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => resolveAnalyticsWindow(item));
    return [...new Set(parsed)];
  }

  getSnapshotStatus() {
    return {
      enabled: process.env.ANALYTICS_SNAPSHOT_ENABLED !== 'false',
      intervalMs: this.resolveIntervalMs(),
      windows: this.getConfiguredWindows(),
      limits: {
        maxMinistriesPerRun: this.resolveLimit('ANALYTICS_SNAPSHOT_MAX_MINISTRIES_PER_RUN', 200),
        maxTeamsPerRun: this.resolveLimit('ANALYTICS_SNAPSHOT_MAX_TEAMS_PER_RUN', 400),
        maxServantsPerRun: this.resolveLimit('ANALYTICS_SNAPSHOT_MAX_SERVANTS_PER_RUN', 1200),
      },
      lastRun: this.lastRun,
      lockDistributed: false,
      notes: ['Anti-overlap atual e in-process (single instance).'],
    };
  }

  resolveIntervalMs() {
    const configured = Number(process.env.ANALYTICS_SNAPSHOT_INTERVAL_MS);
    if (Number.isFinite(configured) && configured >= 60_000) {
      return configured;
    }
    return 6 * 60 * 60 * 1000;
  }

  async getChurchSnapshot(churchId: string, windowKey: string, periodStart: Date, periodEnd: Date) {
    return this.getSnapshotFromTable('ChurchAnalyticsSnapshot', { churchId, windowKey, periodStart, periodEnd });
  }

  async getMinistrySnapshot(
    churchId: string,
    ministryId: string,
    windowKey: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return this.getSnapshotFromTable('MinistryAnalyticsSnapshot', {
      churchId,
      ministryId,
      windowKey,
      periodStart,
      periodEnd,
    });
  }

  async getTeamSnapshot(churchId: string, teamId: string, windowKey: string, periodStart: Date, periodEnd: Date) {
    return this.getSnapshotFromTable('TeamAnalyticsSnapshot', { churchId, teamId, windowKey, periodStart, periodEnd });
  }

  async getServantSnapshot(
    churchId: string,
    servantId: string,
    windowKey: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return this.getSnapshotFromTable('ServantOperationalSnapshot', {
      churchId,
      servantId,
      windowKey,
      periodStart,
      periodEnd,
    });
  }

  async upsertChurchSnapshot(
    churchId: string,
    windowKey: string,
    periodStart: Date,
    periodEnd: Date,
    summary: unknown,
  ) {
    return this.upsertSnapshot('ChurchAnalyticsSnapshot', {
      churchId,
      windowKey,
      periodStart,
      periodEnd,
      summary,
    });
  }

  async upsertMinistrySnapshot(
    churchId: string,
    ministryId: string,
    windowKey: string,
    periodStart: Date,
    periodEnd: Date,
    summary: unknown,
  ) {
    return this.upsertSnapshot('MinistryAnalyticsSnapshot', {
      churchId,
      ministryId,
      windowKey,
      periodStart,
      periodEnd,
      summary,
    });
  }

  async upsertTeamSnapshot(
    churchId: string,
    teamId: string,
    windowKey: string,
    periodStart: Date,
    periodEnd: Date,
    summary: unknown,
  ) {
    return this.upsertSnapshot('TeamAnalyticsSnapshot', {
      churchId,
      teamId,
      windowKey,
      periodStart,
      periodEnd,
      summary,
    });
  }

  async upsertServantSnapshot(
    churchId: string,
    servantId: string,
    windowKey: string,
    periodStart: Date,
    periodEnd: Date,
    summary: unknown,
  ) {
    return this.upsertSnapshot('ServantOperationalSnapshot', {
      churchId,
      servantId,
      windowKey,
      periodStart,
      periodEnd,
      summary,
    });
  }

  async refreshChurchSnapshot(churchId: string, windowKey: AnalyticsWindowKey) {
    const period = this.resolvePeriod(windowKey);
    const summary = await this.aggregator.churchSummary(churchId, period.startDate, period.endDate, windowKey);
    await this.upsertChurchSnapshot(churchId, windowKey, period.startDate, period.endDate, summary);
    return { churchId, windowKey, periodStart: period.startDate, periodEnd: period.endDate };
  }

  async refreshMinistrySnapshot(churchId: string, ministryId: string, windowKey: AnalyticsWindowKey) {
    const period = this.resolvePeriod(windowKey);
    const summary = await this.aggregator.ministrySummary(
      churchId,
      ministryId,
      period.startDate,
      period.endDate,
      windowKey,
    );
    await this.upsertMinistrySnapshot(churchId, ministryId, windowKey, period.startDate, period.endDate, summary);
    return { churchId, ministryId, windowKey, periodStart: period.startDate, periodEnd: period.endDate };
  }

  async refreshTeamSnapshot(churchId: string, teamId: string, windowKey: AnalyticsWindowKey) {
    const period = this.resolvePeriod(windowKey);
    const summary = await this.aggregator.teamSummary(churchId, teamId, period.startDate, period.endDate, windowKey);
    await this.upsertTeamSnapshot(churchId, teamId, windowKey, period.startDate, period.endDate, summary);
    return { churchId, teamId, windowKey, periodStart: period.startDate, periodEnd: period.endDate };
  }

  async refreshServantSnapshot(churchId: string, servantId: string, windowKey: AnalyticsWindowKey) {
    const period = this.resolvePeriod(windowKey);
    const summary = await this.aggregator.servantOperationalSummary(
      churchId,
      servantId,
      period.startDate,
      period.endDate,
      windowKey,
    );
    await this.upsertServantSnapshot(churchId, servantId, windowKey, period.startDate, period.endDate, summary);
    return { churchId, servantId, windowKey, periodStart: period.startDate, periodEnd: period.endDate };
  }

  async refreshMinistryById(ministryId: string, windows?: AnalyticsWindowKey[]) {
    const ministry = await this.prisma.ministry.findFirst({
      where: { id: ministryId, deletedAt: null },
      select: { churchId: true, id: true },
    });
    if (!ministry) {
      throw new Error('Ministry not found');
    }
    const targetWindows = windows?.length ? windows : this.getConfiguredWindows();
    for (const windowKey of targetWindows) {
      await this.refreshMinistrySnapshot(ministry.churchId, ministry.id, windowKey);
    }
    return { churchId: ministry.churchId, ministryId, windows: targetWindows };
  }

  async refreshTeamById(teamId: string, windows?: AnalyticsWindowKey[]) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { churchId: true, id: true },
    });
    if (!team) {
      throw new Error('Team not found');
    }
    const targetWindows = windows?.length ? windows : this.getConfiguredWindows();
    for (const windowKey of targetWindows) {
      await this.refreshTeamSnapshot(team.churchId, team.id, windowKey);
    }
    return { churchId: team.churchId, teamId, windows: targetWindows };
  }

  async refreshServantById(servantId: string, windows?: AnalyticsWindowKey[]) {
    const servant = await this.prisma.servant.findFirst({
      where: { id: servantId, deletedAt: null },
      select: { churchId: true, id: true },
    });
    if (!servant) {
      throw new Error('Servant not found');
    }
    const targetWindows = windows?.length ? windows : this.getConfiguredWindows();
    for (const windowKey of targetWindows) {
      await this.refreshServantSnapshot(servant.churchId, servant.id, windowKey);
    }
    return { churchId: servant.churchId, servantId, windows: targetWindows };
  }

  async refreshAllSnapshots(options?: RefreshOptions) {
    const startedAt = new Date();
    const startedPerf = performance.now();
    const windows = options?.windows?.length ? options.windows : this.getConfiguredWindows();
    const maxMinistries = options?.maxMinistries ?? this.resolveLimit('ANALYTICS_SNAPSHOT_MAX_MINISTRIES_PER_RUN', 200);
    const maxTeams = options?.maxTeams ?? this.resolveLimit('ANALYTICS_SNAPSHOT_MAX_TEAMS_PER_RUN', 400);
    const maxServants = options?.maxServants ?? this.resolveLimit('ANALYTICS_SNAPSHOT_MAX_SERVANTS_PER_RUN', 1200);

    const summary: MaterializationSummary = {
      churchesAnalyzed: 0,
      refreshed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      windows,
      byScope: { church: 0, ministry: 0, team: 0, servant: 0 },
    };

    const churches = await this.prisma.church.findMany({
      where: {
        ...(options?.churchId ? { id: options.churchId } : {}),
        active: true,
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    summary.churchesAnalyzed = churches.length;

    for (const church of churches) {
      const [ministries, teams, servants] = await Promise.all([
        this.prisma.ministry.findMany({
          where: { churchId: church.id, deletedAt: null },
          select: { id: true },
          take: maxMinistries,
        }),
        this.prisma.team.findMany({
          where: { churchId: church.id, deletedAt: null },
          select: { id: true },
          take: maxTeams,
        }),
        this.prisma.servant.findMany({
          where: { churchId: church.id, deletedAt: null },
          select: { id: true },
          take: maxServants,
        }),
      ]);

      for (const windowKey of windows) {
        await this.safeRefresh(
          async () => this.refreshChurchSnapshot(church.id, windowKey),
          { churchId: church.id, windowKey, scope: 'church' },
          summary,
        );

        for (const ministry of ministries) {
          await this.safeRefresh(
            async () => this.refreshMinistrySnapshot(church.id, ministry.id, windowKey),
            { churchId: church.id, ministryId: ministry.id, windowKey, scope: 'ministry' },
            summary,
          );
        }

        for (const team of teams) {
          await this.safeRefresh(
            async () => this.refreshTeamSnapshot(church.id, team.id, windowKey),
            { churchId: church.id, teamId: team.id, windowKey, scope: 'team' },
            summary,
          );
        }

        for (const servant of servants) {
          await this.safeRefresh(
            async () => this.refreshServantSnapshot(church.id, servant.id, windowKey),
            { churchId: church.id, servantId: servant.id, windowKey, scope: 'servant' },
            summary,
          );
        }
      }

      if (ministries.length >= maxMinistries || teams.length >= maxTeams || servants.length >= maxServants) {
        summary.skipped += 1;
      }
    }

    summary.durationMs = Number((performance.now() - startedPerf).toFixed(2));
    const finishedAt = new Date();
    const success = summary.failed === 0;

    this.lastRun = {
      ...summary,
      success,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };

    return summary;
  }

  private async safeRefresh(
    action: () => Promise<unknown>,
    context: Record<string, unknown> & { scope: 'church' | 'ministry' | 'team' | 'servant' },
    summary: MaterializationSummary,
  ) {
    const started = performance.now();
    try {
      await action();
      const durationMs = performance.now() - started;
      summary.refreshed += 1;
      summary.byScope[context.scope] += 1;
      this.metrics.incrementCounter('analytics_snapshot_refresh_total', 1);
      this.metrics.incrementCounter(`analytics_snapshot_refresh_total.${context.scope}`, 1);
      this.metrics.incrementCounter('analytics_snapshot_refresh_duration_ms', Math.max(1, Math.round(durationMs)));
      this.metrics.incrementCounter('analytics_snapshot_duration_ms', Math.max(1, Math.round(durationMs)));
      this.logService.event({
        level: 'info',
        module: 'analytics',
        action: 'snapshot.refresh.success',
        message: 'Analytics snapshot refreshed',
        churchId: (context.churchId as string | undefined) ?? null,
        status: 'success',
        durationMs,
        metadata: context,
      });
    } catch (error) {
      summary.failed += 1;
      this.metrics.incrementCounter('analytics_snapshot_refresh_failed_total', 1);
      this.metrics.incrementCounter('analytics_snapshot_failed_total', 1);
      this.logService.event({
        level: 'error',
        module: 'analytics',
        action: 'snapshot.refresh.failure',
        message: 'Analytics snapshot refresh failed',
        churchId: (context.churchId as string | undefined) ?? null,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          ...context,
          error: String(error),
        },
      });
    }
  }

  private resolvePeriod(windowKey: AnalyticsWindowKey) {
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (windowKey) {
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
        break;
      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate.setMonth(quarter * 3, 1);
        break;
      }
      default:
        startDate.setDate(now.getDate() - 29);
        break;
    }

    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate };
  }

  private resolveLimit(envKey: string, fallback: number) {
    const raw = Number(process.env[envKey]);
    if (Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    return fallback;
  }

  private async getSnapshotFromTable(
    tableName: 'ChurchAnalyticsSnapshot' | 'MinistryAnalyticsSnapshot' | 'TeamAnalyticsSnapshot' | 'ServantOperationalSnapshot',
    where: Record<string, string | Date>,
  ) {
    try {
      const rows = await this.querySnapshotTable(tableName, where);
      if (rows[0]) {
        this.metrics.incrementCounter('analytics_snapshot_cache_hit_total', 1);
        return rows[0];
      }
      this.metrics.incrementCounter('analytics_snapshot_cache_miss_total', 1);
      return null;
    } catch {
      this.metrics.incrementCounter('analytics_snapshot_cache_miss_total', 1);
      return null;
    }
  }

  private async upsertSnapshot(
    tableName: 'ChurchAnalyticsSnapshot' | 'MinistryAnalyticsSnapshot' | 'TeamAnalyticsSnapshot' | 'ServantOperationalSnapshot',
    input: {
      churchId: string;
      windowKey: string;
      periodStart: Date;
      periodEnd: Date;
      summary: unknown;
      ministryId?: string;
      teamId?: string;
      servantId?: string;
    },
  ) {
    const summaryJson = JSON.stringify(input.summary ?? {});
    try {
      if (tableName === 'ChurchAnalyticsSnapshot') {
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "ChurchAnalyticsSnapshot"
            ("id", "churchId", "windowKey", "periodStart", "periodEnd", "summary", "generatedAt", "createdAt", "updatedAt")
          VALUES
            (concat('cas_', extract(epoch from now())::bigint::text, '_', floor(random() * 1000000)::text), ${input.churchId}, ${input.windowKey}, ${input.periodStart}, ${input.periodEnd}, ${summaryJson}::jsonb, now(), now(), now())
          ON CONFLICT ("churchId", "windowKey", "periodStart", "periodEnd")
          DO UPDATE SET "summary" = EXCLUDED."summary", "generatedAt" = now(), "updatedAt" = now()
        `);
        return;
      }

      if (tableName === 'MinistryAnalyticsSnapshot') {
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "MinistryAnalyticsSnapshot"
            ("id", "churchId", "ministryId", "windowKey", "periodStart", "periodEnd", "summary", "generatedAt", "createdAt", "updatedAt")
          VALUES
            (concat('mas_', extract(epoch from now())::bigint::text, '_', floor(random() * 1000000)::text), ${input.churchId}, ${input.ministryId ?? ''}, ${input.windowKey}, ${input.periodStart}, ${input.periodEnd}, ${summaryJson}::jsonb, now(), now(), now())
          ON CONFLICT ("churchId", "ministryId", "windowKey", "periodStart", "periodEnd")
          DO UPDATE SET "summary" = EXCLUDED."summary", "generatedAt" = now(), "updatedAt" = now()
        `);
        return;
      }

      if (tableName === 'TeamAnalyticsSnapshot') {
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "TeamAnalyticsSnapshot"
            ("id", "churchId", "teamId", "windowKey", "periodStart", "periodEnd", "summary", "generatedAt", "createdAt", "updatedAt")
          VALUES
            (concat('tas_', extract(epoch from now())::bigint::text, '_', floor(random() * 1000000)::text), ${input.churchId}, ${input.teamId ?? ''}, ${input.windowKey}, ${input.periodStart}, ${input.periodEnd}, ${summaryJson}::jsonb, now(), now(), now())
          ON CONFLICT ("churchId", "teamId", "windowKey", "periodStart", "periodEnd")
          DO UPDATE SET "summary" = EXCLUDED."summary", "generatedAt" = now(), "updatedAt" = now()
        `);
        return;
      }

      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "ServantOperationalSnapshot"
          ("id", "churchId", "servantId", "windowKey", "periodStart", "periodEnd", "summary", "generatedAt", "createdAt", "updatedAt")
        VALUES
          (concat('sos_', extract(epoch from now())::bigint::text, '_', floor(random() * 1000000)::text), ${input.churchId}, ${input.servantId ?? ''}, ${input.windowKey}, ${input.periodStart}, ${input.periodEnd}, ${summaryJson}::jsonb, now(), now(), now())
        ON CONFLICT ("churchId", "servantId", "windowKey", "periodStart", "periodEnd")
        DO UPDATE SET "summary" = EXCLUDED."summary", "generatedAt" = now(), "updatedAt" = now()
      `);
    } catch {
      // Fallback seguro: endpoints continuam com on-demand.
    }
  }

  private querySnapshotTable(
    tableName: 'ChurchAnalyticsSnapshot' | 'MinistryAnalyticsSnapshot' | 'TeamAnalyticsSnapshot' | 'ServantOperationalSnapshot',
    where: Record<string, string | Date>,
  ) {
    if (tableName === 'ChurchAnalyticsSnapshot') {
      return this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
        SELECT summary, "periodStart", "periodEnd", "generatedAt"
        FROM "ChurchAnalyticsSnapshot"
        WHERE "churchId" = ${where.churchId as string}
          AND "windowKey" = ${where.windowKey as string}
          AND "periodStart" = ${where.periodStart as Date}
          AND "periodEnd" = ${where.periodEnd as Date}
        ORDER BY "generatedAt" DESC
        LIMIT 1
      `);
    }

    if (tableName === 'MinistryAnalyticsSnapshot') {
      return this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
        SELECT summary, "periodStart", "periodEnd", "generatedAt"
        FROM "MinistryAnalyticsSnapshot"
        WHERE "churchId" = ${where.churchId as string}
          AND "ministryId" = ${where.ministryId as string}
          AND "windowKey" = ${where.windowKey as string}
          AND "periodStart" = ${where.periodStart as Date}
          AND "periodEnd" = ${where.periodEnd as Date}
        ORDER BY "generatedAt" DESC
        LIMIT 1
      `);
    }

    if (tableName === 'TeamAnalyticsSnapshot') {
      return this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
        SELECT summary, "periodStart", "periodEnd", "generatedAt"
        FROM "TeamAnalyticsSnapshot"
        WHERE "churchId" = ${where.churchId as string}
          AND "teamId" = ${where.teamId as string}
          AND "windowKey" = ${where.windowKey as string}
          AND "periodStart" = ${where.periodStart as Date}
          AND "periodEnd" = ${where.periodEnd as Date}
        ORDER BY "generatedAt" DESC
        LIMIT 1
      `);
    }

    return this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
      SELECT summary, "periodStart", "periodEnd", "generatedAt"
      FROM "ServantOperationalSnapshot"
      WHERE "churchId" = ${where.churchId as string}
        AND "servantId" = ${where.servantId as string}
        AND "windowKey" = ${where.windowKey as string}
        AND "periodStart" = ${where.periodStart as Date}
        AND "periodEnd" = ${where.periodEnd as Date}
      ORDER BY "generatedAt" DESC
      LIMIT 1
    `);
  }
}
