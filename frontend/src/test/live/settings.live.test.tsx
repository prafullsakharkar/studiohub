import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categoriesApi, definitionsApi, featureFlagsApi, systemSettingsApi, tagsApi, themesApi } from '@/api/settings/settings';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { FlagFormPage, FlagsPage, ThemesPage, useFeatureFlag, ValuesPage } from '@/modules/settings';
import { freshTotp, live } from './liveBackend';

/**
 * Phase 11 against a REAL backend, with the roles the studio seeds. A platform administrator (the MFA superuser) locks and unlocks a
 * value from the list and enables a feature flag; a production-admin (settings.view) reads the same screens and
 * is offered no control, and the API refuses their write; an artist (no settings role) still reads the flags, and
 * `useFeatureFlag` turns on for them once the flag is enabled; the flag form refuses a percentage over 100 before
 * anything is sent. Run on a fresh live_backend.py seed.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const lc = uid.toLowerCase();

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const Probe: React.FC<{ code: string }> = ({ code }) => {
  const { enabled, isLoading } = useFeatureFlag(code);
  return <p data-testid="flag">{isLoading ? 'loading' : enabled ? 'on' : 'off'}</p>;
};
const pages = (
  <Routes>
    <Route path="/settings/system/values" element={<ValuesPage />} />
    <Route path="/settings/system/flags" element={<FlagsPage />} />
    <Route path="/settings/system/flags/new" element={<FlagFormPage />} />
    <Route path="/settings/system/themes" element={<ThemesPage />} />
  </Routes>
);

/** A superuser must pass MFA, and the server accepts each code once per 30 s step: sign in once, keep the session. */
let managerTokens: { access: string; refresh: string } | null = null;
async function signIn(who: 'manager' | 'producer' | 'artist') {
  tokenStorage.clearTokens();
  if (who === 'manager') {
    if (managerTokens) {
      tokenStorage.setTokens(managerTokens);
      return;
    }
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    managerTokens = { access: tokenStorage.getAccessToken() as string, refresh: tokenStorage.getRefreshToken() as string };
    return;
  }
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('system settings', () => {
  it('an administrator locks and unlocks a value from the list; a production-admin reads it and can change nothing', async () => {
    await signIn('manager');
    const category = await categoriesApi.create({ code: 'workflow', name: `Pipeline ${uid}` });
    const definition = await definitionsApi.create({ code: `default_fps_${lc}`, name: `Default FPS ${uid}`, category: category.id, data_type: 'integer', default_value: '24', validation_rules: { min: 1, max: 120 } });
    const value = await systemSettingsApi.create({ setting: definition.id, value: '30' });
    await expect(systemSettingsApi.create({ setting: definition.id, value: '31' })).rejects.toMatchObject({ status: 400 }); // one per setting
    await expect(systemSettingsApi.update(value.id, { value: 'forty' })).rejects.toMatchObject({ status: 400, fieldErrors: { value: ['Must be an integer'] } });

    render(tree(pages, '/settings/system/values'));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^Lock default_fps_${lc}`) }, { timeout: 20000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lock' }));
    await waitFor(async () => expect((await systemSettingsApi.get(value.id)).is_locked).toBe(true), { timeout: 20000 });
    // a locked value cannot be edited or removed through the API either
    await expect(systemSettingsApi.update(value.id, { value: '50' })).rejects.toMatchObject({ status: 400 });
    await expect(systemSettingsApi.remove(value.id)).rejects.toMatchObject({ status: 403 });
    expect(await screen.findByRole('button', { name: new RegExp(`^Unlock default_fps_${lc}`) }, { timeout: 20000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(`^Remove default_fps_${lc}`) })).toBeNull();
    cleanup();

    // the production-admin reads the same list: no controls, and the API says no
    await signIn('producer');
    render(tree(pages, '/settings/system/values'));
    await screen.findByText(new RegExp(`default_fps_${lc} ·`), {}, { timeout: 20000 });
    expect(screen.queryByRole('button', { name: /^(Un)?[Ll]ock/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /new setting/i })).toBeNull();
    await expect(systemSettingsApi.unlock(value.id)).rejects.toMatchObject({ status: 403 });
    cleanup();

    await signIn('manager');
    await systemSettingsApi.unlock(value.id);
    expect((await systemSettingsApi.update(value.id, { value: '48' })).value).toBe('48');
    // the listing filters are ignored by the server (CR-26): the screens narrow in the browser
    const all = (await systemSettingsApi.list({})).results.length;
    expect((await systemSettingsApi.list({ is_locked: 'true' })).results.length).toBe(all);
  }, 240000);

  it('a select definition with {value, label} choices accepts a listed value and refuses another with a 400', async () => {
    await signIn('manager');
    const category = await categoriesApi.create({ code: 'review', name: `Review ${uid}` });
    const definition = await definitionsApi.create({ code: `farm_${lc}`, name: `Farm ${uid}`, category: category.id, data_type: 'select', choices: [{ value: 'Deadline', label: 'Deadline' }, { value: 'Tractor', label: 'Tractor' }] });
    await expect(systemSettingsApi.create({ setting: definition.id, value: 'Banana' })).rejects.toMatchObject({ status: 400, fieldErrors: { value: ['Invalid choice: Banana'] } });
    expect((await systemSettingsApi.create({ setting: definition.id, value: 'Tractor' })).value).toBe('Tractor');
  }, 120000);
});

describe('feature flags', () => {
  it('an administrator enables a flag from the list; an artist reads it and the hook turns on; the form refuses a percentage over 100 before sending', async () => {
    await signIn('manager');
    const flag = await featureFlagsApi.create({ code: `new_review_${lc}`, name: `New review ${uid}`, feature_type: 'boolean' });
    expect(flag).toMatchObject({ status: 'disabled' });
    const before = (await featureFlagsApi.list({})).results.length;

    render(tree(pages, '/settings/system/flags'));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^Enable new_review_${lc}`) }, { timeout: 20000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Enable' }));
    await waitFor(async () => expect((await featureFlagsApi.get(flag.id)).status).toBe('enabled'), { timeout: 20000 });
    expect((await featureFlagsApi.get(flag.id)).is_enabled).toBe(false); // the actions move status only (Q-21)
    cleanup();

    // the form: nothing is sent for a percentage the server would have accepted
    render(tree(pages, '/settings/system/flags/new'));
    fireEvent.change(await screen.findByLabelText(/^Code/, {}, { timeout: 20000 }), { target: { value: `bad_pct_${lc}` } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Bad percentage' } });
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: 'percentage' } });
    fireEvent.change(await screen.findByLabelText(/^Percentage/), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /create feature flag/i }));
    expect(await screen.findByText('A percentage is between 0 and 100.')).toBeTruthy();
    expect((await featureFlagsApi.list({})).results.length).toBe(before);
    cleanup();

    // an artist holds no settings code and still reads the flags
    await signIn('artist');
    await expect(systemSettingsApi.list({})).rejects.toMatchObject({ status: 403 });
    expect((await featureFlagsApi.list({})).results.map((f) => f.code)).toContain(`new_review_${lc}`);
    render(tree(<Probe code={`new_review_${lc}`} />, '/'));
    await waitFor(() => expect(screen.getByTestId('flag').textContent).toBe('on'), { timeout: 20000 });
    cleanup();
    render(tree(<Probe code={`never_defined_${lc}`} />, '/'));
    await waitFor(() => expect(screen.getByTestId('flag').textContent).toBe('off'), { timeout: 20000 });
  }, 240000);
});

