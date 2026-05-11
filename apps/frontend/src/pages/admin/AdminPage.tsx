import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, EmptyState } from '../../components/ui/Card';
import { admin } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { Navigate } from 'react-router-dom';

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  if (user && user.role !== 'SUPERADMIN') return <Navigate to="/" replace />;

  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => admin.users() });
  const orgs = useQuery({ queryKey: ['admin-orgs'], queryFn: admin.orgs });
  const audit = useQuery({ queryKey: ['admin-audit'], queryFn: admin.audit });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <Card>
        <CardHeader title={`Users (${users.data?.length ?? 0})`} />
        <CardBody>
          {!users.data?.length ? <EmptyState title="No users" /> : (
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.data.slice(0, 20).map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{u.email}</span>
                  <span className="text-xs text-zinc-500">{u.role} • {new Date(u.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Organizations (${orgs.data?.length ?? 0})`} />
        <CardBody>
          {!orgs.data?.length ? <EmptyState title="No orgs" /> : (
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {orgs.data.slice(0, 20).map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{o.name}</span>
                  <span className="text-xs text-zinc-500">{o._count.memberships} members • {o.subscription?.tier.name ?? 'free'}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Audit log (last 50)" />
        <CardBody>
          {!audit.data?.length ? <EmptyState title="No events" /> : (
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {audit.data.slice(0, 50).map((a) => (
                <li key={a.id} className="py-2">
                  <span className="font-mono">{a.action}</span> · <span className="text-zinc-500">{a.user?.email ?? 'system'} · {new Date(a.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
