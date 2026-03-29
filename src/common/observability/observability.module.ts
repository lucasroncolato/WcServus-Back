import { Global, Module } from '@nestjs/common';
import { AppMetricsService } from './app-metrics.service';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [AppMetricsService, RequestContextService],
  exports: [AppMetricsService, RequestContextService],
})
export class ObservabilityModule {}
