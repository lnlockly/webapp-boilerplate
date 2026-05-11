import { create } from 'zustand';
import type { UserWithOrgs } from './api';

interface AuthState {
  accessToken: string | null;
  user: UserWithOrgs | null;
  activeOrgId: string | null;
  setToken: (t: string | null) => void;
  setUser: (u: UserWithOrgs | null) => void;
  setActiveOrg: (id: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  activeOrgId: typeof localStorage !== 'undefined' ? localStorage.getItem('activeOrgId') : null,
  setToken: (t) => set({ accessToken: t }),
  setUser: (u) => set({ user: u }),
  setActiveOrg: (id) => {
    if (id) localStorage.setItem('activeOrgId', id);
    else localStorage.removeItem('activeOrgId');
    set({ activeOrgId: id });
  },
  reset: () => {
    localStorage.removeItem('activeOrgId');
    set({ accessToken: null, user: null, activeOrgId: null });
  },
}));
