import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { catalogApi, softwareVersionsApi } from '@/api/masterdata/catalog';
import type { CatalogRowBase } from '@/api/masterdata/catalog';
import { departmentsApi } from '@/api/masterdata/departments';
import { clientContactsApi, clientContractsApi, clientsApi, peopleApi, teamsApi } from '@/api/masterdata/directory';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { clientsFormConfig } from '@/modules/directory/entities/clients';
import { peopleFormConfig, peopleListConfig } from '@/modules/directory/entities/people';
import { teamsFormConfig, teamsListConfig } from '@/modules/directory/entities/teams';
import { freshTotp, live } from './liveBackend';

/**
 * Phase 3 against a REAL backend: the directory pages and the catalog/contract lifecycle on the wire.
 * Run on a fresh live_backend.py seed, one file at a time.
 */
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
});

const tree = (ui: React.ReactElement, initial = '/') => (
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

describe('directory pages, end to end', () => {
  it('creates a team with a department chosen in the picker, edits one field, then a referenced department refuses deletion with the server’s reason', async () => {
    await signInManager();
    const department = await departmentsApi.create({ code: `D${uid()}`.toUpperCase(), name: `Dept ${uid()}`, department_type: 'creative' });
    const code = `T${uid()}`.toUpperCase();

    // Create through the real form.
    render(
      tree(
        <Routes>
          <Route path="/teams/new" element={<DirectoryFormPage config={teamsFormConfig} />} />
          <Route path="/teams/:id" element={<div>team saved</div>} />
        </Routes>,
        '/teams/new'
      )
    );
    fireEvent.change(await screen.findByLabelText(/^Name/, {}, { timeout: 15000 }), { target: { value: `Team ${code}` } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: code } });
    await screen.findByRole('option', { name: department.name }, { timeout: 15000 });
    fireEvent.change(screen.getByLabelText(/^Department/), { target: { value: department.id } });
    fireEvent.click(screen.getByRole('button', { name: /create team/i }));
    await screen.findByText('team saved', {}, { timeout: 15000 });

    const created = (await teamsApi.list({ search: code })).results[0];
    expect(created.department).toBe(department.id);
    cleanup();

    // The list finds it by server-side search.
    render(tree(<Routes><Route path="/teams" element={<DirectoryListPage config={teamsListConfig} />} /></Routes>, '/teams'));
    fireEvent.change(await screen.findByLabelText('Search teams', {}, { timeout: 15000 }), { target: { value: code } });
    expect(await screen.findByRole('link', { name: `Team ${code}` }, { timeout: 15000 })).toBeTruthy();
    cleanup();

    // Edit sends only the changed field.
    render(
      tree(
        <Routes>
          <Route path="/teams/:id/edit" element={<DirectoryFormPage config={teamsFormConfig} />} />
          <Route path="/teams/:id" element={<div>team saved</div>} />
        </Routes>,
        `/teams/${created.id}/edit`
      )
    );
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(`Team ${code}`), { timeout: 15000 });
    fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText('team saved', {}, { timeout: 15000 });
    expect((await teamsApi.get(created.id)).capacity).toBe(7);

    // A department that a team points at cannot be deleted: 409 with the reason.
    await expect(departmentsApi.remove(department.id)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Still referenced by/i) });
  }, 90000);

  it('a caller without the grants gets no sensitive fields, and cannot see contacts at all', async () => {
    await signInManager();
    const person = await peopleApi.create({ name: `Person ${uid()}`, email: `p${uid()}@example.test` } as never);
    const client = await clientsApi.create({ name: `Client ${uid()}`, code: `C${uid()}`.toUpperCase() });
    tokenStorage.clearTokens();

    await authService.login(live.users.artist);
    const seen = await peopleApi.get(person.id);
    for (const hidden of ['email', 'phone', 'date_of_birth', 'nationality', 'security_clearance']) expect(seen).not.toHaveProperty(hidden);
    await expect(clientContactsApi.list({ client: client.id })).rejects.toMatchObject({ status: 403 }); // Q-01
    await expect(teamsApi.create({ code: 'X', name: 'X', department: 'x' } as never)).rejects.toMatchObject({ status: 403 });
  }, 60000);

  it('the people form shows the sensitive fields to a superuser and the list deactivates then reactivates through the action routes', async () => {
    await signInManager();
    const person = await peopleApi.create({ name: `Lifecycle ${uid()}` });

    render(tree(<Routes><Route path="/people/new" element={<DirectoryFormPage config={peopleFormConfig} />} /></Routes>, '/people/new'));
    expect(await screen.findByLabelText('Security clearance', {}, { timeout: 15000 })).toBeTruthy();
    cleanup();

    render(tree(<Routes><Route path="/people" element={<DirectoryListPage config={peopleListConfig} />} /></Routes>, '/people'));
    fireEvent.change(await screen.findByLabelText('Search people', {}, { timeout: 15000 }), { target: { value: person.name } });
    fireEvent.click(await screen.findByRole('button', { name: `Deactivate ${person.full_name}` }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(async () => expect((await peopleApi.get(person.id)).status).toBe('inactive'), { timeout: 15000 });

    fireEvent.click(await screen.findByRole('button', { name: `Reactivate ${person.full_name}` }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reactivate' }));
    await waitFor(async () => expect((await peopleApi.get(person.id)).status).toBe('active'), { timeout: 15000 });
  }, 90000);
});

describe('contract lifecycle on the wire', () => {
  it('Draft → Active → end date corrected → Terminated; status cannot be written directly', async () => {
    await signInManager();
    const client = await clientsApi.create({ name: `Acme ${uid()}`, code: `AC${uid()}`.toUpperCase() });
    const contract = await clientContractsApi.create({ client: client.id, contract_number: `K${uid()}`, title: 'Framework', type: 'SOW', status: 'Draft', effective_date: '2030-01-01', expiry_date: '2030-12-31' });
    expect(contract.status).toBe('Draft');

    await expect(clientContractsApi.update(contract.id, { status: 'Active' } as never)).rejects.toMatchObject({ status: 400, fieldErrors: { status: [expect.stringMatching(/activate/)] } });

    const active = await clientContractsApi.act(contract.id, 'activate');
    expect(active.status).toBe('Active');

    const adjusted = await clientContractsApi.act(contract.id, 'adjust-end-date', { expiry_date: '2031-06-30' });
    expect(adjusted.expiry_date).toBe('2031-06-30');

    const terminated = await clientContractsApi.act(contract.id, 'terminate');
    expect(terminated.status).toBe('Terminated');
    // A terminated contract is read-only except for the end date.
    await expect(clientContractsApi.update(contract.id, { title: 'Changed' })).rejects.toMatchObject({ status: 409 });
  }, 60000);
});

describe('catalog on the wire', () => {
  it('slash-less routes: create → archive (status, not is_archived) → restore → reorder → delete; software versions', async () => {
    await signInManager();
    const types = catalogApi<CatalogRowBase>('task-types');
    const a = (await types.create({ name: `Alpha ${uid()}`, code: `a-${uid()}` })) as CatalogRowBase;
    const b = (await types.create({ name: `Beta ${uid()}`, code: `b-${uid()}` })) as CatalogRowBase;
    expect(a.status).toBe('active');
    expect(a).not.toHaveProperty('is_archived');

    expect(((await types.archive(a.id)) as CatalogRowBase).status).toBe('archived');
    expect((await types.list({ status: 'archived' })).map((r) => r.id)).toContain(a.id);
    expect((await types.list({ status: 'active' })).map((r) => r.id)).not.toContain(a.id);
    expect(((await types.restore(a.id)) as CatalogRowBase).status).toBe('active');

    await types.reorder([b.id, a.id]);
    const order = (await types.list({ status: 'active' })).map((r) => r.id);
    expect(order.indexOf(b.id)).toBeLessThan(order.indexOf(a.id));

    await types.remove(a.id);
    await types.remove(b.id);
    expect((await types.list({ status: 'active' })).map((r) => r.id)).not.toContain(a.id);

    const software = (await catalogApi<CatalogRowBase>('software').create({ name: `Soft ${uid()}`, code: `s-${uid()}` })) as CatalogRowBase;
    const versions = softwareVersionsApi(software.id);
    const created = await versions.create({ version: '1.0', version_code: '1.0' });
    expect((await versions.list()).map((v) => v.id)).toContain(created.id);

    // A trailing slash is a 404 on these routes (the reason ApiClient leaves them alone).
    const withSlash = await fetch(`${live.url}/api/v1/platform/master-data/task-types/`, { headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}` } });
    expect(withSlash.status).toBe(404);
  }, 90000);

  it('system rows (seeded statuses) cannot be deleted', async () => {
    await signInManager();
    const statuses = catalogApi<CatalogRowBase>('statuses');
    const system = (await statuses.list({ status: 'active' })).find((s) => s.is_system);
    expect(system).toBeTruthy();
    await expect(statuses.remove((system as CatalogRowBase).id)).rejects.toMatchObject({ status: 409 });
  }, 60000);
});
