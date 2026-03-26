import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
}
