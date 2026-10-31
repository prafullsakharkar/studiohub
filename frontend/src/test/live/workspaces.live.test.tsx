import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { departmentsApi } from '@/api/masterdata/departments';
import { clientsApi, officesApi, peopleApi, teamsApi } from '@/api/masterdata/directory';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { ClientWorkspacePage } from '@/modules/clients/pages/ClientWorkspacePage';
import { EditDepartmentPage } from '@/modules/departments/pages/EditDepartmentPage';
import { OfficeWorkspacePage } from '@/modules/offices/pages/OfficeWorkspacePage';
import { authService } from '@/modules/auth/services/AuthService';
import { TeamWorkspacePage } from '@/modules/teams/pages/TeamWorkspacePage';
import { freshTotp, live } from './liveBackend';

/**
 * The rebuilt workspace pages against a REAL backend: what they show and what their actions do on the wire.
 * Run on a fresh live_backend.py seed, one file at a time.
 */
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

describe('client workspace on the wire', () => {
  it('archives, restores and then really deletes a client', async () => {
    await signInManager();
    const tag = uid();
    const client = await clientsApi.create({ name: `Client ${tag}`, code: `C${tag}`.toUpperCase().slice(0, 20), studio_type: 'Major Studio', status: 'Active' });

    render(
      tree(
        <Routes>
          <Route path="/clients/:id" element={<ClientWorkspacePage />} />
          <Route path="/clients" element={<div>directory</div>} />
        </Routes>,
        `/clients/${client.id}`
      )
    );
    expect(await screen.findByRole('heading', { name: client.name }, T)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(async () => expect((await clientsApi.get(client.id)).status).toBe('Archived'), T);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }, T));
    await waitFor(async () => expect((await clientsApi.get(client.id)).status).toBe('Active'), T);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('directory', {}, T)).toBeTruthy();
    await expect(clientsApi.get(client.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('team membership on the wire', () => {
  it('adds a person to a team, then removes them, through the person’s team field', async () => {
    await signInManager();
    const tag = uid();
    const department = await departmentsApi.create({ code: `D${tag}`.toUpperCase(), name: `Dept ${tag}`, department_type: 'creative' });
    const team = await teamsApi.create({ code: `T${tag}`.toUpperCase(), name: `Team ${tag}`, department: department.id });
    const person = await peopleApi.create({ name: `Member ${tag}` });
    expect(person.team).toBeNull();

    render(tree(<Routes><Route path="/teams/:id" element={<TeamWorkspacePage />} /></Routes>, `/teams/${team.id}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Members' }, T));
    fireEvent.click(await screen.findByRole('button', { name: 'Add member' }, T));
    await screen.findByRole('option', { name: person.full_name }, T);
    fireEvent.change(screen.getByLabelText(/^Person/), { target: { value: person.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }));

    await waitFor(async () => expect((await peopleApi.get(person.id)).team).toBe(team.id), T);
    expect((await peopleApi.get(person.id)).team_name).toBe(team.name);
    expect((await peopleApi.list({ team: team.id })).results.map((p) => p.id)).toEqual([person.id]);
    fireEvent.click(await screen.findByRole('button', { name: `Remove ${person.full_name} from ${team.name}` }, T));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(async () => expect((await peopleApi.get(person.id)).team).toBeNull(), T);
  });
});

describe('office and department pages on the wire', () => {
  it('shows the office headcount the API computes, and saves a department edit', async () => {
    await signInManager();
    const tag = uid();
    const office = await officesApi.create({ code: `O${tag}`.toUpperCase(), name: `Office ${tag}`, office_type: 'studio', timezone: 'UTC', country: 'US', city: 'Austin' } as never);
    await peopleApi.create({ name: `Desk ${tag}`, office: office.id });

    render(tree(<Routes><Route path="/offices/:id" element={<OfficeWorkspacePage />} /></Routes>, `/offices/${office.id}`));
    expect(await screen.findByRole('heading', { name: office.name }, T)).toBeTruthy();
    const headcount = within(screen.getByRole('region', { name: 'Office' })).getByText('Headcount').parentElement as HTMLElement;
    await waitFor(() => expect(headcount.textContent).toContain('1'), T);
    cleanup();

    const department = await departmentsApi.create({ code: `D${tag}`.toUpperCase(), name: `Dept ${tag}`, department_type: 'creative' });
    render(tree(<Routes><Route path="/departments/:id/edit" element={<EditDepartmentPage />} /><Route path="/departments/:id" element={<div>saved</div>} /></Routes>, `/departments/${department.id}/edit`));
    const name = (await screen.findByLabelText(/^Name/, {}, T)) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe(department.name));
    fireEvent.change(name, { target: { value: `${department.name} renamed` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('saved', {}, T);
    expect((await departmentsApi.get(department.id)).name).toBe(`${department.name} renamed`);
  });
});
