import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser, type AuthedUser } from '../../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

class CreateApiKeyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() orgId?: string;
  @IsArray() @ArrayMinSize(1) @IsIn(['read', 'write'], { each: true }) scopes!: ('read' | 'write')[];
}

@ApiBearerAuth()
@ApiTags('api-keys')
@Controller({ path: 'api-keys', version: '1' })
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser) {
    return this.keys.list(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Generate new API key. Plain text shown ONCE.' })
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateApiKeyDto) {
    return this.keys.create(user.sub, dto);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.keys.revoke(user.sub, id);
  }
}
