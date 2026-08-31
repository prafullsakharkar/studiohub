import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/mocks/db/production/projects';
import { useProjects } from '@/modules/production/hooks/useProjects';

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

export function useActiveProject(): { project: Project | undefined; activeProjectId: string } {
  const activeProjectId = useProductionStore((state) => state.activeProjectId);
  const { data } = useProjects({ page_size: 100 });
  const projects = data?.results ?? [];
  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  return { project, activeProjectId };
}
