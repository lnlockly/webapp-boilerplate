import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { auth } from '../../lib/api';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.reset(token, password);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card>
        <CardHeader title="Password reset" description="You can now sign in with your new password." />
        <CardBody>
          <Link to="/auth/login" className="text-sm text-brand-600 hover:underline">→ Go to sign in</Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Choose a new password" />
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="New password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button loading={loading} type="submit">Reset password</Button>
        </form>
      </CardBody>
    </Card>
  );
}
