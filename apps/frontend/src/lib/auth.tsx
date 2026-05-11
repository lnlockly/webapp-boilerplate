import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auth } from './api';
import { useAuthStore } from './auth-store';

/** Hydrates user state on app boot via /auth/me (refresh cookie → access token). */
export function useBootstrapAuth() {
  const setUser = useAuthStore((s) => s.setUser);
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);

  const q = useQuery({
    queryKey: ['me'],
    queryFn: auth.me,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (q.data) {
      setUser(q.data);
      if (!activeOrgId && q.data.orgs[0]) {
        setActiveOrg(q.data.orgs[0].id);
      }
    } else if (q.isError) {
      setUser(null);
    }
  }, [q.data, q.isError, setUser, setActiveOrg, activeOrgId]);

  return q;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, data, isError } = useBootstrapAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenSpinner />;
  if (isError || !data) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function FullScreenSpinner() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-brand-600" />
    </div>
  );
}
