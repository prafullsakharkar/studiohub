import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, mockProjects } from '@/mocks/db/production/projects';

export interface ProductionState {
  activeProjectId: string;
  recentProjectIds: string[];
  activeSubTab: string;
  setActiveProject: (projectId: string) => void;
  setActiveSubTab: (tabId: string) => void;
  addRecentProject: (projectId: string) => void;
}

export const useProductionStore = create<ProductionState>()(
  persist(
    (set, get) => ({
      activeProjectId: 'proj-001',
      recentProjectIds: ['proj-001', 'proj-002', 'proj-003'],
      activeSubTab: 'overview',

      setActiveProject: (projectId: string) => {
        const state = get();
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
    }),
    {
      name: 'studiohub_production_context_v1',
    }
  )
);

export function useActiveProject(): { project: Project; activeProjectId: string } {
  const activeProjectId = useProductionStore((state) => state.activeProjectId);
  const project = mockProjects.find((p) => p.id === activeProjectId) || mockProjects[0];
  return { project, activeProjectId };
}
