import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(private usersService: UsersService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
      apiVersion: '2023-10-16' as any,
    });
  }

  async createCheckoutSession(userId: string, plan: string): Promise<{ url: string }> {
    // Plan prices (in cents)
    const prices: Record<string, number> = {
      starter: 999,  // $9.99
      pro: 2999,     // $29.99
      enterprise: 9999, // $99.99
    };

    const priceInCents = prices[plan] || prices['starter'];

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
              description: `Monthly subscription - ${plan} tier`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing?canceled=true`,
        client_reference_id: userId,
        metadata: { plan, userId },
      });

      return { url: session.url! };
    } catch (error) {
      console.error('Stripe error:', error);
      // Return mock URL for development without Stripe
      return {
        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?success=true&mock=true`
      };
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.log('No webhook secret configured, skipping verification');
      return;
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const plan = session.metadata?.plan;

        if (userId && plan) {
          await this.usersService.update(userId, { subscription: plan }, 'system', 'system');
        }
      }
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }
}