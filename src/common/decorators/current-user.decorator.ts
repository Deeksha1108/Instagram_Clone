import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest, JwtPayload } from '../types/auth.types';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!data) {
      return user;
    }

    return user?.[data];
  },
);