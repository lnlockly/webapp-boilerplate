import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(@Body() body: { plan: string }, @Request() req) {
    const { url } = await this.billingService.createCheckoutSession(req.user.userId, body.plan);
    return { url };
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    // Stripe sends raw body for webhooks - in production use raw body parser
    await this.billingService.handleWebhook(JSON.stringify(body), body.headers?.['stripe-signature'] || '');
    return { received: true };
  }
}