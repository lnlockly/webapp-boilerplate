import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { orgs } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export function TeamTab() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const qc = useQueryClient();
  const [email, setEmail] = useState('');

  const membersQuery = useQuery({
    enabled: !!activeOrgId,
    queryKey: ['org-members', activeOrgId],
    queryFn: () => (activeOrgId ? orgs.members(activeOrgId) : Promise.resolve([])),
  });

  if (!activeOrgId) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="No organization selected" description="Create or select an org to manage your team." />
        </CardBody>
      </Card>
    );
  }

  const invite = async () => {
    await orgs.invite(activeOrgId, { email, role: 'MEMBER' });
    setEmail('');
    qc.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
  };

  return (
    <>
      <Card>
        <CardHeader title="Invite teammate" />
        <CardBody className="flex items-end gap-3">
          <div className="flex-1"><Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button onClick={invite}>Send invite</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Members" />
        <CardBody>
          {membersQuery.isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : !membersQuery.data?.length ? (
            <EmptyState title="No members yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {membersQuery.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                    <p className="text-xs text-zinc-500">{m.user.email}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
