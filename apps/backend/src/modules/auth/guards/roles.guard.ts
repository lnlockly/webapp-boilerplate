import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthedUser } from '../../../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException();

    // SUPERADMIN passes everything.
    if (user.role === 'SUPERADMIN') return true;

    // Org-role checks are done in the corresponding service layer (need orgId from path).
    if (required.includes(user.role)) return true;
    return false;
  }
}
