import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { partialMembershipOf } from '@/core/permissions/access';
import { useProductionStore } from '@/core/production/useProductionStore';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ProjectDashboardPage } from '../pages/ProjectDashboardPage';

/**
 * The dashboard sums up the whole project; the server answers 404 "Project not found." to a member limited to a
 * department, a show or a vendor's side (TM-002). Captured: a lead artist with each kind of membership
 * (docs/sync/tools/test_capture_partial_dashboard.py).
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_partial_dashboard_flow.json');
const PROJECT = (flow.ids as unknown as { project: string }).project;
const me = (kind: string) => flow[`me_${kind}`].body as User;
const path = (c: MockCall) => new URL(c.url).pathname;
const DASHBOARD = `/api/v1/projects/${PROJECT}/dashboard/`;

function renderPage(user: User) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>
          <ProjectDashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  useProductionStore.setState({ activeProjectId: PROJECT });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  useProductionStore.setState({ activeProjectId: null });
  vi.unstubAllGlobals();
});

describe('which memberships cover the whole project', () => {
  it('the captures: the whole-project lead reads the dashboard, the other three get 404 "Project not found."', () => {
    expect(PROJECT).toMatch(/^[0-9a-f-]{36}$/);
    expect(flow.dashboard_whole.status).toBe(200);
    for (const kind of ['department', 'show', 'vendor']) {
      expect(flow[`dashboard_${kind}`], kind).toMatchObject({ status: 404, body: { detail: 'Project not found.' } });
    }
  });

  it('reads the limit from the membership /auth/me returns', () => {
    expect(partialMembershipOf(me('whole'), PROJECT)).toBeNull();
    expect(partialMembershipOf(me('department'), PROJECT)).toBe('department');
    expect(partialMembershipOf(me('show'), PROJECT)).toBe('show');
    expect(partialMembershipOf(me('vendor'), PROJECT)).toBe('external');
  });

  it('leaves the answer to the server for a superuser, another project, or no user', () => {
    expect(partialMembershipOf({ ...me('department'), is_superuser: true }, PROJECT)).toBeNull();
    expect(partialMembershipOf(me('department'), '00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(partialMembershipOf(null, PROJECT)).toBeNull();
  });

  it('an inactive limited membership is not the caller’s membership, so it limits nothing', () => {
    const user = me('department');
    const inactive = { ...user, project_memberships: user.project_memberships!.map((m) => ({ ...m, status: 'suspended' })) };
    expect(partialMembershipOf(inactive, PROJECT)).toBeNull();
  });
});

describe('the project dashboard page', () => {
  it.each([
    ['department', /limited to one department/],
    ['show', /limited to one show/],
    ['vendor', /partner studio or client/],
  ])('a lead limited to a %s is told the dashboard covers the whole project, and nothing is requested', async (kind, why) => {
    const { calls } = mockFetch((c) => (path(c) === DASHBOARD ? flow[`dashboard_${kind}`] : { status: 200, body: [] }));
    renderPage(me(kind));

    expect(screen.getByRole('heading', { name: 'The project dashboard covers the whole project' })).toBeTruthy();
    expect(screen.getByText(why)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shots' }).getAttribute('href')).toBe('/shots');
    expect(screen.queryByText('Failed to Load Project Dashboard')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50)); // a request, if one is made, is made by now
    expect(calls.filter((c) => path(c) === DASHBOARD)).toHaveLength(0);
  });

  it('a whole-project lead gets the dashboard', async () => {
    const { calls } = mockFetch((c) => (path(c) === DASHBOARD ? flow.dashboard_whole : { status: 200, body: [] }));
    renderPage(me('whole'));

    expect((await screen.findAllByText(flow.dashboard_whole.body.project.name)).length).toBeGreaterThan(0);
    expect(document.getElementById('project-context-dashboard')).toBeTruthy();
    expect(screen.queryByText('The project dashboard covers the whole project')).toBeNull();
    expect(calls.some((c) => path(c) === DASHBOARD)).toBe(true);
  });
});
