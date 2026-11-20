import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { TaskDetailPage } from '@/modules/tasks';
import { VersionsListPage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-26 against a REAL backend (C-RP-61): the supervisor reviews two tasks on one shot; their queue
 * (`/versions?to_review=mine`) names each waiting version's task in the Task column, linking to it. The comp task's page
 * lists the comp versions under Versions, and not the lighting one.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { comp: { id: string; code: string }; light: { id: string; code: string }; compVersions: string[]; lightVersion: string };
const T = { timeout: 20000 };
/** A row's title is `<code> · <number>`; anchored, since a code can be another's with a suffix (`…_V001_2`). */
const title = (code: string) => new RegExp(`^${code} · `);

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
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('the task on the Versions list against a live backend (RP-26)', () => {
  beforeAll(async () => {
    await signIn('manager');
    const project = await projectsApi.create({ code: `VT${uid}`, name: 'Live version tasks', workflow_type: 'standard' });
    await apiClient.post(`/api/organizations/projects/${project.id}/members/`, { email: live.users.supervisor.email, role: 'VFX Supervisor' });
    const members = (await projectScopedApi.members(project.id)).results;
    const supervisor = members.find((m) => m.email === live.users.supervisor.email)?.user_id as string;
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ010`, name: 'Opening' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH0010`, sequence_id: sequence.id, name: 'Hero walk' });
    const task = (code: string, name: string) =>
      tasksApi.create({ project: project.id, title: name, code: `${project.code}_SH0010_${code}`, entity_type: 'Shot', entity_id: shot.id, reviewer: supervisor });
    const comp = await task('COMP', 'Comp');
    const light = await task('LIGHT', 'Lighting');
    const version = async (taskId: string) => {
      const made = await versionsApi.create({ project: project.id, task: taskId, department: 'Compositing' });
      await versionsApi.update(made.id, { status: 'Pending Review' });
      return (await versionsApi.get(made.id)).code;
    };
    Object.assign(fixture, {
      comp: { id: comp.id, code: comp.code },
      light: { id: light.id, code: light.code },
      compVersions: [await version(comp.id), await version(comp.id)],
      lightVersion: await version(light.id),
    });
  }, 120000);

  it('the queue names each waiting version’s task, linking to it', async () => {
    await signIn('supervisor');
    mount('/versions?to_review=mine');
    const lightRow = (await screen.findByText(title(fixture.lightVersion), {}, T)).closest('tr') as HTMLElement;
    const link = within(lightRow).getByRole('link', { name: fixture.light.code });
    expect(link.getAttribute('href')).toBe(`/tasks/${fixture.light.id}`);
    expect(link.getAttribute('title')).toBe('Lighting');
    for (const code of fixture.compVersions) {
      const row = screen.getByText(title(code)).closest('tr') as HTMLElement;
      expect(within(row).getByRole('link', { name: fixture.comp.code }).getAttribute('href')).toBe(`/tasks/${fixture.comp.id}`);
    }
  }, 60000);

  it('the task’s page lists its versions, and only its own', async () => {
    await signIn('supervisor');
    mount(`/tasks/${fixture.comp.id}`);
    fireEvent.click(await screen.findByRole('tab', { name: 'Versions' }, T));
    const table = await screen.findByRole('table', { name: 'Versions of this task' }, T);
    for (const code of fixture.compVersions) await within(table).findByText(title(code), {}, T);
    expect(within(table).queryByText(title(fixture.lightVersion))).toBeNull();
    const api = await versionsApi.list({ task_id: fixture.comp.id, page_size: 100 });
    expect(api.results.map((v) => v.code).sort()).toEqual([...fixture.compVersions].sort());
    expect(api.results.every((v) => v.task_code === fixture.comp.code && v.task_title === 'Comp')).toBe(true);
  }, 60000);
});
