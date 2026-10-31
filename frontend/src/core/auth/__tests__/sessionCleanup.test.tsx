import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { clearUserScopedState } from '../sessionCleanup';

const flow = loadSample('identity/_auth_flow.json');
const WORKSPACE_KEY = 'studiohub_workspace_state_v2';
const PRODUCTION_KEY = 'studiohub_production_context_v2';

/** What a signed-in person leaves behind in this browser. */
function leaveTraces() {
  // The copy the removed workspace-tabs screen kept: a browser that used it still holds it.
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ tabs: [{ id: 'shot-1', type: 'shot', title: 'SH0010 (secret show)' }] }));
  useProductionStore.getState().setActiveProject('project-1');
  useProductionStore.getState().toggleFavoriteProject('project-2');
}
const traces = () => ({
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
  it('is gone after clearUserScopedState: the retired tabs copy, and the chosen, recent and favourite projects', () => {
    leaveTraces();
    expect(traces().stored).toContain('secret show');
    expect(traces().production.activeProjectId).toBe('project-1');

    clearUserScopedState();

    const after = traces();
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

    await waitFor(() => expect(traces().stored).not.toContain('secret show'));
    expect(traces().production.activeProjectId).toBeNull();
  });
});
