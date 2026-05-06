import { useState, useEffect } from 'react';

export type Theme = 'brown' | 'white';

const THEME_KEY = 'erlbrew_theme';

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return (stored === 'white' ? 'white' : 'brown');
  } catch {
    return 'brown';
  }
}

export function setStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme === 'white' ? 'white' : '');
  } catch {}
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    // Apply theme on mount
    setStoredTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'brown' ? 'white' : 'brown';
    setTheme(next);
    setStoredTheme(next);
  };

  const setThemeByName = (name: Theme) => {
    setTheme(name);
    setStoredTheme(name);
  };

  return { theme, toggleTheme, setThemeByName };
}