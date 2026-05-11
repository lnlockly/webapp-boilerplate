import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, IsUrl } from 'class-validator';
import { CurrentUser, type AuthedUser } from '../../common/decorators/current-user.decorator';
import { WebhooksService } from './webhooks.service';

class CreateWebhookDto {
  @IsUrl() url!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) events!: string[];
}

@ApiBearerAuth()
@ApiTags('webhooks')
@Controller({ path: 'orgs/:orgId/webhooks', version: '1' })
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser, @Param('orgId') orgId: string) {
    return this.webhooks.list(user.sub, orgId);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Param('orgId') orgId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.sub, orgId, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthedUser, @Param('orgId') orgId: string, @Param('id') id: string) {
    return this.webhooks.delete(user.sub, orgId, id);
  }
}
