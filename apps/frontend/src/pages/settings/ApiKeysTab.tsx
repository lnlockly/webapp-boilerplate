import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiKeys } from '../../lib/api';

export function ApiKeysTab() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['api-keys'], queryFn: apiKeys.list });

  const generate = async () => {
    const k = await apiKeys.create({ name, scopes: ['read', 'write'] });
    setCreated(k.key);
    setName('');
    qc.invalidateQueries({ queryKey: ['api-keys'] });
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? Apps using it will break.')) return;
    await apiKeys.revoke(id);
    qc.invalidateQueries({ queryKey: ['api-keys'] });
  };

  return (
    <>
      {created ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
          <CardBody>
            <p className="text-sm font-medium">Your new key — copy it now, you won't see it again:</p>
            <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-xs dark:bg-zinc-900">{created}</code>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setCreated(null)}>Dismiss</Button>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Generate API key" />
        <CardBody className="flex items-end gap-3">
          <div className="flex-1"><Input label="Key name" placeholder="My laptop" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Button onClick={generate} disabled={!name}>Generate</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Your keys" />
        <CardBody>
          {!q.data?.length ? (
            <EmptyState title="No API keys yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {q.data.map((k) => (
                <li key={k.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <code className="text-xs text-zinc-500">{k.prefix}…</code>
                    <p className="text-xs text-zinc-500">Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}</p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => revoke(k.id)}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
