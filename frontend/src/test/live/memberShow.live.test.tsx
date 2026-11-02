import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { projectScopedApi, projectsApi, showsApi } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { authService } from '@/modules/auth/services/AuthService';
import { MembersPanel } from '@/modules/production/structure/panels';
import { freshTotp, live, rawPost } from './liveBackend';

/**
 * CR-36 and CR-37 against a REAL backend: a member bound to a show through the members panel sees only that show's records;
 * a status change takes their access away and gives it back; a department is set and cleared; Remove takes them off the project.
 * Run on a fresh live_backend.py seed.
 */
const T = { timeout: 15000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; showA: string; showB: string; shotA: string; shotB: string; shotLoose: string };

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const project = await projectsApi.create({ code: `MS${uid}`, name: 'Member shows', workflow_type: 'standard' });
  const showA = await showsApi.create({ project: project.id, code: `A${uid}`, name: 'Season A' });
  const showB = await showsApi.create({ project: project.id, code: `B${uid}`, name: 'Season B' });
  const shotA = await shotsApi.create({ project: project.id, code: `SA${uid}`, name: 'In A', show_id: showA.id });
  const shotB = await shotsApi.create({ project: project.id, code: `SB${uid}`, name: 'In B', show_id: showB.id });
  const shotLoose = await shotsApi.create({ project: project.id, code: `SL${uid}`, name: 'In no show' });
  Object.assign(fixture, { project: project.id, showA: showA.id, showB: showB.id, shotA: shotA.id, shotB: shotB.id, shotLoose: shotLoose.id });
}, 60000);

/** The artist's membership row; fails clearly when there is none. */
async function artistRow() {
  const row = (await projectScopedApi.members(fixture.project)).results.find((m) => m.email === live.users.artist.email);
  if (!row) throw new Error('the artist is not a member yet');
  return row;
}

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AuthProvider>
          <MembersPanel projectId={fixture.project} />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

/** What the artist gets for the project itself: 200 while they are an active member, 404 when they are not. */
async function artistProjectStatus() {
  const login = await rawPost('/api/v1/auth/login/', { email: live.users.artist.email, password: live.users.artist.password });
  expect(login.status).toBe(200);
  const response = await fetch(`${live.url}/api/v1/projects/${fixture.project}/`, { headers: { Authorization: `Bearer ${login.body.tokens?.access ?? login.body.access}` } });
  return response.status;
}

/** The shots the artist sees: signed in separately, over HTTP, as that user. */
async function shotsSeenByArtist() {
  const login = await rawPost('/api/v1/auth/login/', { email: live.users.artist.email, password: live.users.artist.password });
  expect(login.status).toBe(200);
  const response = await fetch(`${live.url}/api/v1/shots/?project=${fixture.project}&page_size=100`, { headers: { Authorization: `Bearer ${login.body.tokens?.access ?? login.body.access}` } });
  expect(response.status).toBe(200);
  const body = await response.json();
  return new Set<string>((Array.isArray(body) ? body : body.results).map((s: { id: string }) => s.id));
}

describe('member bound to a show, on the wire', () => {
  it('is bound from the panel, sees only that show, and is released again from the panel', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Add a member by email', {}, T), { target: { value: live.users.artist.email } });
    const picker = await screen.findByLabelText('Show', {}, T);
    await waitFor(() => expect(picker.querySelectorAll('option').length).toBe(3), T);
    fireEvent.change(picker, { target: { value: fixture.showA } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(async () => {
      const rows = (await projectScopedApi.members(fixture.project)).results;
      expect(rows.find((m) => m.email === live.users.artist.email)?.show_id).toBe(fixture.showA);
    }, T);
    const row = await artistRow();
    expect(row.scope).toBe('SHOW');
    expect(await shotsSeenByArtist()).toEqual(new Set([fixture.shotA]));

    // Released from the row's own picker: the whole project again, status and roles untouched.
    const select = (await screen.findAllByRole('combobox', { name: /^Show for/ }, T)).find((s) => (s as HTMLSelectElement).value === fixture.showA) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(async () => {
      expect((await artistRow()).show_id).toBeNull();
    }, T);
    const released = await artistRow();
    expect(released.status).toBe(row.status);
    expect(released.roles).toEqual(row.roles);
    expect(await shotsSeenByArtist()).toEqual(new Set([fixture.shotA, fixture.shotB, fixture.shotLoose]));
  });

  it('takes a member off active and back, sets and clears a department, removes them and restores them', async () => {
    await projectScopedApi.addMember(fixture.project, { email: live.users.artist.email, role: 'Artist' });
    mount();
    const rowOf = async () => artistRow();
    const select = async (name: RegExp) => {
      const all = (await screen.findAllByRole('combobox', { name }, T)) as HTMLSelectElement[];
      const index = (await projectScopedApi.members(fixture.project)).results.findIndex((m) => m.email === live.users.artist.email);
      return all[index];
    };
    expect(await artistProjectStatus()).toBe(200);

    // A status other than active: the artist loses the project at once; active again: they get it back.
    fireEvent.change(await select(/^Status for/), { target: { value: 'suspended' } });
    await waitFor(async () => expect((await rowOf()).status).toBe('suspended'), T);
    expect(await artistProjectStatus()).toBe(404);
    fireEvent.change(await select(/^Status for/), { target: { value: 'active' } });
    await waitFor(async () => expect((await rowOf()).status).toBe('active'), T);
    expect(await artistProjectStatus()).toBe(200);

    // A department, by name, left by leaving the field; and cleared.
    const field = async () => {
      const all = (await screen.findAllByRole('textbox', { name: /^Department for/ }, T)) as HTMLInputElement[];
      const index = (await projectScopedApi.members(fixture.project)).results.findIndex((m) => m.email === live.users.artist.email);
      return all[index];
    };
    const input = await field();
    fireEvent.change(input, { target: { value: 'Comp' } });
    fireEvent.blur(input);
    await waitFor(async () => expect((await rowOf()).department).toBe('Comp'), T);
    // The table re-renders the field with the saved value (a new element): act on that one, once it is enabled.
    await waitFor(async () => {
      const saved = await field();
      expect(saved.defaultValue).toBe('Comp');
      expect(saved.disabled).toBe(false);
    }, T);
    const again = await field();
    fireEvent.change(again, { target: { value: '' } });
    fireEvent.blur(again);
    await waitFor(async () => expect((await rowOf()).department).toBe(''), T);

    // Removed from the project, after a confirmation: gone from the list, no access; adding them again restores them.
    const rows = (await projectScopedApi.members(fixture.project)).results;
    const index = rows.findIndex((m) => m.email === live.users.artist.email);
    fireEvent.click((await screen.findAllByRole('button', { name: /^Remove / }, T))[index]);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }, T));
    await waitFor(async () => expect((await projectScopedApi.members(fixture.project)).results.some((m) => m.email === live.users.artist.email)).toBe(false), T);
    expect(await artistProjectStatus()).toBe(404);

    await projectScopedApi.addMember(fixture.project, { email: live.users.artist.email, role: 'Artist' });
    expect((await rowOf()).status).toBe('active');
    expect(await artistProjectStatus()).toBe(200);
  });
});
