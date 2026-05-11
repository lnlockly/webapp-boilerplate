import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { auth } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { appConfig } from '../../config/app.config';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await auth.login({ email, password });
      setToken(accessToken);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Sign in" description={`Welcome back to ${appConfig.brand.name}`} />
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        </form>
        <div className="mt-4 flex justify-between text-xs">
          <Link to="/auth/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
          {appConfig.features.magic_link ? <Link to="/auth/magic-link" className="text-brand-600 hover:underline">Use magic link</Link> : null}
        </div>
        <div className="mt-6 border-t border-zinc-200 pt-4 text-center text-sm dark:border-zinc-800">
          Don't have an account?{' '}
          <Link to="/auth/register" className="font-medium text-brand-600 hover:underline">Create one</Link>
        </div>
      </CardBody>
    </Card>
  );
}
