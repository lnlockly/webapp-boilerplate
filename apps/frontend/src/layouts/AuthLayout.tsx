import { Outlet } from 'react-router-dom';
import { appConfig } from '../config/app.config';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="mb-8 flex items-center gap-2">
        <img src={appConfig.brand.logo} alt={appConfig.brand.name} className="h-8 w-8" />
        <span className="text-lg font-semibold">{appConfig.brand.name}</span>
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
      <p className="mt-8 text-xs text-zinc-500">{appConfig.brand.tagline}</p>
    </div>
  );
}
