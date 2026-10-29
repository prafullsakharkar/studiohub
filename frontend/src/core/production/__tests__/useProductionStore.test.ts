import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'studiohub_production_context_v2';

function seedPersistedProjectId(projectId: string | null) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      state: {
        activeProjectId: projectId,
        activeShowId: null,
        recentProjectIds: [],
        favoriteProjectIds: [],
        activeSubTab: 'overview',
      },
      version: 0,
    })
  );
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
    seedPersistedProjectId('e0f40866-a39f-4680-8799-49fbc0d99370');
    const { useProductionStore } = await import('../useProductionStore');

    useProductionStore.getState().setActiveProject(null);

    expect(useProductionStore.getState().activeProjectId).toBeNull();
    expect(useProductionStore.getState().activeShowId).toBeNull();
  });

  it('selecting a project clears the active show and records the project as recent', async () => {
    const { useProductionStore } = await import('../useProductionStore');

    useProductionStore.getState().setActiveShow('show-x');
    useProductionStore.getState().setActiveProject('proj-abc');

    expect(useProductionStore.getState().activeProjectId).toBe('proj-abc');
    expect(useProductionStore.getState().activeShowId).toBeNull();
    expect(useProductionStore.getState().recentProjectIds).toContain('proj-abc');
  });

  it('clearing the show keeps the active project', async () => {
    const { useProductionStore } = await import('../useProductionStore');

    useProductionStore.getState().setActiveProject('proj-abc');
    useProductionStore.getState().setActiveShow('show-x');
    useProductionStore.getState().clearShow();

    expect(useProductionStore.getState().activeProjectId).toBe('proj-abc');
    expect(useProductionStore.getState().activeShowId).toBeNull();
  });
});
