import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { departmentsApi } from '@/api/masterdata/departments';
import { peopleApi, teamMembershipsApi, teamsApi } from '@/api/masterdata/directory';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { PersonWorkspacePage } from '@/modules/people/pages/PersonWorkspacePage';
import { freshTotp, live } from './liveBackend';

/** The rebuilt person workspace against a REAL backend. Run on a fresh live_backend.py seed, one file at a time. */
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
});

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function signInManager() {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
}

const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const T = { timeout: 15000 };

describe('person workspace on the wire', () => {
  it('adds a skill, joins two teams and chooses one as primary, and deactivates then reactivates the person', async () => {
    await signInManager();
    const tag = uid();
    const department = await departmentsApi.create({ code: `D${tag}`.toUpperCase(), name: `Dept ${tag}`, department_type: 'creative' });
    const team = await teamsApi.create({ code: `T${tag}`.toUpperCase(), name: `Team ${tag}`, department: department.id });
    const second = await teamsApi.create({ code: `V${tag}`.toUpperCase(), name: `Second ${tag}`, department: department.id });
    const person = await peopleApi.create({ name: `Artist ${tag}` });

    render(tree(<Routes><Route path="/people/:id" element={<PersonWorkspacePage />} /></Routes>, `/people/${person.id}`));
    expect(await screen.findByRole('heading', { name: person.full_name }, T)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));
    fireEvent.change(await screen.findByLabelText('New skill'), { target: { value: 'Houdini' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
    await waitFor(async () => expect((await peopleApi.get(person.id)).skills).toEqual(['Houdini']), T);

    fireEvent.click(screen.getByRole('tab', { name: 'Teams' }));
    fireEvent.click(await screen.findByRole('button', { name: `Join ${team.name}` }, T));
    await waitFor(async () => expect((await teamMembershipsApi.list({ person: person.id })).results.map((m) => m.team)).toEqual([team.id]), T);
    fireEvent.click(await screen.findByRole('button', { name: `Join ${second.name}` }, T));
    await waitFor(async () => expect((await teamMembershipsApi.list({ person: person.id })).count).toBe(2), T);
    expect((await peopleApi.get(person.id)).team).toBeNull(); // joining chooses no primary team

    fireEvent.click(await screen.findByRole('button', { name: `Make ${team.name} primary` }, T));
    await waitFor(async () => expect((await peopleApi.get(person.id)).team).toBe(team.id), T);
    expect((await peopleApi.get(person.id)).team_name).toBe(team.name);

    fireEvent.click(await screen.findByRole('button', { name: `Leave ${team.name}` }, T));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }));
    await waitFor(async () => expect((await peopleApi.get(person.id)).team).toBeNull(), T); // leaving the primary team clears it
    expect((await teamMembershipsApi.list({ person: person.id })).results.map((m) => m.team)).toEqual([second.id]);

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(async () => expect((await peopleApi.get(person.id)).status).toBe('inactive'), T);
    fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }, T));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reactivate' }));
    await waitFor(async () => expect((await peopleApi.get(person.id)).status).toBe('active'), T);
  });
});
