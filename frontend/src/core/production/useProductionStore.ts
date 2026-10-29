import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProductionState {
  activeProjectId: string | null;
  activeShowId: string | null;
  recentProjectIds: string[];
  favoriteProjectIds: string[];
  activeSubTab: string;
  setActiveProject: (projectId: string | null) => void;
  setActiveShow: (showId: string | null) => void;
  clearShow: () => void;
  setActiveSubTab: (tabId: string) => void;
  addRecentProject: (projectId: string) => void;
  toggleFavoriteProject: (projectId: string) => void;
}

export const useProductionStore = create<ProductionState>()(
  persist(
    (set, get) => ({
      // REST-only: start empty so no stale fixture id is treated as active.
      activeProjectId: null,
      activeShowId: null,
      recentProjectIds: [],
      favoriteProjectIds: [],
      activeSubTab: 'overview',

      setActiveProject: (projectId: string | null) => {
        if (!projectId) {
          set({ activeProjectId: null, activeShowId: null });
          return;
        }
        const state = get();
        if (state.activeProjectId === projectId) return;

        const recents = state.recentProjectIds || [];
        const updatedRecent = [projectId, ...recents.filter((id) => id !== projectId)].slice(0, 8);
        set({
          activeProjectId: projectId,
          activeShowId: null,
          recentProjectIds: updatedRecent,
        });
      },

      setActiveShow: (showId: string | null) => {
        set({ activeShowId: showId });
      },

      clearShow: () => {
        set({ activeShowId: null });
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
    }
  )
);
