import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthedUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

class OverrideSubDto {
  @IsString() tierSlug!: string;
  @IsIn(['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'INCOMPLETE']) status!: string;
}

@ApiBearerAuth()
@ApiTags('admin')
@Roles('SUPERADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.admin.listUsers(q, limit ? Number(limit) : 50);
  }

  @Get('orgs')
  orgs(@Query('q') q?: string) {
    return this.admin.listOrgs(q);
  }

  @Patch('orgs/:orgId/subscription')
  override(@CurrentUser() admin: AuthedUser, @Param('orgId') orgId: string, @Body() dto: OverrideSubDto) {
    return this.admin.overrideSubscription(admin.sub, orgId, dto.tierSlug, dto.status as 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE');
  }

  @Get('audit-log')
  audit(@Query('limit') limit?: string) {
    return this.admin.audit(limit ? Number(limit) : 200);
  }
}
