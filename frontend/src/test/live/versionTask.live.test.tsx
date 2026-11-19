import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { reviewsApi, versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { rolesApi } from '@/api/identity/rbac';
import type { Role } from '@/api/identity/rbac';
import type { Task } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { VersionWorkspacePage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-21 against a REAL backend: the version page names its task, the task's assignee and its reviewer, read
 * from the task (Q-RP-97 to Q-RP-99). The supervisor, the task's reviewer, sees "You". A client member of the project who
 * takes part in a review holding the version opens the same version page and sees none of the three, and no error: the
 * server answers their task request 404 (the external scope). The client is the MFA-enrolled live user given the Artist
 * role: an external member must use two-factor authentication (TM-007, `MFA_REQUIRE_EXTERNAL`).
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { version: string; task: Task };
const T = { timeout: 20000 };

async function signIn(who: 'manager' | 'supervisor' | 'mfa') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  const secret = { manager: live.manager.secret, mfa: live.mfa.secret, supervisor: null }[who];
  if (secret) {
    if (outcome.status !== 'mfa_required') throw new Error(`expected an MFA challenge for ${who}`);
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(secret) });
  } else if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}

function mount() {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queries}>
      <MemoryRouter initialEntries={[`/versions/${fixture.version}`]}>
        <AuthProvider>
          <Routes>
            <Route path="/versions/:versionId" element={<VersionWorkspacePage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queries;
}
const fact = (label: string) => screen.queryByText(label, { selector: 'dt' })?.nextElementSibling?.textContent ?? null;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('the version page names its task and reviewer against a live backend (RP-21)', () => {
  beforeAll(async () => {
    await signIn('manager');
    const project = await projectsApi.create({ code: `VT${uid}`, name: 'Live version task', workflow_type: 'standard' });
    const add = (email: string, extra: Record<string, string>) => apiClient.post(`/api/organizations/projects/${project.id}/members/`, { email, ...extra });
    await add(live.users.supervisor.email, { role: 'VFX Supervisor' });
    await add(live.users.lead.email, { role: 'Lead Artist' });
    await add(live.users.mfa.email, { role: 'Client', client_id: `client-${uid}` });
    const members = (await projectScopedApi.members(project.id)).results;
    const id = (email: string) => members.find((m) => m.email === email)?.user_id as string;
    const roles = await apiClient.get<{ results: Role[] } | Role[]>('/api/v1/roles/?search=artist');
    const artist = (Array.isArray(roles) ? roles : roles.results).find((r) => r.code === 'artist') as Role;
    await rolesApi.assignUser(artist.id, id(live.users.mfa.email)); // reads versions and tasks, as a client's login would
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ010`, name: 'Opening' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH0010`, sequence_id: sequence.id, name: 'Hero walk' });
    const task = await tasksApi.create({ project: project.id, title: 'Comp', code: `${project.code}_SH0010_COMP`, entity_type: 'Shot', entity_id: shot.id, assignee: id(live.users.lead.email), reviewer: id(live.users.supervisor.email) });
    const version = await versionsApi.create({ project: project.id, task: task.id, department: 'Compositing' });
    const review = await reviewsApi.create({ project: project.id, title: 'Dailies', code: `${project.code}_DAILIES`, entity_type: 'Shot', entity_id: shot.id, entity_code: shot.code });
    await reviewsApi.addVersion(review.id, version.id);
    await reviewsApi.addParticipant(review.id, { user_id: id(live.users.mfa.email), role: 'Client' });
    Object.assign(fixture, { version: version.id, task: await tasksApi.get(task.id) });
    expect(fixture.task.reviewer_id).toBe(id(live.users.supervisor.email));
  }, 120000);

  it('the reviewer sees the task, linked, its assignee, and "You"', async () => {
    await signIn('supervisor');
    mount();
    const link = await screen.findByRole('link', { name: `${fixture.task.code} · ${fixture.task.title}` }, T);
    expect(link.getAttribute('href')).toBe(`/tasks/${fixture.task.id}`);
    expect(fact('Assignee')).toBe(fixture.task.assignee_name);
    expect(fixture.task.assignee_name).not.toBe('');
    await waitFor(() => expect(fact('Reviewer')).toBe('You'), T);
  }, 60000);

  it('a client member sees the version without its task, assignee or reviewer, and no error', async () => {
    await signIn('mfa');
    await expect(tasksApi.get(fixture.task.id)).rejects.toMatchObject({ status: 404 });
    const queries = mount();
    await screen.findByText('Artist', { selector: 'dt' }, T);
    // the page asked for the task and was refused: the facts are hidden for that reason, not because it is still loading
    await waitFor(() => expect(queries.getQueryState(tasksApi.keys.detail(fixture.task.id))?.status).toBe('error'), T);
    for (const label of ['Task', 'Assignee', 'Reviewer']) expect(fact(label)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  }, 60000);
});
