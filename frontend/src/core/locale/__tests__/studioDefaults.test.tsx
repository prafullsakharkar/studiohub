import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { ThemeProvider, useThemeMode } from '@/providers/ThemeProvider';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { useStudioDefaults } from '../StudioDefaults';
import { formatDateTime, getStudioLocale, setStudioLocale } from '../studioLocale';

type Captured = { status: number; body: Record<string, unknown> };
const flow = loadSample<Record<string, Captured>>('settings/_flow.json');
const path = (c: MockCall) => new URL(c.url).pathname;

/** Studio dark (primary #06b6d4, secondary #10B981, sans) and English (UK) 12-hour, as the live backend answered. */
const darkTheme = flow.themes_default.body;
const lightTheme = flow.themes_default_after.body;
const uk = flow.locales_default.body;

let answers: { theme: Captured; locale: Captured };
const server = (c: MockCall): MockReply => {
  if (path(c) === '/api/v1/settings/themes/default/') return { status: answers.theme.status, body: answers.theme.body };
  if (path(c) === '/api/v1/settings/localizations/default/') return { status: answers.locale.status, body: answers.locale.body };
  return { status: 404, body: {} };
};

/** Lets the effects that follow a state change run, so a check that something did NOT change is not made too early. */
const flush = async () => {
  for (let i = 0; i < 3; i++) await act(async () => {});
};

const root = () => document.documentElement;
const cyan = () => root().style.getPropertyValue('--studio-accent-cyan');
const blue = () => root().style.getPropertyValue('--studio-accent-blue');
const font = () => root().style.getPropertyValue('--studio-font-family');

function Screen() {
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

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <ThemeProvider>
        <Screen />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  root().style.removeProperty('--studio-font-family');
  answers = { theme: flow.themes_default as Captured, locale: flow.locales_default as Captured };
});
afterEach(() => {
  cleanup();
  setStudioLocale(null);
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('the studio’s default localization', () => {
  it('holds the screens back until both defaults are known, then formats with the studio’s choice', async () => {
    mockFetch(server);
    mount();
    expect(screen.getByTestId('state').textContent).toBe('loading');
    expect(screen.queryByTestId('when')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
    expect(screen.getByTestId('when').textContent).toBe('03/11/2026 2:07 PM');
    expect(getStudioLocale()).toEqual({ date_format: 'DD/MM/YYYY', time_format: '12H', number_format: 'dot', week_start: 1 });
  });

  it('waits for the theme too, not only the localization', async () => {
    mockFetch((c) => (path(c) === '/api/v1/settings/themes/default/' ? { status: 200, body: darkTheme, delayMs: 150 } : server(c)));
    mount();
    await waitFor(() => expect(getStudioLocale()).not.toBeNull());
    expect(screen.getByTestId('state').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
  });

  it('keeps the browser’s formats when no default has been chosen yet (404) and still lets the screens render', async () => {
    answers = { theme: flow.themes_default_none as Captured, locale: flow.locales_default_none as Captured };
    mockFetch(server);
    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
    expect(getStudioLocale()).toBeNull();
    expect(screen.getByTestId('when').textContent).toBe(new Date(2026, 10, 3, 14, 7).toLocaleString());
    expect(font()).toBe('');
  });

  it('keeps the browser’s formats when the body is not a localization', async () => {
    answers = { theme: flow.themes_default as Captured, locale: { status: 200, body: { detail: 'something else' } } };
    mockFetch(server);
    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
    expect(getStudioLocale()).toBeNull();
  });

  it('settles when the server fails altogether', async () => {
    mockFetch(() => new Error('network down'));
    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
    expect(getStudioLocale()).toBeNull();
  });

  it('is cleared when the signed-in area is left', async () => {
    mockFetch(server);
    mount();
    await waitFor(() => expect(getStudioLocale()).not.toBeNull());
    cleanup();
    expect(getStudioLocale()).toBeNull();
  });

  it('reads both defaults from the real routes, once each', async () => {
    const { calls } = mockFetch(server);
    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
    expect(calls.map(path).sort()).toEqual(['/api/v1/settings/localizations/default/', '/api/v1/settings/themes/default/']);
    expect(uk.code).toBe('en-gb');
  });
});

describe('the studio’s default theme', () => {
  it('starts someone who has chosen nothing in the theme’s mode and accent colours', async () => {
    answers = { theme: { status: 200, body: { ...lightTheme } }, locale: flow.locales_default as Captured };
    mockFetch(server);
    mount();
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('light'));
    // The colours are written to the page by an effect that runs after the mode shows: wait for them, do not read them at once.
    await waitFor(() => {
      expect(cyan()).toBe(lightTheme.primary_color);
      expect(blue()).toBe(lightTheme.secondary_color);
    });
    // A default is not a choice: nothing is saved in the browser.
    expect(localStorage.getItem('studiohub-theme-mode')).toBeNull();
    expect(localStorage.getItem('studiohub-theme-accents')).toBeNull();
  });

  it('never overrides what the person chose: their mode and accents win', async () => {
    localStorage.setItem('studiohub-theme-mode', 'dark');
    localStorage.setItem('studiohub-theme-accents', JSON.stringify({ accentCyan: '#111111', accentBlue: '#222222', presetId: 'mine' }));
    answers = { theme: { status: 200, body: { ...lightTheme } }, locale: flow.locales_default as Captured };
    mockFetch(server);
    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
    await flush();
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(cyan()).toBe('#111111');
    expect(blue()).toBe('#222222');
  });

  it('leaves the mode alone for a custom theme, and ignores colours that are not hex', async () => {
    answers = { theme: { status: 200, body: { ...darkTheme, theme_type: 'custom', primary_color: 'red', secondary_color: 'blue' } }, locale: flow.locales_default as Captured };
    mockFetch(server);
    mount();
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('settled'));
    await flush();
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(cyan()).not.toBe('red');
    expect(blue()).not.toBe('blue');
  });

  it('sets the font stack for serif and mono, and none for sans (the application’s own)', async () => {
    answers = { theme: { status: 200, body: { ...darkTheme, font_family: 'serif' } }, locale: flow.locales_default as Captured };
    mockFetch(server);
    mount();
    await waitFor(() => expect(font()).toContain('serif'));
    cleanup();
    answers = { theme: { status: 200, body: { ...darkTheme, font_family: 'sans' } }, locale: flow.locales_default as Captured };
    mockFetch(server);
    mount();
    await waitFor(() => expect(font()).toBe(''));
  });
});
