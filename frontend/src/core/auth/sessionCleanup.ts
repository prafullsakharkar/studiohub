import { useProductionStore } from '@/core/production/useProductionStore';

/**
 * Where the open-workspace-tabs screen kept its tabs (with the names of the records they held) until it was removed.
 * Browsers that used it still hold that copy, so a session's end removes it.
 */
const RETIRED_WORKSPACE_KEY = 'studiohub_workspace_state_v2';

/**
 * What this browser remembers about the person who was signed in: the chosen, recent and favourite projects (and the
 * retired workspace-tabs copy, see above). They are kept in localStorage so a reload keeps them (the production store
 * writes its emptied state back), which means the next person to sign in here would otherwise inherit them. Called
 * whenever a session ends, here or in another tab. Display preferences (theme, layout, view modes) stay: they say nothing about
 * the person's work.
 */
export function clearUserScopedState(): void {
  try {
    localStorage.removeItem(RETIRED_WORKSPACE_KEY);
  } catch {
    // storage unavailable: nothing was kept
  }
  useProductionStore.setState({ activeProjectId: null, recentProjectIds: [], favoriteProjectIds: [], activeSubTab: 'overview' });
}
