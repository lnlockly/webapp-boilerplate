import { create } from 'zustand';
import { useEffect } from 'react';
import { appConfig } from '../config/app.config';

type Mode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: Mode;
  setMode: (m: Mode) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  mode: (typeof localStorage !== 'undefined' && (localStorage.getItem('themeMode') as Mode)) || appConfig.theme.mode,
  setMode: (m) => {
    localStorage.setItem('themeMode', m);
    set({ mode: m });
  },
}));

export function useThemeMode() {
  const mode = useTheme((s) => s.mode);

  useEffect(() => {
    const apply = () => {
      const dark =
        mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (mode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [mode]);
}
