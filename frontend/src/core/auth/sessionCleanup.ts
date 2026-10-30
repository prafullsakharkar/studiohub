import { useProductionStore } from '@/core/production/useProductionStore';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';

/**
 * What this browser remembers about the person who was signed in: the open workspace tabs (with the names of the
 * records they hold) and the chosen, recent and favourite projects. Both are kept in localStorage so a reload
 * keeps them (the production store writes its emptied state back), which means the next person to sign in here would otherwise inherit them. Called whenever a session
 * ends, here or in another tab. Display preferences (theme, layout, view modes) stay: they say nothing about
 * the person's work.
 */
export function clearUserScopedState(): void {
  useWorkspaceStore.getState().reset();
  useProductionStore.setState({ activeProjectId: null, activeShowId: null, recentProjectIds: [], favoriteProjectIds: [], activeSubTab: 'overview' });
}
