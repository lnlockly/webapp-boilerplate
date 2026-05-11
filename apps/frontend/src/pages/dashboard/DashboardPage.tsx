import { Card, CardBody, CardHeader, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../lib/auth-store';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back{user?.name ? `, ${user.name}` : ''}.</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Here's what's happening with your workspace.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total users" value="—" />
        <StatCard label="Active subscriptions" value="—" />
        <StatCard label="API calls (24h)" value="—" />
      </div>
      <Card>
        <CardHeader title="Get started" description="A few things to set up before you ship." />
        <CardBody>
          <EmptyState
            title="No data yet"
            description="Once your domain models start producing records, they will appear here."
            action={<Button>Create your first record</Button>}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardBody>
    </Card>
  );
}