describe('themes and tags', () => {
  it('activating a theme leaves the others active, from the list; tags have no permission model (CR-28)', async () => {
    await signIn('manager');
    const a = await themesApi.create({ code: `night-${lc}`, name: `Night ${uid}`, theme_type: 'dark' });
    const b = await themesApi.create({ code: `day-${lc}`, name: `Day ${uid}`, theme_type: 'light' });
    await themesApi.activate(a.id);
    await themesApi.deactivate(b.id); // a new theme may start active
    expect((await themesApi.get(b.id)).is_active).toBe(false);
    render(tree(pages, '/settings/system/themes'));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^Activate day-${lc}`) }, { timeout: 20000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Activate' }));
    await waitFor(async () => expect((await themesApi.get(b.id)).is_active).toBe(true), { timeout: 20000 });
    expect((await themesApi.get(a.id)).is_active).toBe(true);
    cleanup();

    // an artist makes and deletes a system tag (the backend finding behind CR-28)
    await signIn('artist');
    await tagsApi.create({ name: `hero-${lc}` } as never);
    const mine = (await tagsApi.list({ search: `hero-${lc}` })).results.find((t) => t.name === `hero-${lc}`);
    expect(mine).toBeTruthy();
    await tagsApi.remove(mine!.id);
    expect((await tagsApi.list({ search: `hero-${lc}` })).results.find((t) => t.name === `hero-${lc}`)).toBeUndefined();
  }, 240000);
});
