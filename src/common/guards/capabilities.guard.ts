import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionPolicyService } from '../auth/permission-policy.service';
import { CAPABILITIES_KEY } from '../decorators/require-capabilities.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';
import type { Capability } from '../auth/capabilities';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionPolicyService: PermissionPolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Capability[]>(CAPABILITIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Unauthenticated');
    }

    const allowed = await this.permissionPolicyService.hasCapabilities(user, required);
    if (!allowed) {
      throw new ForbiddenException('Missing capability for this action');
    }

    return true;
  }
}
