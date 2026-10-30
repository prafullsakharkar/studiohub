import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { categoryFormConfig, definitionFormConfig, flagFormConfig, localizationFormConfig, tagFormConfig, themeFormConfig, useCategoriesListConfig, useFlagsListConfig, useThemesListConfig, useValuesListConfig, valueFormConfig } from '../records';
import { SystemNav } from '../SystemNav';
import { useFeatureFlag } from '../useFeatureFlag';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('settings/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
/** The production-admin: reads the system settings, changes none. */
const reader = withCodes('settings.view');
/** The platform administrator. */
const admin = withCodes('settings.view', 'settings.manage');

const rows = (key: string): any[] => flow[key].body.items ?? flow[key].body;
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const bare = (list: any[]): MockReply => ({ status: 200, body: list });
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => new URL(c.url).searchParams;
const writes = (calls: MockCall[]) => calls.filter((c) => c.method !== 'GET');
const empty = { status: 200, body: { count: 0, next: null, previous: null, results: [] } };

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('system settings (values)', () => {
  const List = () => <DirectoryListPage config={useValuesListConfig()} />;
  const route = <Route path="/v" element={<List />} />;
  const locked = () => ({ ...rows('values_list')[0], id: 'v-locked', setting_code: 'locked_one', setting_name: 'Locked one', is_locked: true, locked_at: '2026-10-30T12:00:00Z' });
  const open = () => ({ ...rows('values_list')[0], id: 'v-open', setting_code: 'open_one', setting_name: 'Open one', is_locked: false, locked_at: null });

  it('a locked value offers Unlock only; an unlocked one Lock, Edit and Remove; a reader gets no controls', async () => {
    mockFetch(() => bare([locked(), open()]));
    renderAt('/v', admin, route);
    await screen.findByText(/locked_one · Locked one/);
    expect(screen.getByRole('button', { name: /^Unlock locked_one/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Lock locked_one/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove locked_one/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Edit locked_one/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Lock open_one/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Remove open_one/ })).toBeTruthy();
    cleanup();
    mockFetch(() => bare([locked(), open()]));
    renderAt('/v', reader, route);
    await screen.findByText(/locked_one · Locked one/);
    expect(screen.queryByRole('button', { name: /^(Un)?[Ll]ock/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /new setting/i })).toBeNull();
  });

  it('locking posts to the lock route', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.values_lock) : bare([open()])));
    renderAt('/v', admin, route);
    fireEvent.click(await screen.findByRole('button', { name: /^Lock open_one/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lock' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe('/api/v1/settings/system-settings/v-open/lock/');
  });

  it('narrows in the browser by lock and by search, and sends neither (the server ignores them, CR-26)', async () => {
    const { calls } = mockFetch(() => bare([locked(), open()]));
    renderAt('/v', admin, route);
    await screen.findByText(/open_one · Open one/);
    fireEvent.change(screen.getByLabelText('Filter by lock'), { target: { value: 'true' } });
    await waitFor(() => expect(screen.queryByText(/open_one · Open one/)).toBeNull());
    expect(screen.getByText(/locked_one · Locked one/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter by lock'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Search system settings'), { target: { value: 'open_one' } });
    await waitFor(() => expect(screen.queryByText(/locked_one · Locked one/)).toBeNull());
    expect(calls.some((c) => params(c).has('is_locked') || params(c).has('search'))).toBe(false);
  });

  it('the form takes a setting and a value, posts both, and shows the definition’s own refusal', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.values_create_bad_integer) : empty));
    renderAt('/settings/system/values/new?setting=d-1', admin, <Route path="/settings/system/values/new" element={<DirectoryFormPage config={valueFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Value/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /create setting/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ setting: 'd-1', value: 'x' });
    expect(await screen.findByText(/Must be at least 2 characters/)).toBeTruthy();
  });
});

