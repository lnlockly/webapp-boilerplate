/**
 * Seed pricing tiers. Run after DB migrate:
 *   pnpm --filter @app/backend exec ts-node scripts/seed-tiers.ts
 *
 * STRIPE_PRICE_FREE / STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE in env
 * map tiers → Stripe Price IDs. Empty = tier exists but billing-disabled.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tiers = [
  {
    slug: 'free',
    name: 'Free',
    stripePriceId: null,
    monthlyCents: 0,
    features: { seats: 3, api_calls: 1_000, storage_mb: 100 },
    sortOrder: 0,
  },
  {
    slug: 'pro',
    name: 'Pro',
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    monthlyCents: 2_900,
    features: { seats: 25, api_calls: 100_000, storage_mb: 10_000 },
    sortOrder: 10,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    monthlyCents: 49_900,
    features: { seats: -1, api_calls: -1, storage_mb: -1, sla: '99.9%' },
    sortOrder: 20,
  },
];

async function main() {
  for (const t of tiers) {
    await prisma.pricingTier.upsert({
      where: { slug: t.slug },
      create: t,
      update: t,
    });
    // eslint-disable-next-line no-console
    console.log(`seeded tier ${t.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
