import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { auth } from '../../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await auth.forgot(email).catch(() => undefined);
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader title="Check your inbox" description="If an account exists for that email, we sent a reset link." />
        <CardBody>
          <Link to="/auth/login" className="text-sm text-brand-600 hover:underline">← Back to sign in</Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Reset password" />
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button loading={loading} type="submit">Send reset link</Button>
        </form>
      </CardBody>
    </Card>
  );
}
