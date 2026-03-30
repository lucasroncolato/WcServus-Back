import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { ServantUserIntegrityService } from './servant-user-integrity.service';

@Injectable()
export class ServantUserIntegrityScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly integrityService: ServantUserIntegrityService,
    private readonly metricsService: AppMetricsService,
    private readonly logService: LogService,
  ) {}

  onModuleInit() {
    const enabled = process.env.SERVANT_USER_INTEGRITY_MONITOR_ENABLED !== 'false';
    if (!enabled) {
      this.logService.log(
        'Servant/User integrity monitor disabled by env',
        ServantUserIntegrityScheduler.name,
      );
      return;
    }

    const intervalMs = this.resolveIntervalMs();
    this.timer = setInterval(() => void this.executeScan(), intervalMs);
    void this.executeScan();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private resolveIntervalMs() {
    const configured = Number(process.env.SERVANT_USER_INTEGRITY_MONITOR_INTERVAL_MS);
    if (Number.isFinite(configured) && configured >= 60_000) {
      return configured;
    }
    return 24 * 60 * 60 * 1000;
  }

  private async executeScan() {
    const jobName = 'servant_user_integrity_scan';
    if (this.running) {
      this.metricsService.recordJob(jobName, 0, true, { skipped: true });
      this.logService.event({
        level: 'warn',
        module: 'integrity-monitor',
        action: 'scan.skipped_overlap',
        message: 'Servant/User integrity scan skipped due to overlap',
      });
      return;
    }

    this.running = true;
    const startedAt = performance.now();
    try {
      const scan = await this.integrityService.runScan();
      const durationMs = performance.now() - startedAt;
      const metadata = {
        status: scan.status,
        totals: scan.totals,
        byIssueType: scan.byIssueType,
      };

      if (scan.status === 'blocking') {
        this.logService.event({
          level: 'error',
          module: 'integrity-monitor',
          action: 'scan.blocking',
          message: 'Blocking User/Servant integrity inconsistencies detected',
          durationMs,
          metadata,
        });
      } else if (scan.status === 'manual_review') {
        this.logService.event({
          level: 'warn',
          module: 'integrity-monitor',
          action: 'scan.manual_review',
          message: 'User/Servant integrity inconsistencies require manual review',
          durationMs,
          metadata,
        });
      } else {
        this.logService.event({
          level: 'info',
          module: 'integrity-monitor',
          action: 'scan.healthy',
          message: 'User/Servant integrity scan completed with no inconsistencies',
          durationMs,
          metadata,
        });
      }

      this.metricsService.recordJob(jobName, durationMs, true, {
        processedItems: scan.totals.total,
      });
      this.metricsService.incrementCounter(`integrity.servant_user.${scan.status}`);
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      this.metricsService.recordJob(jobName, durationMs, false);
      this.logService.error(
        'Servant/User integrity scan failed',
        String(error),
        ServantUserIntegrityScheduler.name,
      );
    } finally {
      this.running = false;
    }
  }
}
