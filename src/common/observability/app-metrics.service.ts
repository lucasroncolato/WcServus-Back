import { Injectable } from '@nestjs/common';

type RouteStats = {
  count: number;
  errors: number;
  totalMs: number;
  maxMs: number;
  durations: number[];
  totalDbQueries: number;
};

type JobStats = {
  runs: number;
  failures: number;
  skipped: number;
  totalMs: number;
  maxMs: number;
  totalProcessedItems: number;
  lastRunAt: string | null;
  lastStatus: 'success' | 'failure' | 'never';
};

type DbOperationStats = {
  count: number;
  errors: number;
  totalMs: number;
  maxMs: number;
};

type SlowDbQuery = {
  model: string;
  action: string;
  durationMs: number;
  requestId: string | null;
  error: boolean;
  at: string;
};

type CacheStats = {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
};

type RequestQueryCounter = {
  count: number;
  startedAt: number;
};

@Injectable()
export class AppMetricsService {
  private static readonly MAX_ROUTE_DURATION_SAMPLES = 400;
  private static readonly MAX_SLOW_DB_QUERIES = 80;
  private static readonly MAX_CACHE_KEY_TRACKING = 250;
  private static readonly DB_QUERY_SLOW_MS = 200;
  private static readonly MAX_REQUEST_COUNTERS = 3000;

