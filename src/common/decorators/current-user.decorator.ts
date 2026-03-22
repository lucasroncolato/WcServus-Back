import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): JwtPayload | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    return request.user;
  },
);