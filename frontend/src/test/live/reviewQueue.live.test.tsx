import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { VersionsListPage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-24 against a REAL backend (C-RP-58): the supervisor opens `/versions?to_review=mine`, the link the
 * "copy to review" notices give, and the list shows the version waiting on the task they review, not the one waiting on a
 * colleague's task, nor their own task's version in another status. Clearing the filter shows them all again.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { mine: string; theirs: string; retake: string };
const T = { timeout: 20000 };
/** A row's title is `<code> · <number>`; anchored, since a code can be another's with a suffix (`…_V001_2`). */
const row = (code: string) => new RegExp(`^${code} · `);

async function signIn(who: 'manager' | 'supervisor') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (who === 'manager') {
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  } else if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}

function mount(at: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <AuthProvider>
          <Routes>
            <Route path="/versions" element={<VersionsListPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('waiting for my review against a live backend (RP-24)', () => {
  beforeAll(async () => {
    await signIn('manager');
    const project = await projectsApi.create({ code: `RQ${uid}`, name: 'Live review queue', workflow_type: 'standard' });
    const add = (email: string, role: string) => apiClient.post(`/api/organizations/projects/${project.id}/members/`, { email, role });
    await add(live.users.supervisor.email, 'VFX Supervisor');
    await add(live.users.lead.email, 'Lead Artist');
    const members = (await projectScopedApi.members(project.id)).results;
    const id = (email: string) => members.find((m) => m.email === email)?.user_id as string;
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ010`, name: 'Opening' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH0010`, sequence_id: sequence.id, name: 'Hero walk' });
    const task = (code: string, reviewer: string) =>
      tasksApi.create({ project: project.id, title: code, code: `${project.code}_SH0010_${code}`, entity_type: 'Shot', entity_id: shot.id, reviewer: id(reviewer) });
    const comp = await task('COMP', live.users.supervisor.email);
    const roto = await task('ROTO', live.users.lead.email);
    const version = async (taskId: string, status: string) => {
      const made = await versionsApi.create({ project: project.id, task: taskId, department: 'Compositing' });
      await versionsApi.update(made.id, { status });
      return (await versionsApi.get(made.id)).code;
    };
    Object.assign(fixture, {
      retake: await version(comp.id, 'Retake'),
      mine: await version(comp.id, 'Pending Review'),
      theirs: await version(roto.id, 'Pending Review'),
    });
  }, 120000);

  it('the notices’ link opens the list filtered to what waits for me; All shows the rest again', async () => {
    await signIn('supervisor');
    mount('/versions?to_review=mine');
    await screen.findByText(row(fixture.mine), {}, T);
    expect((screen.getByLabelText('Filter by to review') as HTMLSelectElement).value).toBe('mine');
    expect(screen.queryByText(row(fixture.theirs))).toBeNull();
    expect(screen.queryByText(row(fixture.retake))).toBeNull();
    fireEvent.change(screen.getByLabelText('Filter by to review'), { target: { value: '' } });
    await screen.findByText(row(fixture.theirs), {}, T);
    await waitFor(() => expect(screen.getByText(row(fixture.retake))).toBeTruthy(), T);
  }, 60000);

  it('a colleague’s version waits for them, not for me', async () => {
    await signIn('supervisor');
    const mine = await versionsApi.list({ to_review: 'mine', page_size: 100 });
    const codes = mine.results.map((v) => v.code);
    expect(codes).toContain(fixture.mine);
    expect(codes).not.toContain(fixture.theirs);
    expect(mine.results.every((v) => v.status === 'Pending Review')).toBe(true);
  }, 60000);
});
