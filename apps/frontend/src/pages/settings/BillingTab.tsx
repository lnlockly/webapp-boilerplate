import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { billing } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { appConfig } from '../../config/app.config';

export function BillingTab() {
  const orgId = useAuthStore((s) => s.activeOrgId);

  const tiersQuery = useQuery({ queryKey: ['tiers'], queryFn: billing.tiers });
  const subQuery = useQuery({
    enabled: !!orgId,
    queryKey: ['subscription', orgId],
    queryFn: () => (orgId ? billing.subscription(orgId) : Promise.resolve(null)),
  });
  const invoicesQuery = useQuery({
    enabled: !!orgId,
    queryKey: ['invoices', orgId],
    queryFn: () => (orgId ? billing.invoices(orgId) : Promise.resolve([])),
  });

  const upgrade = async (slug: string) => {
    if (!orgId) return;
    const { url } = await billing.checkout(orgId, slug);
    if (url) window.location.href = url;
  };

  if (!appConfig.features.billing.enabled) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Billing disabled" description="Set STRIPE_SECRET_KEY env and flip features.billing.enabled in app.config.ts." />
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader title="Current plan" />
        <CardBody>
          {subQuery.data ? (
            <div>
              <p className="text-lg font-semibold">{subQuery.data.tier.name}</p>
              <p className="text-sm text-zinc-500">Status: {subQuery.data.status}</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No active subscription — start with a plan below.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Plans" />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {tiersQuery.data?.map((t) => (
              <div key={t.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h4 className="font-semibold">{t.name}</h4>
                <p className="mt-1 text-2xl font-bold">${(t.monthlyCents / 100).toFixed(0)}<span className="text-sm font-normal text-zinc-500">/mo</span></p>
                <Button size="sm" className="mt-3 w-full" onClick={() => upgrade(t.slug)} disabled={!t.stripePriceId && t.slug !== 'free'}>
                  {subQuery.data?.tier.slug === t.slug ? 'Current' : 'Choose'}
                </Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Invoices" />
        <CardBody>
          {!invoicesQuery.data?.length ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {invoicesQuery.data.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">${(i.amountCents / 100).toFixed(2)} {i.currency.toUpperCase()}</p>
                    <p className="text-xs text-zinc-500">{new Date(i.createdAt).toLocaleDateString()} • {i.status}</p>
                  </div>
                  {i.hostedUrl ? <a className="text-sm text-brand-600 hover:underline" href={i.hostedUrl} target="_blank" rel="noreferrer">View</a> : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
