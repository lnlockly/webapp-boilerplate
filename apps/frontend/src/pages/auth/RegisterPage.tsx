import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { auth } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { appConfig } from '../../config/app.config';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
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
      const { accessToken } = await auth.register({ email, name, password });
      setToken(accessToken);
      navigate('/onboarding');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader title={`Create your ${appConfig.brand.name} account`} />
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Name" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" name="password" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" loading={loading} className="w-full">Create account</Button>
        </form>
        <div className="mt-6 border-t border-zinc-200 pt-4 text-center text-sm dark:border-zinc-800">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </div>
      </CardBody>
    </Card>
  );
}
