import { Injectable } from '@nestjs/common';
import { JourneyProjectionCheckpointStatus } from '@prisma/client';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JourneyCheckpointService } from './journey-checkpoint.service';
import { JourneyService } from './journey.service';

const PROJECTOR_NAME = 'journey_projector_v1';
const DEFAULT_RECONCILE_LIMIT = 50;
const DEFAULT_RECONCILE_CHUNK = 10;

@Injectable()
export class JourneyReconcileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journeyService: JourneyService,
    private readonly checkpointService: JourneyCheckpointService,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
  ) {}

  async reconcileDaily(limit = this.resolveLimit()) {
    const startedAt = performance.now();
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleServants = await this.prisma.servant.findMany({
      where: {
        deletedAt: null,
        OR: [
          { journey: null },
          { journey: { updatedAt: { lt: staleCutoff } } },
          { journeyProjectionCheckpoints: { none: {} } },
          { journeyProjectionCheckpoints: { some: { lastReconciledAt: { lt: staleCutoff } } } },
        ],
      },
      select: { id: true, churchId: true },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });

    let success = 0;
    let failed = 0;
    const chunkSize = this.resolveChunkSize();
    for (let index = 0; index < staleServants.length; index += chunkSize) {
      const chunk = staleServants.slice(index, index + chunkSize);
      const results = await Promise.all(
        chunk.map(async (servant) => {
          try {
            await this.journeyService.refreshJourneyProjection(servant.id, servant.churchId);
            await this.checkpointService.markReconciled({
              projectorName: PROJECTOR_NAME,
              churchId: servant.churchId,
              servantId: servant.id,
              status: JourneyProjectionCheckpointStatus.OK,
              details: { source: 'daily_reconcile' },
            });
            return { ok: true as const };
          } catch (error) {
            await this.checkpointService.markReconciled({
              projectorName: PROJECTOR_NAME,
              churchId: servant.churchId,
              servantId: servant.id,
              status: JourneyProjectionCheckpointStatus.ERROR,
              details: { source: 'daily_reconcile', error: String(error) },
            });
            this.logService.error(
              'Journey reconcile failed for servant',
              String(error),
              JourneyReconcileService.name,
              { servantId: servant.id, churchId: servant.churchId },
            );
            return { ok: false as const };
          }
        }),
      );

      for (const item of results) {
        if (item.ok) success += 1;
        else failed += 1;
      }

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }

    const durationMs = performance.now() - startedAt;
    this.metrics.recordJob('journey_reconcile_daily', durationMs, failed === 0, {
      processedItems: success + failed,
    });
    this.metrics.incrementCounter('journey.reconcile.success', success);
    this.metrics.incrementCounter('journey.reconcile.failed', failed);
    this.metrics.incrementCounter(
      'journey.reconcile.backlog',
      Math.max(0, staleServants.length - success - failed),
    );

    this.logService.event({
      level: failed > 0 ? 'warn' : 'info',
      module: 'journey-reconcile',
      action: 'daily.completed',
      message: 'Journey daily reconcile finished',
      durationMs,
      metadata: {
        stale: staleServants.length,
        success,
        failed,
      },
    });

    return { stale: staleServants.length, success, failed, durationMs };
  }

  async rebuildJourneyForServant(servantId: string, churchId: string | null) {
    const startedAt = performance.now();
    await this.journeyService.refreshJourneyProjection(servantId, churchId);
    await this.checkpointService.markReconciled({
      projectorName: PROJECTOR_NAME,
      churchId,
      servantId,
      status: JourneyProjectionCheckpointStatus.OK,
      details: { source: 'manual_rebuild_single' },
    });
    const durationMs = performance.now() - startedAt;
    this.metrics.recordJob('journey_rebuild_single', durationMs, true, { processedItems: 1 });
    this.metrics.incrementCounter('journey.rebuild.single', 1);
    return { servantId, durationMs };
  }

  async rebuildAllJourneys(limit?: number) {
    const startedAt = performance.now();
    const servants = await this.prisma.servant.findMany({
      where: { deletedAt: null },
      select: { id: true, churchId: true },
      ...(limit ? { take: limit } : {}),
      orderBy: { createdAt: 'asc' },
    });

    let success = 0;
    let failed = 0;
    for (const servant of servants) {
      try {
        await this.journeyService.refreshJourneyProjection(servant.id, servant.churchId);
        await this.checkpointService.markReconciled({
          projectorName: PROJECTOR_NAME,
          churchId: servant.churchId,
          servantId: servant.id,
          status: JourneyProjectionCheckpointStatus.OK,
          details: { source: 'manual_rebuild_all' },
        });
        success += 1;
      } catch (error) {
        failed += 1;
        await this.checkpointService.markReconciled({
          projectorName: PROJECTOR_NAME,
          churchId: servant.churchId,
          servantId: servant.id,
          status: JourneyProjectionCheckpointStatus.ERROR,
          details: { source: 'manual_rebuild_all', error: String(error) },
        });
      }
    }

    const durationMs = performance.now() - startedAt;
    this.metrics.recordJob('journey_rebuild_all', durationMs, failed === 0, {
      processedItems: success + failed,
    });
    this.metrics.incrementCounter('journey.rebuild.all.success', success);
    this.metrics.incrementCounter('journey.rebuild.all.failed', failed);
    return { total: servants.length, success, failed, durationMs };
  }

  async getCheckpointStatus() {
    return this.checkpointService.statusSummary(PROJECTOR_NAME);
  }

  private resolveLimit() {
    const parsed = Number(process.env.JOURNEY_RECONCILE_MAX_SERVANTS_PER_RUN ?? DEFAULT_RECONCILE_LIMIT);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return DEFAULT_RECONCILE_LIMIT;
    }
    return Math.floor(parsed);
  }

  private resolveChunkSize() {
    const parsed = Number(process.env.JOURNEY_RECONCILE_CHUNK_SIZE ?? DEFAULT_RECONCILE_CHUNK);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return DEFAULT_RECONCILE_CHUNK;
    }
    return Math.floor(parsed);
  }
}
