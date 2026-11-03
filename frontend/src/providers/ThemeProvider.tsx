import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  UserThemePreferences,
  DEFAULT_ACCENT_CYAN,
  DEFAULT_ACCENT_BLUE,
  ACCENT_PRESETS,
  AccentColorPreset,
} from '@/types/identity';

export type ThemeMode = 'dark' | 'light' | 'system';

/** What the studio's default theme (`GET /themes/default/`, Q-22) contributes. See `applyStudioTheme`. */
export interface StudioTheme {
  theme_type: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
}

/** The theme's font keyword (sans, serif, mono) as a CSS font stack; sans is the application's own stack, left alone. */
export const FONT_STACKS: Record<string, string | null> = {
  sans: null,
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

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
  /**
   * The studio's default theme sets the STARTING point: light or dark, and the two accent colours, only for someone who has
   * not chosen their own (what a person picks is kept in this browser and always wins). The font follows the theme for
   * everyone. The theme's surface colours, text colours, radius, spacing and font size are not applied: the application's
   * screens are built on a fixed utility-class palette and scale, not on variables.
   */
  applyStudioTheme: (theme: StudioTheme | null) => void;
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

  const applyStudioTheme = useCallback(
    (theme: StudioTheme | null) => {
      if (typeof document === 'undefined') return;
      const stack = theme ? (FONT_STACKS[theme.font_family] ?? null) : null;
      if (stack) document.documentElement.style.setProperty('--studio-font-family', stack);
      else document.documentElement.style.removeProperty('--studio-font-family');
      if (!theme) return;

      let chosenMode = false;
      let chosenAccent = false;
      try {
        chosenMode = localStorage.getItem(storageKey) !== null;
        chosenAccent = localStorage.getItem(accentStorageKey) !== null;
      } catch {
        // storage unavailable: nobody has chosen anything we can see
      }
      if (!chosenMode && (theme.theme_type === 'light' || theme.theme_type === 'dark')) setModeState(theme.theme_type);
      if (!chosenAccent && HEX.test(theme.primary_color) && HEX.test(theme.secondary_color)) {
        setAccentCyan(theme.primary_color);
        setAccentBlue(theme.secondary_color);
        setActivePresetId(undefined);
      }
    },
    [storageKey, accentStorageKey]
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
        applyStudioTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
