import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

@Injectable()
export class ChurchScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{
        user?: JwtPayload;
        headers?: Record<string, string | string[] | undefined>;
        body?: unknown;
        query?: unknown;
        params?: unknown;
      }>();

    const userChurchId = request.user?.churchId ?? null;
    if (!userChurchId) {
      return true;
    }

    const rawHeader = request.headers?.['x-church-id'];
    const headerChurchId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (headerChurchId && headerChurchId !== userChurchId) {
      throw new ForbiddenException('Church scope mismatch');
    }

    this.assertRequestChurchScope(request, userChurchId);

    return true;
  }

  private assertRequestChurchScope(
    request: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    },
    userChurchId: string,
  ) {
    const targets = [request.body, request.query, request.params];
    for (const target of targets) {
      this.scanPayload(target, userChurchId);
    }
  }

  private scanPayload(value: unknown, userChurchId: string) {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => this.scanPayload(item, userChurchId));
      return;
    }

    const objectValue = value as Record<string, unknown>;
    const scopedChurch = objectValue.churchId ?? objectValue.church_id;
    if (typeof scopedChurch === 'string' && scopedChurch && scopedChurch !== userChurchId) {
      throw new ForbiddenException('Church scope mismatch');
    }

    Object.values(objectValue).forEach((nested) => this.scanPayload(nested, userChurchId));
  }
}
