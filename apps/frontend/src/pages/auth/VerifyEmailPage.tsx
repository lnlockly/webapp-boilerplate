import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { auth } from '../../lib/api';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'pending' | 'ok' | 'err'>('pending');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('err');
      setMsg('Missing token');
      return;
    }
    auth.verifyEmail(token).then(() => setState('ok')).catch((e) => {
      setState('err');
      setMsg((e as Error).message);
    });
  }, [params]);

  return (
    <Card>
      <CardHeader title={state === 'ok' ? 'Email verified' : state === 'err' ? 'Verification failed' : 'Verifying…'} description={msg ?? undefined} />
      <CardBody>
        {state !== 'pending' ? (
          <Link to="/" className="text-sm text-brand-600 hover:underline">→ Continue</Link>
        ) : null}
      </CardBody>
    </Card>
  );
}
