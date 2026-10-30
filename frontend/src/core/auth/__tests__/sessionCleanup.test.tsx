import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { clearUserScopedState } from '../sessionCleanup';

const flow = loadSample('identity/_auth_flow.json');
const WORKSPACE_KEY = 'studiohub_workspace_state_v2';
const PRODUCTION_KEY = 'studiohub_production_context_v2';

/** What a signed-in person leaves behind in this browser. */
function leaveTraces() {
  useWorkspaceStore.getState().openTab({ id: 'shot-1', type: 'shot', title: 'SH0010 (secret show)' }, 'SH0010 (secret show)');
  useProductionStore.getState().setActiveProject('project-1');
  useProductionStore.getState().toggleFavoriteProject('project-2');
}
const traces = () => ({
  tabTitles: useWorkspaceStore.getState().tabs.map((t) => t.title),
  stored: localStorage.getItem(WORKSPACE_KEY) ?? '',
  production: useProductionStore.getState(),
  storedProduction: localStorage.getItem(PRODUCTION_KEY) ?? '',
});

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('what a session leaves in the browser', () => {
  it('is gone after clearUserScopedState: the tabs, their stored copy, and the chosen, recent and favourite projects', () => {
    leaveTraces();
    expect(traces().tabTitles).toContain('SH0010 (secret show)');
    expect(traces().stored).toContain('secret show');
    expect(traces().production.activeProjectId).toBe('project-1');

    clearUserScopedState();

    const after = traces();
    expect(after.tabTitles).toEqual(['Workspace']);
    expect(after.stored).not.toContain('secret show');
    expect(after.production).toMatchObject({ activeProjectId: null, recentProjectIds: [], favoriteProjectIds: [] });
    expect(after.storedProduction).not.toContain('project-1');
    expect(after.storedProduction).not.toContain('project-2');
  });

  it('is cleared when the session ends, however it ends: here or in another tab', async () => {
    mockFetch(() => ({ status: 200, body: flow.me_artist.body }));
    tokenStorage.setTokens({ access: 'a', refresh: 'r' });
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(tokenStorage.hasValidSession()).toBe(true));
    leaveTraces();

    tokenStorage.clearTokens(); // a sign-out, a rejected refresh, a password change, or another tab signing out

    await waitFor(() => expect(traces().tabTitles).toEqual(['Workspace']));
    expect(traces().stored).not.toContain('secret show');
    expect(traces().production.activeProjectId).toBeNull();
  });
});
