import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthedUser {
  sub: string;
  email: string;
  role: 'USER' | 'SUPERADMIN';
  orgId?: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data, ctx) => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    return req.user;
  },
);