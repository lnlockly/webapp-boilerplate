import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { users } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const saveProfile = async () => {
    await users.updateProfile({ name });
    queryClient.invalidateQueries({ queryKey: ['me'] });
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(null), 2000);
  };

  const changePassword = async () => {
    try {
      await users.changePassword(currentPw, newPw);
      setPwMsg('Password updated. You may need to sign back in.');
      setCurrentPw('');
      setNewPw('');
    } catch (e) {
      setPwMsg((e as Error).message);
    }
  };

  const deleteAccount = async () => {
    if (!confirm('Delete your account? This cannot be undone.')) return;
    await users.deleteMe();
    location.href = '/auth/login';
  };

  return (
    <>
      <Card>
        <CardHeader title="Profile" />
        <CardBody className="flex flex-col gap-4">
          <Input label="Email" value={user?.email ?? ''} disabled />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button onClick={saveProfile}>Save changes</Button>
            {savedMsg ? <span className="text-sm text-green-600">{savedMsg}</span> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Change password" />
        <CardBody className="flex flex-col gap-4">
          <Input label="Current password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          <Input label="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button onClick={changePassword}>Update password</Button>
            {pwMsg ? <span className="text-sm text-zinc-500">{pwMsg}</span> : null}
          </div>
        </CardBody>
      </Card>

      <Card className="border-red-300 dark:border-red-900/50">
        <CardHeader title="Danger zone" description="Delete your account and all associated data." />
        <CardBody>
          <Button variant="danger" onClick={deleteAccount}>Delete account</Button>
        </CardBody>
      </Card>
    </>
  );
}
