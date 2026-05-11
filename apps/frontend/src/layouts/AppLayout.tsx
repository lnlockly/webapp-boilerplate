import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings, ShieldCheck, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { useAuthStore } from '../lib/auth-store';
import { useTheme } from '../lib/theme';
import { auth } from '../lib/api';
import { appConfig } from '../config/app.config';
import { cn } from '../lib/cn';
import { OrgSwitcher } from '../components/OrgSwitcher';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();

  const onLogout = async () => {
    try {
      await auth.logout();
    } catch { /* ignore */ }
    reset();
    navigate('/auth/login');
  };

  const navItem = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/10 dark:text-brand-100'
            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="hidden w-64 flex-col border-r border-zinc-200 bg-white p-4 md:flex dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={appConfig.brand.logo} alt="" className="h-7 w-7" />
          <span className="text-base font-semibold">{appConfig.brand.name}</span>
        </div>
        <OrgSwitcher />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {navItem('/', <LayoutDashboard size={16} />, 'Dashboard')}
          {navItem('/settings', <Settings size={16} />, 'Settings')}
          {appConfig.features.admin_panel && user?.role === 'SUPERADMIN'
            ? navItem('/admin', <ShieldCheck size={16} />, 'Admin')
            : null}
        </nav>
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="flex items-center gap-1">
            <button onClick={() => setMode('light')} className={cn('rounded p-1.5', mode === 'light' && 'bg-zinc-100 dark:bg-zinc-800')} aria-label="Light"><Sun size={14} /></button>
            <button onClick={() => setMode('dark')} className={cn('rounded p-1.5', mode === 'dark' && 'bg-zinc-100 dark:bg-zinc-800')} aria-label="Dark"><Moon size={14} /></button>
            <button onClick={() => setMode('auto')} className={cn('rounded p-1.5', mode === 'auto' && 'bg-zinc-100 dark:bg-zinc-800')} aria-label="Auto"><Monitor size={14} /></button>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:px-8">
          <div className="text-sm text-zinc-500">{user?.email}</div>
        </header>
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
