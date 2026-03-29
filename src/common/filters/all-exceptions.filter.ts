import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogService } from '../log/log.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logService?: LogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { sub?: string; churchId?: string } }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;
    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : null;

    const rawMessage = responseObject?.message;
    const isInternalError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      isInternalError
        ? 'Internal server error'
        : typeof exceptionResponse === 'string'
          ? exceptionResponse
          : Array.isArray(rawMessage)
            ? rawMessage.join('; ')
            : typeof rawMessage === 'string'
              ? rawMessage
              : 'Internal server error';

    this.logService?.event({
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      module: 'http',
      action: status === 403 ? 'security.access_denied' : 'exception.captured',
      message: `${request.method} ${request.url}`,
      churchId: request.user?.churchId ?? null,
      userId: request.user?.sub ?? null,
      metadata: {
        statusCode: status,
        requestPath: request.url,
        requestMethod: request.method,
        exception: this.serializeException(exception),
      },
    });

    const isProduction = process.env.NODE_ENV === 'production';

    response.status(status).json({
      statusCode: status,
      message,
      errorCode:
        (typeof responseObject?.errorCode === 'string' && responseObject.errorCode) ||
        (typeof responseObject?.code === 'string' && responseObject.code) ||
        undefined,
      details: isInternalError ? undefined : (responseObject?.errors ?? responseObject?.details ?? undefined),
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(isProduction
        ? {}
        : {
            debug:
              responseObject ??
              (typeof exceptionResponse === 'string' ? exceptionResponse : 'Internal server error'),
          }),
    });
  }

  private serializeException(exception: unknown) {
    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      };
    }
    if (typeof exception === 'string') {
      return { message: exception };
    }
    if (exception && typeof exception === 'object') {
      return exception;
    }
    return { message: 'Unknown exception' };
  }
}
