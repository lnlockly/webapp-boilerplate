import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { auth } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export function MagicLinkPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    auth.magicConsume(token).then(({ accessToken }) => {
      setToken(accessToken);
      navigate('/');
    });
  }, [token, setToken, navigate]);

  if (token) {
    return (
      <Card>
        <CardHeader title="Signing you in…" />
        <CardBody><p className="text-sm text-zinc-500">One moment.</p></CardBody>
      </Card>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await auth.magicRequest(email).catch(() => undefined);
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader title="Magic link sent" description={`Check ${email} for a sign-in link (valid 15 minutes).`} />
        <CardBody><Link to="/auth/login" className="text-sm text-brand-600 hover:underline">← Back to sign in</Link></CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Sign in with a magic link" description="We'll email you a one-tap link." />
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button loading={loading} type="submit">Send magic link</Button>
        </form>
      </CardBody>
    </Card>
  );
}
