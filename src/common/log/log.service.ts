import { Injectable, LoggerService } from '@nestjs/common';

type LogMeta = Record<string, unknown> | undefined;

@Injectable()
export class LogService implements LoggerService {
  log(message: string, context?: string, meta?: LogMeta) {
    this.write('INFO', message, context, meta);
  }

  error(message: string, trace?: string, context?: string, meta?: LogMeta) {
    this.write('ERROR', message, context, { trace, ...(meta ?? {}) });
  }

  warn(message: string, context?: string, meta?: LogMeta) {
    this.write('WARN', message, context, meta);
  }

  debug(message: string, context?: string, meta?: LogMeta) {
    this.write('DEBUG', message, context, meta);
  }

  verbose(message: string, context?: string, meta?: LogMeta) {
    this.write('VERBOSE', message, context, meta);
  }

  private write(
    level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'VERBOSE',
    message: string,
    context?: string,
    meta?: LogMeta,
  ) {
    // Canonical JSON log line for ingestion in observability stacks.
    process.stdout.write(
      `${JSON.stringify({
        ts: new Date().toISOString(),
        level,
        context: context ?? null,
        message,
        ...(meta ? { meta } : {}),
      })}\n`,
    );
  }
}

