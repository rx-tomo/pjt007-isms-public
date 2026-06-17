'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppTheme = 'light' | 'dark' | 'liquid-glass';

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const THEME_STORAGE_KEY = 'isms-theme';
const themes: AppTheme[] = ['light', 'dark', 'liquid-glass'];
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && themes.includes(value as AppTheme);
}

function applyThemeClass(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('theme-liquid-glass', theme === 'liquid-glass');
}

function readStoredTheme(): AppTheme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    const storedTheme = readStoredTheme();
    if (storedTheme) {
      setThemeState(storedTheme);
      applyThemeClass(storedTheme);
      return;
    }

    let cancelled = false;
    fetch('/api/preferences', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async response => (response.ok ? response.json() : null))
      .then(payload => {
        if (cancelled) return;
        const serverTheme = payload?.theme;
        if (isAppTheme(serverTheme)) {
          setThemeState(serverTheme);
          applyThemeClass(serverTheme);
        }
      })
      .catch(() => {
        // Unauthenticated or offline sessions keep the default light theme.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    applyThemeClass(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage can be unavailable in private browsing; theme class is already applied.
    }

    fetch('/api/preferences', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: nextTheme }),
    }).catch(() => {
      // Preference persistence is best-effort when the caller is unauthenticated.
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
