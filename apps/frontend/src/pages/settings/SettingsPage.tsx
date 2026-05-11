import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { appConfig } from '../../config/app.config';

export function SettingsPage() {
  const tabs: { to: string; label: string; visible: boolean }[] = [
    { to: 'profile', label: 'Profile', visible: true },
    { to: 'team', label: 'Team', visible: appConfig.features.multi_org },
    { to: 'billing', label: 'Billing', visible: appConfig.features.billing.enabled || appConfig.features.billing.showInSidebar },
    { to: 'api-keys', label: 'API keys', visible: appConfig.features.api_keys },
    { to: 'webhooks', label: 'Webhooks', visible: appConfig.features.webhooks },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-col gap-1">
          {tabs.filter((t) => t.visible).map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) =>
              cn('rounded-lg px-3 py-2 text-sm',
                isActive
                  ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800')}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
