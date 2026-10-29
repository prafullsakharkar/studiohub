import { WorkspaceTab, DrawerState } from '@/types/workspace';

const STORAGE_KEY = 'studiohub_workspace_state_v2';

export interface PersistedWorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  drawer: DrawerState;
  updatedAt: number;
}

export const workspacePersistence = {
  save: (state: { tabs: WorkspaceTab[]; activeTabId: string; drawer: DrawerState }) => {
    try {
      const data: PersistedWorkspaceState = {
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        drawer: state.drawer,
        updatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to persist workspace state:', e);
    }
  },

  load: (): Partial<PersistedWorkspaceState> | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
        return null;
      }
      // Ensure no project or initial default is pinned
      const sanitizedTabs = parsed.tabs.map((tab: WorkspaceTab) => ({
        ...tab,
        isPinned: tab.primary?.type === 'project' ? false : Boolean(tab.isPinned),
      }));
      return {
        ...parsed,
        tabs: sanitizedTabs,
      };
    } catch (e) {
      console.warn('Failed to load persisted workspace state:', e);
      return null;
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  },
};