describe('feature flags', () => {
  const List = () => <DirectoryListPage config={useFlagsListConfig()} />;
  const route = <Route path="/f" element={<List />} />;
  const flag = (over: Record<string, unknown>) => ({ ...flow.flags_detail_scheduled.body, ...over });

  it('offers the actions the status allows; Schedule only for a flag that has a window', async () => {
    mockFetch(() => bare([flag({ id: 'f-on', code: 'is_on', status: 'enabled', start_date: null, end_date: null }), flag({ id: 'f-off', code: 'is_off', status: 'disabled' }), flag({ id: 'f-bare', code: 'is_bare', status: 'disabled', start_date: null, end_date: null })]));
    renderAt('/f', admin, route);
    await screen.findByText(/is_on ·/);
    expect(screen.getByRole('button', { name: /^Disable is_on/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Enable is_on/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Enable is_off/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Schedule is_off/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Schedule is_bare/ })).toBeNull();
    cleanup();
    mockFetch(() => bare([flag({ id: 'f-off', code: 'is_off', status: 'disabled' })]));
    renderAt('/f', reader, route);
    await screen.findByText(/is_off ·/);
    expect(screen.queryByRole('button', { name: /^Enable/ })).toBeNull();
  });

  it('Schedule posts the window stored on the flag', async () => {
    const f = flag({ id: 'f-off', code: 'is_off', status: 'disabled' });
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.flags_schedule) : bare([f])));
    renderAt('/f', admin, route);
    fireEvent.click(await screen.findByRole('button', { name: /^Schedule is_off/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe('/api/v1/settings/feature-flags/f-off/schedule/');
    expect(writes(calls)[0].body).toEqual({ start_date: f.start_date, end_date: f.end_date });
  });

  it('the form refuses a percentage over 100 and a window that ends before it starts, which the server would accept (CR-29)', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.flags_create) : empty));
    renderAt('/settings/system/flags/new', admin, <Route path="/settings/system/flags/new" element={<DirectoryFormPage config={flagFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Code/), { target: { value: 'fast_search' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Fast search' } });
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: 'percentage' } });
    fireEvent.change(await screen.findByLabelText(/^Percentage/), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /create feature flag/i }));
    expect(await screen.findByText('A percentage is between 0 and 100.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Percentage/), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: '2027-01-10T00:00' } });
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: '2027-01-01T00:00' } });
    fireEvent.click(screen.getByRole('button', { name: /create feature flag/i }));
    expect(await screen.findByText('The end must be after the start.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: '2027-01-31T00:00' } });
    fireEvent.click(screen.getByRole('button', { name: /create feature flag/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    const body = writes(calls)[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ code: 'fast_search', feature_type: 'percentage', percentage: 25 });
    expect(String(body.start_date)).toMatch(/Z$/);
  });
});

