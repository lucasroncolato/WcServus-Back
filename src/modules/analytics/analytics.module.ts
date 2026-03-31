import { Module } from '@nestjs/common';
import { AppCacheModule } from 'src/common/cache/cache.module';
import { AnalyticsAggregatorService } from './analytics-aggregator.service';
import { AnalyticsCacheFacade } from './analytics-cache.facade';
import { AnalyticsOpsController } from './analytics-ops.controller';
import { AnalyticsSnapshotScheduler } from './analytics-snapshot.scheduler';
import { AnalyticsSnapshotService } from './analytics-snapshot.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AppCacheModule],
  controllers: [AnalyticsController, AnalyticsOpsController],
  providers: [
    AnalyticsService,
    AnalyticsAggregatorService,
    AnalyticsCacheFacade,
    AnalyticsSnapshotService,
    AnalyticsSnapshotScheduler,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
