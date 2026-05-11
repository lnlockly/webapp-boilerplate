import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CurrentUser, type AuthedUser } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

class CheckoutDto {
  @IsString() tierSlug!: string;
}

@ApiBearerAuth()
@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('tiers')
  @ApiOperation({ summary: 'List pricing tiers' })
  tiers() {
    return this.billing.listTiers();
  }

  @Get('orgs/:orgId/subscription')
  current(@CurrentUser() user: AuthedUser, @Param('orgId') orgId: string) {
    return this.billing.getSubscription(user.sub, orgId);
  }

  @Get('orgs/:orgId/invoices')
  invoices(@CurrentUser() user: AuthedUser, @Param('orgId') orgId: string) {
    return this.billing.listInvoices(user.sub, orgId);
  }

  @Post('orgs/:orgId/checkout')
  @ApiOperation({ summary: 'Create Stripe Checkout session and return URL' })
  checkout(@CurrentUser() user: AuthedUser, @Param('orgId') orgId: string, @Body() dto: CheckoutDto) {
    return this.billing.createCheckout(user.sub, orgId, dto.tierSlug);
  }

  @Post('orgs/:orgId/portal')
  @ApiOperation({ summary: 'Create Stripe customer portal session' })
  portal(@CurrentUser() user: AuthedUser, @Param('orgId') orgId: string) {
    return this.billing.createPortal(user.sub, orgId);
  }
}