describe('editing a flag', () => {
  it('refuses a percentage over 100 on an existing flag too, and sends only what changed when it is fine', async () => {
    const f = { ...flow.flags_create_percentage.body };
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? { status: 200, body: f } : { status: 200, body: f }));
    renderAt(`/settings/system/flags/${f.id}/edit`, admin, <Route path="/settings/system/flags/:id/edit" element={<DirectoryFormPage config={flagFormConfig} />} />);
    const percentage = await screen.findByLabelText(/^Percentage/);
    await waitFor(() => expect((percentage as HTMLInputElement).value).toBe(String(f.percentage)));
    expect(screen.queryByLabelText(/^Code/)).toBeNull(); // the app asks for a flag by its code
    fireEvent.change(percentage, { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('A percentage is between 0 and 100.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(percentage, { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].method).toBe('PATCH');
    expect(writes(calls)[0].body).toEqual({ percentage: 40 });
  });
});

describe('useFeatureFlag', () => {
  const Probe: React.FC<{ code: string }> = ({ code }) => {
    const { enabled, isLoading } = useFeatureFlag(code);
    return <p>{isLoading ? 'loading' : enabled ? 'on' : 'off'}</p>;
  };
  const withFlags = (list: any[]) => mockFetch(() => bare(list));

  it('is on for an enabled flag, off for a disabled, a scheduled-outside-its-window and an unknown one; any signed-in user may ask', async () => {
    const base = flow.flags_detail_enabled.body;
    withFlags([{ ...base, code: 'on_one', status: 'enabled' }, { ...base, code: 'off_one', status: 'disabled' }, { ...flow.flags_detail_scheduled.body, code: 'later_one' }]);
    for (const [code, expected] of [['on_one', 'on'], ['off_one', 'off'], ['later_one', 'off'], ['nobody_defined_this', 'off']] as const) {
      renderAt('/p', artist, <Route path="/p" element={<Probe code={code} />} />); // an artist holds no settings code
      expect(await screen.findByText(expected)).toBeTruthy();
      cleanup();
    }
  });

  it('asks nothing before there is a signed-in user, and the flag is off', () => {
    const { calls } = withFlags([{ ...flow.flags_detail_enabled.body, code: 'on_one', status: 'enabled' }]);
    renderAt('/p', null as unknown as User, <Route path="/p" element={<Probe code="on_one" />} />);
    expect(screen.getByText('off')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('asks the flags route once and shares the answer', async () => {
    const { calls } = withFlags([{ ...flow.flags_detail_enabled.body, code: 'on_one', status: 'enabled' }]);
    const Two = () => (
      <>
        <Probe code="on_one" />
        <Probe code="on_one" />
      </>
    );
    renderAt('/p', artist, <Route path="/p" element={<Two />} />);
    await waitFor(() => expect(screen.getAllByText('on')).toHaveLength(2));
    expect(calls.filter((c) => path(c) === '/api/v1/settings/feature-flags/')).toHaveLength(1);
  });
});

describe('definitions', () => {
  const Form = () => <DirectoryFormPage config={definitionFormConfig} />;
  const fill = async (type: string, choices?: string) => {
    fireEvent.change(await screen.findByLabelText(/^Code/), { target: { value: 'farm_engine' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Farm engine' } });
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: type } });
    if (choices !== undefined) fireEvent.change(await screen.findByLabelText(/^Choices/), { target: { value: choices } });
  };

  it('a select needs {value, label} objects: plain strings are refused here because the server would accept them and then fail with a 500 (CR-27)', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.definitions_create_select) : { status: 200, body: { count: 1, next: null, previous: null, results: [{ id: 'c-1', code: 'workflow', name: 'Pipeline' }] } }));
    renderAt('/settings/system/definitions/new', admin, <Route path="/settings/system/definitions/new" element={<Form />} />);
    await fill('select', '["Deadline", "Tractor"]');
    fireEvent.change(await screen.findByLabelText(/^Category/), { target: { value: 'c-1' } });
    fireEvent.click(screen.getByRole('button', { name: /create setting definition/i }));
    expect(await screen.findByText(/not a plain string/)).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Choices/), { target: { value: '[{"value": "Deadline", "label": "Deadline"}]' } });
    fireEvent.click(screen.getByRole('button', { name: /create setting definition/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ data_type: 'select', choices: [{ value: 'Deadline', label: 'Deadline' }], category: 'c-1' });
  });

  it('editing never offers the code, and the choices field exists only for a select type', async () => {
    const def = flow.definitions_detail.body;
    mockFetch(() => ({ status: 200, body: def }));
    renderAt(`/settings/system/definitions/${def.id}/edit`, admin, <Route path="/settings/system/definitions/:id/edit" element={<Form />} />);
    const name = await screen.findByLabelText(/^Name/);
    await waitFor(() => expect((name as HTMLInputElement).value).toBe(def.name));
    expect(screen.queryByLabelText(/^Code/)).toBeNull(); // other tools read a setting by its code
    expect(screen.queryByLabelText(/^Choices/)).toBeNull(); // an integer
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: 'select' } });
    expect(await screen.findByLabelText(/^Choices/)).toBeTruthy();
  });
});

