import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { projectScopedApi, projectsApi } from '@/api/production/structure';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { authService } from '@/modules/auth/services/AuthService';
import { MembersPanel } from '@/modules/production/structure/panels';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { freshTotp, live } from './liveBackend';

/**
 * CR-38 and the members panel against a REAL backend: a person who is already on the project, suspended, is not added again from
 * the panel; the panel says so and gives their status, and the server leaves them suspended with the role they had.
 * Run on a fresh live_backend.py seed.
 */
const T = { timeout: 15000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; member: string };

beforeEach(() => {
  localStorage.clear();
  useNotificationStore.setState({ notifications: [] } as never);
});
afterEach(() => cleanup());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const project = await projectsApi.create({ code: `RA${uid}`, name: 'Member re-add', workflow_type: 'standard' });
  const added = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Lead' });
  await projectScopedApi.updateMember(project.id, added.id, { status: 'suspended' });
  Object.assign(fixture, { project: project.id, member: added.id });
}, 60000);

const row = async () => (await projectScopedApi.members(fixture.project)).results.find((m) => m.id === fixture.member);

describe('adding someone who is already a suspended member', () => {
  it('is refused by the panel with their status, and the server leaves them as they were', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AuthProvider>
            <MembersPanel projectId={fixture.project} />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    // The list has to be on screen before the panel can know who is on the project.
    await screen.findByRole('table', { name: 'Project members' }, T);
    await waitFor(() => expect(screen.getAllByText(live.users.artist.email).length).toBeGreaterThan(0), T);
    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: live.users.artist.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(useNotificationStore.getState().notifications.map((n) => n.message).join(' ')).toContain('already on this project (suspended)'), T);
    expect(await row()).toMatchObject({ status: 'suspended', role: 'Lead' });
  });

  it('and an add that names only the person (the API, CR-38) changes nothing either', async () => {
    // What the panel will not send, an API client can: no role, no status.
    await projectScopedApi.addMember(fixture.project, { email: live.users.artist.email } as never);
    expect(await row()).toMatchObject({ status: 'suspended', role: 'Lead', roles: ['Lead'] });
  });
});
