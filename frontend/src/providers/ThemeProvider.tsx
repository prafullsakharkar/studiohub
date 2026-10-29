import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  UserThemePreferences,
  DEFAULT_ACCENT_CYAN,
  DEFAULT_ACCENT_BLUE,
  ACCENT_PRESETS,
  AccentColorPreset,
} from '@/types/identity';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeContextType {
  mode: ThemeMode;
  resolvedMode: 'dark' | 'light';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  // Accent colors
  accentCyan: string;
  accentBlue: string;
  activePresetId?: string;
  setAccentColors: (cyan: string, blue: string, presetId?: string) => void;
  applyPreset: (presetId: string) => void;
  resetToDefaults: () => void;
  presets: AccentColorPreset[];
  syncWithUserPreferences: (prefs?: UserThemePreferences) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

export const useTheme = useThemeMode;

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
  accentStorageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'dark',
  storageKey = 'studiohub-theme-mode',
  accentStorageKey = 'studiohub-theme-accents',
}) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        return stored;
      }
    } catch {
      // Fallback if localStorage is disabled
    }
    return defaultMode;
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // User-configurable Accent Colors State
  const [accentCyan, setAccentCyan] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(accentStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.accentCyan) return parsed.accentCyan;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ACCENT_CYAN;
  });

  const [accentBlue, setAccentBlue] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(accentStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.accentBlue) return parsed.accentBlue;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ACCENT_BLUE;
  });

  const [activePresetId, setActivePresetId] = useState<string | undefined>(() => {
    try {
      const stored = localStorage.getItem(accentStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.presetId) return parsed.presetId;
      }
    } catch {
      // ignore
    }
    return 'studio-default';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedMode: 'dark' | 'light' = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode;

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(storageKey, newMode);
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark');
  };

  // Keep html class, data-theme attribute, and style colorScheme in sync for Tailwind and browser UI
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [resolvedMode]);

  // Apply accent colors directly to root element CSS variables
  const applyColorsToDOM = useCallback((cyan: string, blue: string) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--studio-accent-cyan', cyan);
    root.style.setProperty('--studio-accent-blue', blue);
  }, []);

  // Sync on state changes
  useEffect(() => {
    applyColorsToDOM(accentCyan, accentBlue);
  }, [accentCyan, accentBlue, applyColorsToDOM]);

  const setAccentColors = useCallback(
    (cyan: string, blue: string, presetId?: string) => {
      setAccentCyan(cyan);
      setAccentBlue(blue);
      setActivePresetId(presetId);
      applyColorsToDOM(cyan, blue);
      try {
        localStorage.setItem(
          accentStorageKey,
          JSON.stringify({
            accentCyan: cyan,
            accentBlue: blue,
            presetId,
          })
        );
      } catch {
        // ignore
      }
    },
    [accentStorageKey, applyColorsToDOM]
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      const found = ACCENT_PRESETS.find((p) => p.id === presetId);
      if (found) {
        setAccentColors(found.cyan, found.blue, found.id);
      }
    },
    [setAccentColors]
  );

  const resetToDefaults = useCallback(() => {
    setAccentColors(DEFAULT_ACCENT_CYAN, DEFAULT_ACCENT_BLUE, 'studio-default');
  }, [setAccentColors]);

  const syncWithUserPreferences = useCallback(
    (prefs?: UserThemePreferences) => {
      if (!prefs) return;
      if (prefs.accentCyan && prefs.accentBlue) {
        setAccentColors(prefs.accentCyan, prefs.accentBlue, prefs.presetId);
      }
    },
    [setAccentColors]
  );

  return (
    <ThemeContext.Provider
      value={{
        mode,
        resolvedMode,
        setMode,
        toggleTheme,
        accentCyan,
        accentBlue,
        activePresetId,
        setAccentColors,
        applyPreset,
        resetToDefaults,
        presets: ACCENT_PRESETS,
        syncWithUserPreferences,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
