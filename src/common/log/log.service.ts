import { Injectable, LoggerService } from '@nestjs/common';

type LogMeta = Record<string, unknown> | undefined;

type StructuredLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'verbose';
  module: string;
  action: string;
  message: string;
  status?: 'success' | 'error' | 'skip';
  requestId?: string;
  churchId?: string | null;
  userId?: string | null;
  role?: string | null;
  entityId?: string | null;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class LogService implements LoggerService {
  log(message: string, context?: string, meta?: LogMeta) {
    this.event({
      level: 'info',
      module: context ?? 'app',
      action: 'log',
      message,
      metadata: meta,
    });
  }

  error(message: string, trace?: string, context?: string, meta?: LogMeta) {
    this.event({
      level: 'error',
      module: context ?? 'app',
      action: 'error',
      message,
      metadata: {
        trace,
        ...(meta ?? {}),
      },
    });
  }

  warn(message: string, context?: string, meta?: LogMeta) {
    this.event({
      level: 'warn',
      module: context ?? 'app',
      action: 'warn',
      message,
      metadata: meta,
    });
  }

  debug(message: string, context?: string, meta?: LogMeta) {
    this.event({
      level: 'debug',
      module: context ?? 'app',
      action: 'debug',
      message,
      metadata: meta,
    });
  }

  verbose(message: string, context?: string, meta?: LogMeta) {
    this.event({
      level: 'verbose',
      module: context ?? 'app',
      action: 'verbose',
      message,
      metadata: meta,
    });
  }

  event(input: {
    level: StructuredLogEntry['level'];
    module: string;
    action: string;
    message: string;
    status?: StructuredLogEntry['status'];
    requestId?: string;
    churchId?: string | null;
    userId?: string | null;
    role?: string | null;
    entityId?: string | null;
    durationMs?: number;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }) {
    const payload: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: input.level,
      module: input.module,
      action: input.action,
      message: input.message,
      ...(input.status ? { status: input.status } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.churchId !== undefined ? { churchId: input.churchId } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.durationMs !== undefined ? { durationMs: Number(input.durationMs.toFixed(2)) } : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }
}
