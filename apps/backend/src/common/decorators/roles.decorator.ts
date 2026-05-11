import { SetMetadata } from '@nestjs/common';
import type { OrgRole, GlobalRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<OrgRole | GlobalRole>) => SetMetadata(ROLES_KEY, roles);
