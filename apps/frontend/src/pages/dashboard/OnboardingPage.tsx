import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { orgs, users } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { appConfig } from '../../config/app.config';
import { cn } from '../../lib/cn';

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [invite, setInvite] = useState('');
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);
  const navigate = useNavigate();
  const steps = appConfig.onboarding.steps;

  const next = async () => {
    if (step === 0 && name) await users.updateProfile({ name }).catch(() => undefined);
    if (step === 1 && orgName) {
      const org = await orgs.create({ name: orgName });
      setActiveOrg(org.id);
      if (invite) await orgs.invite(org.id, { email: invite, role: 'MEMBER' }).catch(() => undefined);
    }
    if (step < steps.length - 1) setStep(step + 1);
    else navigate('/');
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader title={`Welcome to ${appConfig.brand.name}`} description="Just a few steps to get going." />
        <CardBody>
          <div className="mb-6 flex gap-2">
            {steps.map((_, i) => (
              <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-800')} />
            ))}
          </div>

          {step === 0 ? (
            <div className="flex flex-col gap-3">
              <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          ) : step === 1 ? (
            <div className="flex flex-col gap-3">
              <Input label="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input label="Invite a teammate (optional)" type="email" value={invite} onChange={(e) => setInvite(e.target.value)} />
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
            <Button onClick={next}>{step === steps.length - 1 ? 'Finish' : 'Continue'}</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