  private readonly routeStats = new Map<string, RouteStats>();
  private readonly jobStats = new Map<string, JobStats>();
  private readonly counters = new Map<string, number>();
  private readonly dbOperationStats = new Map<string, DbOperationStats>();
  private readonly slowDbQueries: SlowDbQuery[] = [];
  private readonly requestQueryCounters = new Map<string, RequestQueryCounter>();
  private readonly cache: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
  };
  private readonly cacheKeyAccess = new Map<string, number>();
  private inFlightRequests = 0;
  private maxInFlightRequests = 0;
  private eventLoopLagMs = 0;

  constructor() {
    this.initEventLoopLagProbe();
  }

  recordRoute(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    dbQueriesInRequest = 0,
  ) {
    const key = `${method.toUpperCase()} ${path}`;
    const current = this.routeStats.get(key) ?? {
      count: 0,
      errors: 0,
      totalMs: 0,
      maxMs: 0,
      durations: [],
      totalDbQueries: 0,
    };

    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    current.totalDbQueries += Math.max(0, dbQueriesInRequest);
    current.durations.push(durationMs);
    if (current.durations.length > AppMetricsService.MAX_ROUTE_DURATION_SAMPLES) {
      current.durations.shift();
    }
    if (statusCode >= 400) {
      current.errors += 1;
    }

    this.routeStats.set(key, current);
  }

  recordJob(
    name: string,
    durationMs: number,
    success: boolean,
    options?: { skipped?: boolean; processedItems?: number },
  ) {
    const current = this.jobStats.get(name) ?? {
      runs: 0,
      failures: 0,
      skipped: 0,
      totalMs: 0,
      maxMs: 0,
      totalProcessedItems: 0,
      lastRunAt: null,
      lastStatus: 'never' as const,
    };

    current.runs += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    current.totalProcessedItems += options?.processedItems ?? 0;
    current.lastRunAt = new Date().toISOString();
    current.lastStatus = success ? 'success' : 'failure';
    if (options?.skipped) {
      current.skipped += 1;
    }
    if (!success) {
      current.failures += 1;
    }

    this.jobStats.set(name, current);
  }

  incrementCounter(name: string, by = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  recordCacheHit(key?: string) {
    this.cache.hits += 1;
    this.trackCacheKeyAccess(key);
  }

  recordCacheMiss(key?: string) {
    this.cache.misses += 1;
    this.trackCacheKeyAccess(key);
  }

  recordCacheSet(key?: string) {
    this.cache.sets += 1;
    this.trackCacheKeyAccess(key);
  }

  recordCacheEviction(key?: string) {
    this.cache.evictions += 1;
    this.trackCacheKeyAccess(key);
  }

  recordRequestStarted() {
    this.inFlightRequests += 1;
    this.maxInFlightRequests = Math.max(this.maxInFlightRequests, this.inFlightRequests);
  }

  recordRequestFinished() {
    this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
  }

  registerRequest(requestId: string) {
    if (!requestId) {
      return;
    }
    if (this.requestQueryCounters.size >= AppMetricsService.MAX_REQUEST_COUNTERS) {
      const oldest = this.requestQueryCounters.keys().next().value;
      if (typeof oldest === 'string') {
        this.requestQueryCounters.delete(oldest);
      }
    }
    this.requestQueryCounters.set(requestId, {
      count: 0,
      startedAt: Date.now(),
    });
  }

  incrementRequestDbQueries(requestId: string) {
    if (!requestId) {
      return;
    }
    const counter = this.requestQueryCounters.get(requestId);
    if (!counter) {
      return;
    }
    counter.count += 1;
    this.requestQueryCounters.set(requestId, counter);
  }

  completeRequestDbQueries(requestId: string): number {
    if (!requestId) {
      return 0;
    }
    const counter = this.requestQueryCounters.get(requestId);
    if (!counter) {
      return 0;
    }
    this.requestQueryCounters.delete(requestId);
    return counter.count;
  }

  recordDbQuery(input: {
    model: string;
    action: string;
    durationMs: number;
    requestId?: string | null;
    error?: boolean;
  }) {
    const key = `${input.model}.${input.action}`;
    const current = this.dbOperationStats.get(key) ?? {
      count: 0,
      errors: 0,
      totalMs: 0,
      maxMs: 0,
    };
    current.count += 1;
    current.totalMs += input.durationMs;
    current.maxMs = Math.max(current.maxMs, input.durationMs);
    if (input.error) {
      current.errors += 1;
    }
    this.dbOperationStats.set(key, current);

    if (input.requestId) {
      this.incrementRequestDbQueries(input.requestId);
    }

    if (input.durationMs >= AppMetricsService.DB_QUERY_SLOW_MS) {
      this.slowDbQueries.push({
        model: input.model,
        action: input.action,
        durationMs: Number(input.durationMs.toFixed(2)),
        requestId: input.requestId ?? null,
        error: Boolean(input.error),
        at: new Date().toISOString(),
      });
      this.slowDbQueries.sort((a, b) => b.durationMs - a.durationMs);
      if (this.slowDbQueries.length > AppMetricsService.MAX_SLOW_DB_QUERIES) {
        this.slowDbQueries.length = AppMetricsService.MAX_SLOW_DB_QUERIES;
      }
    }
  }

  getSnapshot() {
    const counters = [...this.counters.entries()].reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

    return {
      routes: this.getRoutesSnapshot(),
      jobs: this.getJobsSnapshot(),
      cache: this.getCacheSnapshot(),
      db: this.getDbSnapshot(),
      counters,
      system: this.getSystemSnapshot(),
    };
  }

  getRoutesSnapshot() {
    const routes = [...this.routeStats.entries()].map(([route, stats]) => {
      const sortedDurations = [...stats.durations].sort((a, b) => a - b);
      return {
        route,
        calls: stats.count,
        errors: stats.errors,
        avgMs: stats.count > 0 ? Number((stats.totalMs / stats.count).toFixed(2)) : 0,
        p95Ms: this.percentile(sortedDurations, 95),
        p99Ms: this.percentile(sortedDurations, 99),
        maxMs: Number(stats.maxMs.toFixed(2)),
        avgDbQueriesPerRequest:
          stats.count > 0 ? Number((stats.totalDbQueries / stats.count).toFixed(2)) : 0,
      };
    });

    const slowest = [...routes].sort((a, b) => b.p95Ms - a.p95Ms);
    const mostUsed = [...routes].sort((a, b) => b.calls - a.calls);
    return {
      totalTracked: routes.length,
      slowest: slowest.slice(0, 20),
      mostUsed: mostUsed.slice(0, 20),
      all: routes,
    };
  }

  getJobsSnapshot() {
    const jobs = [...this.jobStats.entries()].map(([name, stats]) => ({
      name,
      runs: stats.runs,
      failures: stats.failures,
      skippedByOverlap: stats.skipped,
      processedItems: stats.totalProcessedItems,
      avgItemsPerRun: stats.runs > 0 ? Number((stats.totalProcessedItems / stats.runs).toFixed(2)) : 0,
      avgMs: stats.runs > 0 ? Number((stats.totalMs / stats.runs).toFixed(2)) : 0,
      maxMs: Number(stats.maxMs.toFixed(2)),
      lastRunAt: stats.lastRunAt,
      lastStatus: stats.lastStatus,
    }));
    jobs.sort((a, b) => a.name.localeCompare(b.name));
    return jobs;
  }

  getCacheSnapshot() {
    const totalChecks = this.cache.hits + this.cache.misses;
    const hitRate =
      totalChecks === 0 ? 0 : Number(((this.cache.hits / totalChecks) * 100).toFixed(2));
    const hottestKeys = [...this.cacheKeyAccess.entries()]
      .map(([key, count]) => ({ key, accesses: count }))
      .sort((a, b) => b.accesses - a.accesses)
      .slice(0, 20);

    return {
      ...this.cache,
      hitRate,
      hottestKeys,
    };
  }

  getDbSnapshot() {
    const operations = [...this.dbOperationStats.entries()].map(([operation, stats]) => ({
      operation,
      calls: stats.count,
      errors: stats.errors,
      avgMs: stats.count > 0 ? Number((stats.totalMs / stats.count).toFixed(2)) : 0,
      maxMs: Number(stats.maxMs.toFixed(2)),
    }));
    operations.sort((a, b) => b.avgMs - a.avgMs);

    return {
      operations: operations.slice(0, 50),
      slowQueries: this.slowDbQueries.slice(0, 30),
      activeRequestCounters: this.requestQueryCounters.size,
    };
  }

  getSystemSnapshot() {
    const usage = process.memoryUsage();
    return {
      uptimeSec: Number(process.uptime().toFixed(2)),
      memory: {
        rssMb: Number((usage.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((usage.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((usage.heapTotal / 1024 / 1024).toFixed(2)),
      },
      eventLoopLagMs: Number(this.eventLoopLagMs.toFixed(2)),
      inFlightRequests: this.inFlightRequests,
      maxInFlightRequests: this.maxInFlightRequests,
    };
  }

  private percentile(sortedDurations: number[], percentile: number): number {
    if (sortedDurations.length === 0) {
      return 0;
    }
    const index = Math.ceil((percentile / 100) * sortedDurations.length) - 1;
    const safeIndex = Math.min(sortedDurations.length - 1, Math.max(0, index));
    return Number(sortedDurations[safeIndex].toFixed(2));
  }

  private trackCacheKeyAccess(key?: string) {
    if (!key) {
      return;
    }
    this.cacheKeyAccess.set(key, (this.cacheKeyAccess.get(key) ?? 0) + 1);
    if (this.cacheKeyAccess.size > AppMetricsService.MAX_CACHE_KEY_TRACKING) {
      const oldest = this.cacheKeyAccess.keys().next().value;
      if (typeof oldest === 'string') {
        this.cacheKeyAccess.delete(oldest);
      }
    }
  }

  private initEventLoopLagProbe() {
    let previous = performance.now();
    const intervalMs = 5000;
    const timer = setInterval(() => {
      const now = performance.now();
      const drift = Math.max(0, now - previous - intervalMs);
      this.eventLoopLagMs = drift;
      previous = now;
    }, intervalMs);
    timer.unref?.();
  }
}