describe('categories, themes, localizations, tags', () => {
  it('a category code is one of the 14 fixed words', async () => {
    mockFetch(() => empty);
    renderAt('/c', admin, <Route path="/c" element={<DirectoryFormPage config={categoryFormConfig} />} />);
    const select = (await screen.findByLabelText(/^Code/)) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value).filter(Boolean)).toHaveLength(14);
  });

  it('a category is archived or restored by its state', async () => {
    const [active] = rows('categories_list');
    const inactive = { ...active, id: 'c-off', code: 'media', name: 'Media off', is_active: false };
    mockFetch(() => bare([active, inactive]));
    const List = () => <DirectoryListPage config={useCategoriesListConfig()} />;
    renderAt('/c', admin, <Route path="/c" element={<List />} />);
    await screen.findByText(new RegExp(`${active.code} · ${active.name}`));
    expect(screen.getByRole('button', { name: new RegExp(`^Archive ${active.code}`) })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Restore media/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Archive media/ })).toBeNull();
  });

  it('themes: Activate for an inactive one, Deactivate for an active one, and a hint that others stay active', async () => {
    const [theme] = rows('themes_list');
    mockFetch(() => bare([{ ...theme, id: 't-on', code: 'on', name: 'On theme', is_active: true }, { ...theme, id: 't-off', code: 'off', name: 'Off theme', is_active: false }]));
    const List = () => <DirectoryListPage config={useThemesListConfig()} />;
    renderAt('/t', admin, <Route path="/t" element={<List />} />);
    await screen.findByText(/on · On theme/);
    expect(screen.getByRole('button', { name: /^Deactivate on/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Activate off/ })).toBeTruthy();
    expect(screen.getByText(/several can be active at once/)).toBeTruthy();
  });

  it('a theme colour must be a hex colour (the server only checks its length, CR-29)', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.themes_create) : empty));
    renderAt('/settings/system/themes/new', admin, <Route path="/settings/system/themes/new" element={<DirectoryFormPage config={themeFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Code/), { target: { value: 'night' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Night' } });
    fireEvent.change(screen.getByLabelText(/^Primary colour/), { target: { value: 'red' } });
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }));
    expect(await screen.findByText('Primary colour must be a hex colour such as #06b6d4.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Primary colour/), { target: { value: '#06b6d4' } });
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ code: 'night', primary_color: '#06b6d4' });
  });

  it('a localization’s week start goes as a number', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.locales_create) : empty));
    renderAt('/settings/system/localizations/new', admin, <Route path="/settings/system/localizations/new" element={<DirectoryFormPage config={localizationFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Code/), { target: { value: 'en-us' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'English (US)' } });
    fireEvent.change(screen.getByLabelText(/^Week starts on/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /create localization/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect((writes(calls)[0].body as { week_start: unknown }).week_start).toBe(0);
  });

  it('a tag create answers without an id, so the screen finds the tag by name to go on (CR-28), and refuses a colour that is not hex', async () => {
    const created = flow.tags_create_artist.body;
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: created } : { status: 200, body: { count: 1, next: null, previous: null, results: [{ ...flow.tags_detail.body, name: created.name }] } }));
    renderAt('/settings/system/tags/new', admin, <Route path="/settings/system/tags/new" element={<DirectoryFormPage config={tagFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: created.name } });
    fireEvent.change(screen.getByLabelText(/^Colour/), { target: { value: 'red' } });
    fireEvent.click(screen.getByRole('button', { name: /create tag/i }));
    expect(await screen.findByText('The colour must be a hex colour such as #f59e0b.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Colour/), { target: { value: '#f59e0b' } });
    fireEvent.click(screen.getByRole('button', { name: /create tag/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && path(c) === '/api/v1/core/tags/' && params(c).get('search') === created.name)).toBe(true));
  });
});

describe('the section navigation', () => {
  it('lists the seven sections to a reader and says changes need an administrator; an administrator is not told so; someone without settings.view sees nothing', () => {
    const Nav = () => <SystemNav />;
    renderAt('/x', reader, <Route path="/x" element={<Nav />} />);
    expect(within(screen.getByRole('navigation', { name: 'System settings sections' })).getAllByRole('link')).toHaveLength(7);
    expect(screen.getByText(/changing them needs an administrator/)).toBeTruthy();
    cleanup();
    renderAt('/x', admin, <Route path="/x" element={<Nav />} />);
    expect(screen.queryByText(/changing them needs an administrator/)).toBeNull();
    cleanup();
    renderAt('/x', artist, <Route path="/x" element={<Nav />} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

void useQuery;
