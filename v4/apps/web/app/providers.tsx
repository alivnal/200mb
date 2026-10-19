/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { I18nProvider } from '@squish/i18n/react';
import { istanbulDaylight } from '@/lib/daylight';

// 'system' is the default when the visitor has not picked a theme: it follows
// day and night in Istanbul (light from sunrise to sunset), not the OS setting.
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme') as Theme) ?? 'system';
}

// Longest wait between checks, so a laptop waking from sleep catches up.
const MAX_RECHECK_MS = 60 * 60 * 1000;

function ThemeProvider({ children }: { children: React.ReactNode }) {
  // null until the stored choice is read after hydration.
  const [theme, setThemeState] = useState<Theme | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  useEffect(() => {
    if (theme === null) return;
    const apply = (next: 'light' | 'dark') => {
      setResolvedTheme(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    if (theme !== 'system') {
      apply(theme);
      return;
    }

    // Follow Istanbul's sunrise and sunset, switching at the next one.
    let timer = 0;
    const sync = () => {
      const { theme: auto, nextChange } = istanbulDaylight(Date.now());
      apply(auto);
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, Math.min(nextChange - Date.now() + 1000, MAX_RECHECK_MS));
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [theme]);

  const setTheme = (next: Theme) => {
    localStorage.setItem('theme', next);
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme: theme ?? 'system', resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
