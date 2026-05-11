import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, type AuthedUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() avatarUrl?: string;
}

class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}

@ApiBearerAuth()
@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user with org memberships' })
  me(@CurrentUser() user: AuthedUser) {
    return this.users.getProfile(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthedUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Patch('me/password')
  changePassword(@CurrentUser() user: AuthedUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Soft-delete current account (GDPR)' })
  deleteMe(@CurrentUser() user: AuthedUser) {
    return this.users.softDelete(user.sub);
  }
}
