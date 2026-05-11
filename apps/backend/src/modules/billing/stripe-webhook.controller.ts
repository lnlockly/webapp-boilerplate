import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';

@ApiExcludeController()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    const stripe = this.billing.getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) throw new BadRequestException('stripe not configured');

    // NOTE: requires raw-body middleware in main.ts for this route in production.
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, secret);
    } catch (err) {
      throw new BadRequestException(`invalid signature: ${(err as Error).message}`);
    }
    await this.billing.handleStripeEvent(event);
    return { received: true };
  }
}
