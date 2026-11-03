import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { localizationsApi, themesApi } from '@/api/settings/settings';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useStudioDefaults } from '@/core/locale/StudioDefaults';
import { formatDateTime, getStudioLocale, setStudioLocale } from '@/core/locale/studioLocale';
import { authService } from '@/modules/auth/services/AuthService';
import { ThemeProvider, useThemeMode } from '@/providers/ThemeProvider';
import { freshTotp, live } from './liveBackend';

/**
 * The studio's default localization and theme (Phase 28) against a REAL backend: an administrator makes a localization
 * (MM/DD/YYYY, 12-hour, Sunday first) and a theme (light, two accent colours, serif) the defaults; an artist, who may not
 * manage settings, signs in and the application applies them. Run on a fresh live_backend.py seed.
 */
const T = { timeout: 20000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();
const made = {} as { locale: string; theme: string; previousLocale?: string; previousTheme?: string };

function Probe() {
  const { settled } = useStudioDefaults();
  const { mode } = useThemeMode();
  return (
    <div>
      <p data-testid="state">{settled ? 'settled' : 'loading'}</p>
      <p data-testid="mode">{mode}</p>
      {settled ? <p data-testid="when">{formatDateTime(new Date(2026, 10, 3, 14, 7))}</p> : null}
    </div>
  );
}
const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    </QueryClientProvider>
  );
const cssVar = (name: string) => document.documentElement.style.getPropertyValue(name);

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  setStudioLocale(null);
});
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  made.previousLocale = await localizationsApi.default().then((l) => l.id, () => undefined);
  made.previousTheme = await themesApi.default().then((t) => t.id, () => undefined);
  const locale = await localizationsApi.create({ code: `p28-${uid}`, name: `Phase 28 ${uid}`, language: 'en', timezone: 'UTC', date_format: 'MM/DD/YYYY', time_format: '12H', number_format: 'comma', week_start: 0 });
  made.locale = locale.id;
  await localizationsApi.setDefault(locale.id);
  const theme = await themesApi.create({ code: `p28-${uid}`, name: `Phase 28 ${uid}`, theme_type: 'light', primary_color: '#112233', secondary_color: '#445566', font_family: 'serif' });
  made.theme = theme.id;
  await themesApi.setDefault(theme.id);
  tokenStorage.clearTokens();
}, 120000);

afterAll(async () => {
  // Leave the seed as it was found.
  const outcome = await authService.login(live.users.manager);
  if (outcome.status === 'mfa_required') await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  if (made.previousLocale) await localizationsApi.setDefault(made.previousLocale);
  if (made.previousTheme) await themesApi.setDefault(made.previousTheme);
  tokenStorage.clearTokens();
}, 120000);

describe('an artist signs in to a studio with its own defaults', () => {
  it('reads both defaults (open to anyone signed in) and applies them', async () => {
    tokenStorage.clearTokens();
    const outcome = await authService.login(live.users.artist);
    if (outcome.status === 'mfa_required') throw new Error('the artist unexpectedly needs MFA');
    // The artist may read the defaults but not manage settings.
    await expect(localizationsApi.default()).resolves.toMatchObject({ id: made.locale, is_default: true });
    await expect(themesApi.default()).resolves.toMatchObject({ id: made.theme, is_default: true });

    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'), T);
    expect(screen.getByTestId('when').textContent).toBe('11/03/2026 2:07 PM');
    expect(getStudioLocale()).toEqual({ date_format: 'MM/DD/YYYY', time_format: '12H', number_format: 'comma', week_start: 0 });
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('light'), T);
    expect(cssVar('--studio-accent-cyan')).toBe('#112233');
    expect(cssVar('--studio-accent-blue')).toBe('#445566');
    expect(cssVar('--studio-font-family')).toContain('serif');
  });

  it('keeps the artist’s own choice of mode and accents', async () => {
    localStorage.setItem('studiohub-theme-mode', 'dark');
    localStorage.setItem('studiohub-theme-accents', JSON.stringify({ accentCyan: '#abcdef', accentBlue: '#fedcba', presetId: 'mine' }));
    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'), T);
    await waitFor(() => expect(cssVar('--studio-font-family')).toContain('serif'), T);
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(cssVar('--studio-accent-cyan')).toBe('#abcdef');
  });
});
