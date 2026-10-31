import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'studiohub_production_context_v2';

function seedPersisted(state: Record<string, unknown>, version = 0) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
}

describe('useProductionStore persisted project validation (REST-only)', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('clears a foreign backend UUID on explicit project reset (no fixture fallback)', async () => {
    seedPersisted({ activeProjectId: 'e0f40866-a39f-4680-8799-49fbc0d99370', recentProjectIds: [], favoriteProjectIds: [], activeSubTab: 'overview' });
    const { useProductionStore } = await import('../useProductionStore');

    useProductionStore.getState().setActiveProject(null);

    expect(useProductionStore.getState().activeProjectId).toBeNull();
  });

  it('selecting a project records it as recent', async () => {
    const { useProductionStore } = await import('../useProductionStore');

    useProductionStore.getState().setActiveProject('proj-abc');

    expect(useProductionStore.getState().activeProjectId).toBe('proj-abc');
    expect(useProductionStore.getState().recentProjectIds).toContain('proj-abc');
  });

  it('drops the made-up show id an earlier version stored, and keeps what else was stored', async () => {
    seedPersisted({ activeProjectId: 'proj-abc', activeShowId: 'show-proj-abc-main', recentProjectIds: ['proj-abc'], favoriteProjectIds: ['proj-x'], activeSubTab: 'tasks' });
    const { useProductionStore } = await import('../useProductionStore');

    const state = useProductionStore.getState() as unknown as Record<string, unknown>;
    expect('activeShowId' in state).toBe(false);
    expect(state).toMatchObject({ activeProjectId: 'proj-abc', recentProjectIds: ['proj-abc'], favoriteProjectIds: ['proj-x'], activeSubTab: 'tasks' });

    useProductionStore.getState().setActiveSubTab('shots'); // any write persists the state again
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('activeShowId');
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('show-proj-abc-main');
  });
});
