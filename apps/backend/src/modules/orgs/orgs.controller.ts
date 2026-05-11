import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, type AuthedUser } from '../../common/decorators/current-user.decorator';
import { OrgsService } from './orgs.service';

class CreateOrgDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() slug?: string;
}

class UpdateOrgDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logoUrl?: string;
}

class InviteDto {
  @IsEmail() email!: string;
  @IsIn(['OWNER', 'ADMIN', 'MEMBER']) role!: 'OWNER' | 'ADMIN' | 'MEMBER';
}

class UpdateMemberDto {
  @IsIn(['OWNER', 'ADMIN', 'MEMBER']) role!: 'OWNER' | 'ADMIN' | 'MEMBER';
}

@ApiBearerAuth()
@ApiTags('orgs')
@Controller({ path: 'orgs', version: '1' })
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  @ApiOperation({ summary: 'Orgs the current user is a member of' })
  list(@CurrentUser() user: AuthedUser) {
    return this.orgs.listForUser(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateOrgDto) {
    return this.orgs.create(user.sub, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.orgs.getOrThrow(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthedUser, @Param('id') id: string, @Body() dto: UpdateOrgDto) {
    return this.orgs.update(user.sub, id, dto);
  }

  @Get(':id/members')
  members(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.orgs.listMembers(user.sub, id);
  }

  @Post(':id/invitations')
  invite(@CurrentUser() user: AuthedUser, @Param('id') id: string, @Body() dto: InviteDto) {
    return this.orgs.invite(user.sub, id, dto.email, dto.role);
  }

  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('userId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.orgs.updateMember(user.sub, id, memberId, dto.role);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('userId') memberId: string,
  ) {
    return this.orgs.removeMember(user.sub, id, memberId);
  }
}
