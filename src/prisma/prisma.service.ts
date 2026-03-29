import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { RequestContextService } from 'src/common/observability/request-context.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(
    private readonly metricsService: AppMetricsService,
    private readonly requestContextService: RequestContextService,
    private readonly logService: LogService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    if (!process.env.POSTGRES_PRISMA_URL) {
      throw new Error(
        'POSTGRES_PRISMA_URL is not defined. Create a .env file in the backend root based on .env.example.',
      );
    }

    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      const startedAt = performance.now();
      const requestId = this.requestContextService.requestId();
      try {
        const result = await next(params);
        const durationMs = performance.now() - startedAt;
        this.metricsService.recordDbQuery({
          model: params.model ?? 'raw',
          action: params.action,
          durationMs,
          requestId,
          error: false,
        });

        if (durationMs >= 400) {
          this.logService.event({
            level: 'warn',
            module: 'db',
            action: 'query.slow',
            message: `${params.model ?? 'raw'}.${params.action}`,
            requestId,
            metadata: {
              durationMs: Number(durationMs.toFixed(2)),
              model: params.model ?? 'raw',
              action: params.action,
            },
          });
        }

        return result;
      } catch (error) {
        const durationMs = performance.now() - startedAt;
        this.metricsService.recordDbQuery({
          model: params.model ?? 'raw',
          action: params.action,
          durationMs,
          requestId,
          error: true,
        });

        this.logService.event({
          level: 'error',
          module: 'db',
          action: 'query.error',
          message: `${params.model ?? 'raw'}.${params.action}`,
          requestId,
          metadata: {
            durationMs: Number(durationMs.toFixed(2)),
            model: params.model ?? 'raw',
            action: params.action,
            error: this.serializeError(error),
          },
        });

        throw error;
      }
    });

    await this.$connect();
  }

  private serializeError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }
    if (typeof error === 'string') {
      return { message: error };
    }
    return { message: 'Unknown prisma error' };
  }
}
