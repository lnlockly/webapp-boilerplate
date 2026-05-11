import { ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../common/prisma/prisma.service';
import { appConfig } from '../../config/app.config';

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);
  private readonly stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-10-28.acacia' as Stripe.LatestApiVersion })
    : null;

  constructor(private readonly prisma: PrismaService) {}

  async listTiers() {
    return this.prisma.pricingTier.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  }

  async getSubscription(userId: string, orgId: string) {
    await this.requireMember(userId, orgId);
    return this.prisma.subscription.findUnique({
      where: { orgId },
      include: { tier: true },
    });
  }

  async listInvoices(userId: string, orgId: string) {
    await this.requireMember(userId, orgId);
    return this.prisma.invoice.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async createCheckout(userId: string, orgId: string, tierSlug: string): Promise<{ url: string }> {
    if (!this.stripe || !appConfig.features.billing.enabled) {
      throw new ServiceUnavailableException('billing not configured');
    }
    await this.requireRole(userId, orgId, ['OWNER', 'ADMIN']);
    const tier = await this.prisma.pricingTier.findUnique({ where: { slug: tierSlug } });
    if (!tier?.stripePriceId) throw new NotFoundException('tier or stripe price not set');

    const org = await this.prisma.org.findUnique({ where: { id: orgId }, include: { subscription: true } });
    if (!org) throw new NotFoundException();

    let customerId = org.subscription?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ name: org.name, metadata: { orgId } });
      customerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: tier.stripePriceId, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL ?? 'http://localhost:5173/settings/billing?status=success',
      cancel_url: process.env.STRIPE_CANCEL_URL ?? 'http://localhost:5173/settings/billing?status=cancel',
      metadata: { orgId, tierId: tier.id },
    });

    return { url: session.url ?? '' };
  }

  async createPortal(userId: string, orgId: string): Promise<{ url: string }> {
    if (!this.stripe) throw new ServiceUnavailableException('billing not configured');
    await this.requireRole(userId, orgId, ['OWNER', 'ADMIN']);
    const sub = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (!sub?.stripeCustomerId) throw new NotFoundException('no stripe customer for org');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: process.env.STRIPE_SUCCESS_URL ?? 'http://localhost:5173/settings/billing',
    });
    return { url: session.url };
  }

  /** Internal: idempotent handler invoked by stripe webhook controller. */
  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    this.log.debug(`stripe event: ${event.type}`);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const tierId = session.metadata?.tierId;
        if (!orgId || !tierId) return;
        await this.prisma.subscription.upsert({
          where: { orgId },
          create: {
            orgId,
            tierId,
            status: 'ACTIVE',
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
          },
          update: {
            tierId,
            status: 'ACTIVE',
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
          },
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const dbSub = await this.prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!dbSub) return;
        const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE'> = {
          active: 'ACTIVE',
          past_due: 'PAST_DUE',
          canceled: 'CANCELED',
          trialing: 'TRIALING',
          incomplete: 'INCOMPLETE',
          incomplete_expired: 'CANCELED',
          unpaid: 'PAST_DUE',
        };
        await this.prisma.subscription.update({
          where: { id: dbSub.id },
          data: {
            status: statusMap[sub.status] ?? 'INCOMPLETE',
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
        });
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const dbSub = inv.subscription
          ? await this.prisma.subscription.findFirst({
              where: { stripeSubscriptionId: typeof inv.subscription === 'string' ? inv.subscription : inv.subscription.id },
            })
          : null;
        if (!dbSub) return;
        await this.prisma.invoice.upsert({
          where: { stripeInvoiceId: inv.id },
          create: {
            orgId: dbSub.orgId,
            stripeInvoiceId: inv.id,
            amountCents: inv.amount_paid ?? inv.amount_due ?? 0,
            currency: inv.currency ?? 'usd',
            status: inv.status ?? 'open',
            hostedUrl: inv.hosted_invoice_url ?? null,
            pdfUrl: inv.invoice_pdf ?? null,
          },
          update: {
            amountCents: inv.amount_paid ?? inv.amount_due ?? 0,
            status: inv.status ?? 'open',
            hostedUrl: inv.hosted_invoice_url ?? null,
            pdfUrl: inv.invoice_pdf ?? null,
          },
        });
        break;
      }
    }
  }

  getStripe(): Stripe | null {
    return this.stripe;
  }

  private async requireMember(userId: string, orgId: string) {
    const m = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException();
    return m;
  }

  private async requireRole(userId: string, orgId: string, roles: ('OWNER' | 'ADMIN' | 'MEMBER')[]) {
    const m = await this.requireMember(userId, orgId);
    if (!roles.includes(m.role)) throw new ForbiddenException();
    return m;
  }
}
