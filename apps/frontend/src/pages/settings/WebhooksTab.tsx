import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { webhooks } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export function WebhooksTab() {
  const orgId = useAuthStore((s) => s.activeOrgId);
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('invoice.paid,user.created');
  const [secret, setSecret] = useState<string | null>(null);

  const q = useQuery({
    enabled: !!orgId,
    queryKey: ['webhooks', orgId],
    queryFn: () => (orgId ? webhooks.list(orgId) : Promise.resolve([])),
  });

  if (!orgId) return <Card><CardBody><EmptyState title="No organization selected" /></CardBody></Card>;

  const create = async () => {
    const wh = await webhooks.create(orgId, { url, events: events.split(',').map((s) => s.trim()).filter(Boolean) });
    setSecret(wh.secret);
    setUrl('');
    qc.invalidateQueries({ queryKey: ['webhooks', orgId] });
  };

  return (
    <>
      {secret ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
          <CardBody>
            <p className="text-sm font-medium">Webhook signing secret (verify x-signature header with this):</p>
            <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-xs dark:bg-zinc-900">{secret}</code>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => setSecret(null)}>Dismiss</Button>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Add webhook endpoint" />
        <CardBody className="flex flex-col gap-3">
          <Input label="URL" placeholder="https://your-app.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input label="Events (comma-separated)" value={events} onChange={(e) => setEvents(e.target.value)} />
          <div><Button onClick={create} disabled={!url}>Add</Button></div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Endpoints" />
        <CardBody>
          {!q.data?.length ? (
            <EmptyState title="No webhooks yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {q.data.map((w) => (
                <li key={w.id} className="py-3">
                  <p className="text-sm font-medium">{w.url}</p>
                  <p className="text-xs text-zinc-500">{w.events.join(', ')}</p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
