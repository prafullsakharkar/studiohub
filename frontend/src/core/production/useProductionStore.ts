import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProductionState {
  activeProjectId: string | null;
  recentProjectIds: string[];
  favoriteProjectIds: string[];
  activeSubTab: string;
  setActiveProject: (projectId: string | null) => void;
  setActiveSubTab: (tabId: string) => void;
  addRecentProject: (projectId: string) => void;
  toggleFavoriteProject: (projectId: string) => void;
}

export const useProductionStore = create<ProductionState>()(
  persist(
    (set, get) => ({
      // REST-only: start empty so no stale fixture id is treated as active.
      activeProjectId: null,
      recentProjectIds: [],
      favoriteProjectIds: [],
      activeSubTab: 'overview',

      setActiveProject: (projectId: string | null) => {
        if (!projectId) {
          set({ activeProjectId: null });
          return;
        }
        const state = get();
        if (state.activeProjectId === projectId) return;

        const recents = state.recentProjectIds || [];
        const updatedRecent = [projectId, ...recents.filter((id) => id !== projectId)].slice(0, 8);
        set({
          activeProjectId: projectId,
          recentProjectIds: updatedRecent,
        });
      },

      setActiveSubTab: (tabId: string) => {
        set({ activeSubTab: tabId });
      },

      addRecentProject: (projectId: string) => {
        const state = get();
        const recents = state.recentProjectIds || [];
        const updatedRecent = [projectId, ...recents.filter((id) => id !== projectId)].slice(0, 8);
        set({ recentProjectIds: updatedRecent });
      },

      toggleFavoriteProject: (projectId: string) => {
        const state = get();
        const favorites = state.favoriteProjectIds || [];
        const exists = favorites.includes(projectId);
        const next = exists ? favorites.filter((id) => id !== projectId) : [...favorites, projectId];
        set({ favoriteProjectIds: next });
      },
    }),
    {
      name: 'studiohub_production_context_v2',
      // v1 dropped `activeShowId`: it only ever held a made-up `show-<project>-main`, which a real show-bound
      // membership never matches. Browsers that stored it would otherwise keep it in the state for good.
      version: 1,
      migrate: (persisted) => {
        const { activeShowId: _dropped, ...kept } = (persisted ?? {}) as Record<string, unknown>;
        return kept as unknown as ProductionState;
      },
    }
  )
);
