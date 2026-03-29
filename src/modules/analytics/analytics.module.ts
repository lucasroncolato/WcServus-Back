import { Module } from '@nestjs/common';
import { AppCacheModule } from 'src/common/cache/cache.module';
import { AnalyticsAggregatorService } from './analytics-aggregator.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AppCacheModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsAggregatorService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
