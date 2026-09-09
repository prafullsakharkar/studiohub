import { create } from 'zustand';

interface ThemeState {
  isDarkMode: boolean;
  density: 'compact' | 'comfortable';
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setDensity: (density: 'compact' | 'comfortable') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: true, // VFX platforms default to Dark mode for color calibration
  density: 'comfortable',
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      if (typeof document !== 'undefined') {
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return { isDarkMode: next };
    }),
  setDarkMode: (dark) => {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    set({ isDarkMode: dark });
  },
  setDensity: (density) => set({ density }),
}));
