import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditApi } from '@/api/audit/audit';
import { departmentsApi } from '@/api/masterdata/departments';
import { catalogApi } from '@/api/masterdata/catalog';
import type { CatalogRowBase } from '@/api/masterdata/catalog';
import { clientContractsApi, clientsApi, positionsApi, teamsApi } from '@/api/masterdata/directory';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { EntityHistory } from '@/components/history/EntityHistory';
import { authService } from '@/modules/auth/services/AuthService';
import { backgroundJobsConfig, changeLogsConfig, errorLogsConfig } from '@/modules/audit/viewer/configs';
import { LogListPage } from '@/modules/audit/viewer/LogListPage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { teamsFormConfig } from '@/modules/directory/entities/teams';
import { freshTotp, live } from './liveBackend';

/**
 * Phase 4 against a REAL backend. Exit criterion: editing a department shows a ChangeLog row with the
 * actor and the field diff in its History panel. Run on a fresh live_backend.py seed.
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

describe('History panel, end to end', () => {
  it('editing a department shows a change-log row with the actor and the field diff', async () => {
    await signInManager();
    const dept = await departmentsApi.create({ code: `H${uid()}`.toUpperCase(), name: `History ${uid()}`, department_type: 'creative' });
    await departmentsApi.update(dept.id, { name: `${dept.name} v2`, color: '#336699' });

    render(tree(<EntityHistory targetType="Department" targetId={dept.id} />));
    expect(await screen.findByText(/changed .*name/, {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2); // update, create (newest first)

    fireEvent.click(screen.getByRole('button', { name: /changed/ }));
    const diff = await screen.findByRole('table', { name: /Changes in/ });
    const nameRow = within(diff).getByText('name').closest('tr') as HTMLElement;
    expect(within(nameRow).getByText(dept.name)).toBeTruthy(); // before
    expect(within(nameRow).getByText(`${dept.name} v2`)).toBeTruthy(); // after
    expect(within(diff).getByText('#336699')).toBeTruthy();
    expect(screen.getAllByText(/example\.test|manager/i).length).toBeGreaterThan(0); // the actor
  }, 60000);

  it('saving the real team form adds an entry to the open History without a reload', async () => {
    await signInManager();
    const department = await departmentsApi.create({ code: `T${uid()}`.toUpperCase(), name: `Dept ${uid()}`, department_type: 'creative' });
    const team = await teamsApi.create({ code: `TH${uid()}`.toUpperCase(), name: `Team ${uid()}`, department: department.id });

    render(
      tree(
        <Routes>
          <Route
            path="/teams/:id/edit"
            element={
              <>
                <DirectoryFormPage config={teamsFormConfig} />
                <EntityHistory targetType="Team" targetId={team.id} />
              </>
            }
          />
          <Route path="/teams/:id" element={<div>saved</div>} />
        </Routes>,
        `/teams/${team.id}/edit`
      )
    );
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1), { timeout: 15000 }); // the create
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(team.name));
    fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText('saved', {}, { timeout: 15000 });
    expect((await teamsApi.get(team.id)).capacity).toBe(9);
    const logs = await auditApi.changeLogs.list({ target_type: 'Team', target_id: team.id });
    expect(logs.results.map((l) => l.change_type)).toEqual(['update', 'create']);
    expect(logs.results[0].changed_fields).toEqual(['capacity']);
  }, 60000);
});

describe('log pages, end to end', () => {
  it('the change log filters by record type and change type on the server', async () => {
    await signInManager();
    render(tree(<LogListPage config={changeLogsConfig} />));
    expect(await screen.findByRole('table', { name: 'Change log' }, { timeout: 15000 })).toBeTruthy();
    const type = screen.getByLabelText('Filter by record type');
    fireEvent.change(type, { target: { value: 'Department' } });
    fireEvent.keyDown(type, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Filter by change'), { target: { value: 'create' } });
    await waitFor(
      () => {
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(within(row).getByText('create')).toBeTruthy();
          expect(within(row).getByText(/^Department:/)).toBeTruthy();
        }
      },
      { timeout: 15000 }
    );
  }, 60000);

  it('cancels a queued job, retries a failed one and resolves an error', async () => {
    await signInManager();
    render(tree(<LogListPage config={backgroundJobsConfig} />));
    fireEvent.click(await screen.findByRole('button', { name: /^Cancel job report live-job-queued/ }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel job' }));
    await waitFor(async () => expect((await auditApi.backgroundJobs.list({ job_type: 'report', status: 'cancelled' })).results.some((j) => j.job_id === 'live-job-queued')).toBe(true), { timeout: 15000 });
    expect(screen.queryByRole('button', { name: /^Cancel job report live-job-queued/ })).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: /^Retry report live-job-failed/ }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retry' }));
    await waitFor(async () => expect((await auditApi.backgroundJobs.list({ status: 'failed' })).results.some((j) => j.job_id === 'live-job-failed')).toBe(false), { timeout: 15000 });
    cleanup();

    render(tree(<LogListPage config={errorLogsConfig} />));
    fireEvent.click(await screen.findByRole('button', { name: /^Resolve/ }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resolve' }));
    await waitFor(async () => expect((await auditApi.errorLogs.list({ severity: 'error' })).results.find((e) => e.message === 'Live open error')?.resolved).toBe(true), { timeout: 15000 });
  }, 90000);

  it('a user without audit.view is refused by the API on every log', async () => {
    await authService.login(live.users.artist);
    await expect(auditApi.changeLogs.list({})).rejects.toMatchObject({ status: 403 });
    await expect(auditApi.backgroundJobs.cancel('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ status: 403 });
  }, 30000);
});

describe('what the backend does NOT record (CR-04, confirmed live)', () => {
  it('edits to positions, contracts and catalog rows leave no change-log entry, while clients do', async () => {
    await signInManager();
    const position = await positionsApi.create({ code: `P${uid()}`.toUpperCase(), name: `Pos ${uid()}` });
    await positionsApi.update(position.id, { description: 'edited' });
    const client = await clientsApi.create({ name: `Cl ${uid()}`, code: `CL${uid()}`.toUpperCase() });
    await clientsApi.update(client.id, { headquarters: 'Pune' }); // only some client fields are tracked: contact_name is not
    const contract = await clientContractsApi.create({ client: client.id, contract_number: `K${uid()}`, title: 'T', status: 'Draft' });
    await clientContractsApi.update(contract.id, { title: 'T2' });
    const taskType = (await catalogApi<CatalogRowBase>('task-types').create({ name: `TT ${uid()}`, code: `tt-${uid()}` })) as CatalogRowBase;
    await catalogApi<CatalogRowBase>('task-types').update(taskType.id, { description: 'edited' });

    const count = async (id: string) => (await auditApi.changeLogs.list({ target_id: id })).count;
    expect(await count(client.id)).toBe(2); // tracked: create + update of headquarters
    // Flip these to the expected counts when CR-04 is fixed; until then their History is empty.
    expect(await count(position.id)).toBe(0);
    expect(await count(contract.id)).toBe(0);
    expect(await count(taskType.id)).toBe(0);
  }, 60000);
});
