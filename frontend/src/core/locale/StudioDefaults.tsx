import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { localizationsApi, themesApi } from '@/api/settings/settings';
import { useThemeMode } from '@/providers/ThemeProvider';
import { setStudioLocale, toStudioLocale } from './studioLocale';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Reads the studio's default localization and default theme once a user is signed in (both answer 404 until an administrator
 * has chosen one, and are open to everyone signed in) and applies them. Returns whether both reads have finished, so the
 * screens can render once with the final formats instead of switching after the first paint. A failed or missing default is
 * not an error: the browser's own formats and the application's own theme stay.
 */
export function useStudioDefaults(): { settled: boolean } {
  const { applyStudioTheme } = useThemeMode();
  const locale = useQuery({ queryKey: ['studio', 'default-localization'], queryFn: ({ signal }) => localizationsApi.default(signal), retry: false, staleTime: FIVE_MINUTES });
  const theme = useQuery({ queryKey: ['studio', 'default-theme'], queryFn: ({ signal }) => themesApi.default(signal), retry: false, staleTime: FIVE_MINUTES });

  useEffect(() => {
    setStudioLocale(locale.data ? toStudioLocale(locale.data) : null);
  }, [locale.data]);

  useEffect(() => {
    const t = theme.data;
    applyStudioTheme(t && typeof t.theme_type === 'string' && typeof t.primary_color === 'string' && typeof t.secondary_color === 'string' && typeof t.font_family === 'string' ? t : null);
  }, [theme.data, applyStudioTheme]);

  useEffect(() => () => setStudioLocale(null), []);

  return { settled: !locale.isPending && !theme.isPending };
}
