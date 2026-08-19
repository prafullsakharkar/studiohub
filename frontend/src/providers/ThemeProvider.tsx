import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  ThemeOptions,
} from '@mui/material';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedMode: 'dark' | 'light';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'dark',
  storageKey = 'studiohub-theme-mode',
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

  // Keep html class in sync for Tailwind dark mode classes
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [resolvedMode]);

  // Linear + ftrack + NLE density Material UI theme configuration
  const theme = useMemo(() => {
    const isDark = resolvedMode === 'dark';

    const themeOptions: ThemeOptions = {
      palette: {
        mode: isDark ? 'dark' : 'light',
        primary: {
          main: '#6366f1', // Linear/Studio vibrant indigo
          light: '#818cf8',
          dark: '#4f46e5',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#a855f7', // Creative Purple
          light: '#c084fc',
          dark: '#9333ea',
        },
        success: {
          main: '#10b981', // Emerald approved
          light: '#34d399',
          dark: '#059669',
        },
        warning: {
          main: '#f59e0b', // Amber in-progress / review
          light: '#fbbf24',
          dark: '#d97706',
        },
        error: {
          main: '#f43f5e', // Rose critical / rejected
          light: '#fb7185',
          dark: '#e11d48',
        },
        info: {
          main: '#38bdf8', // Sky / OpenUSD blue
          light: '#7dd3fc',
          dark: '#0284c7',
        },
        background: {
          default: isDark ? '#080c14' : '#f8fafc',
          paper: isDark ? '#0f172a' : '#ffffff',
        },
        text: {
          primary: isDark ? '#f8fafc' : '#0f172a',
          secondary: isDark ? '#94a3b8' : '#64748b',
          disabled: isDark ? '#475569' : '#94a3b8',
        },
        divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      },
      typography: {
        fontFamily: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ].join(','),
        fontSize: 13, // Dense professional application sizing
        button: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
        },
        h1: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' },
        h2: { fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em' },
        h3: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.015em' },
        h4: { fontSize: '1rem', fontWeight: 600 },
        h5: { fontSize: '0.875rem', fontWeight: 600 },
        h6: { fontSize: '0.8125rem', fontWeight: 600 },
        body1: { fontSize: '0.8125rem', lineHeight: 1.5 },
        body2: { fontSize: '0.75rem', lineHeight: 1.4 },
        caption: { fontSize: '0.6875rem', lineHeight: 1.3 },
      },
      shape: {
        borderRadius: 8,
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              scrollbarColor: isDark ? '#334155 #0b0f19' : '#cbd5e1 #f1f5f9',
              '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                width: 6,
                height: 6,
              },
              '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                borderRadius: 4,
                backgroundColor: isDark ? '#334155' : '#cbd5e1',
              },
              '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
                backgroundColor: isDark ? '#080c14' : '#f1f5f9',
              },
            },
          },
        },
        MuiButton: {
          defaultProps: {
            disableElevation: true,
            size: 'small',
          },
          styleOverrides: {
            root: {
              borderRadius: 6,
              padding: '5px 12px',
              fontWeight: 600,
              fontSize: '0.75rem',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              height: 22,
              fontSize: '0.6875rem',
              fontWeight: 600,
              borderRadius: 4,
            },
          },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              backgroundColor: isDark ? '#1e293b' : '#0f172a',
              color: '#ffffff',
              fontSize: '0.6875rem',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              padding: '6px 10px',
              fontSize: '0.75rem',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            },
            head: {
              fontWeight: 700,
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: isDark ? '#0b1120' : '#f8fafc',
            },
          },
        },
      },
    };

    return createTheme(themeOptions);
  }, [resolvedMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
