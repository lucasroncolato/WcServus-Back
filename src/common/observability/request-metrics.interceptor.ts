import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogService } from '../log/log.service';
import { AppMetricsService } from './app-metrics.service';
import { RequestContextService } from './request-context.service';

type JwtLikeUser = {
  sub?: string;
  churchId?: string;
};

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: AppMetricsService,
    private readonly requestContext: RequestContextService,
    private readonly logService: LogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = performance.now();
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method?: string;
      route?: { path?: string };
      originalUrl?: string;
      url?: string;
      user?: JwtLikeUser;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const response = http.getResponse<{ statusCode?: number }>();

    const method = request.method ?? 'UNKNOWN';
    const path = request.route?.path ?? request.originalUrl ?? request.url ?? 'unknown';
    const user = request.user;
    const requestId = this.resolveRequestId(request.headers);

    this.metrics.recordRequestStarted();
    this.metrics.registerRequest(requestId);

    return this.requestContext.run(
      {
        requestId,
        churchId: user?.churchId ?? null,
        userId: user?.sub ?? null,
        method,
        route: path,
      },
      () =>
        next.handle().pipe(
          tap({
            next: () => this.recordSuccess(request, response, startedAt, requestId),
            error: (error: unknown) => this.recordError(request, response, startedAt, requestId, error),
          }),
        ),
    );
  }

  private recordSuccess(
    request: {
      method?: string;
      route?: { path?: string };
      originalUrl?: string;
      url?: string;
      user?: JwtLikeUser;
      ip?: string;
    },
    response: { statusCode?: number },
    startedAt: number,
    requestId: string,
  ) {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const status = response.statusCode ?? 200;
    const method = request.method ?? 'UNKNOWN';
    const path = request.route?.path ?? request.originalUrl ?? request.url ?? 'unknown';
    const dbQueries = this.metrics.completeRequestDbQueries(requestId);
    this.metrics.recordRoute(method, path, status, durationMs, dbQueries);
    this.metrics.recordRequestFinished();

    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.logService.event({
      level,
      module: 'http',
      action: 'request.completed',
      message: `${method} ${path}`,
      requestId,
      churchId: request.user?.churchId ?? null,
      userId: request.user?.sub ?? null,
      durationMs,
      metadata: {
        statusCode: status,
        dbQueries,
        ip: request.ip,
      },
    });
  }

  private recordError(
    request: {
      method?: string;
      route?: { path?: string };
      originalUrl?: string;
      url?: string;
      user?: JwtLikeUser;
      ip?: string;
    },
    response: { statusCode?: number },
    startedAt: number,
    requestId: string,
    error: unknown,
  ) {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const status = response.statusCode ?? 500;
    const method = request.method ?? 'UNKNOWN';
    const path = request.route?.path ?? request.originalUrl ?? request.url ?? 'unknown';
    const dbQueries = this.metrics.completeRequestDbQueries(requestId);
    this.metrics.recordRoute(method, path, status, durationMs, dbQueries);
    this.metrics.recordRequestFinished();

    this.logService.event({
      level: 'error',
      module: 'http',
      action: 'request.failed',
      message: `${method} ${path}`,
      requestId,
      churchId: request.user?.churchId ?? null,
      userId: request.user?.sub ?? null,
      durationMs,
      metadata: {
        statusCode: status,
        dbQueries,
        ip: request.ip,
        error: this.serializeError(error),
      },
    });
  }

  private resolveRequestId(headers?: Record<string, string | string[] | undefined>) {
    const headerValue = headers?.['x-request-id'];
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }
    if (Array.isArray(headerValue) && headerValue[0]?.trim()) {
      return headerValue[0].trim();
    }
    return randomUUID();
  }

  private serializeError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    if (typeof error === 'string') {
      return { message: error };
    }
    if (error && typeof error === 'object') {
      return error;
    }
    return { message: 'Unknown error' };
  }
}
