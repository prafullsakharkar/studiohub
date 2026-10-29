import { useContext, useMemo } from 'react';
import { AuthContext } from '@/core/auth/AuthContext';
import { useProductionStore } from '@/core/production/useProductionStore';
import { evaluateAccess } from './access';

export interface UseCanOptions {
  /** Project the check is about; defaults to the active project in the workspace store. */
  projectId?: string;
  showId?: string;
  /** For several codes: require every one (default) or at least one. */
  mode?: 'all' | 'any';
}

/**
 * Whether the signed-in user may do `code` (a backend permission code, or a legacy gate code that
 * ./permissionMap translates).
 *
 *   const canCreate = useCan('masterdata.directory.manage');
 *   const canEditShots = useCan(['shot.update', 'shot.view'], { projectId });
 *
 * Provider-tolerant: outside an AuthProvider there is no user, so the answer is `false`.
 * This hides UI only; the API checks again on every request.
 */
export function useCan(code: string | readonly string[], options: UseCanOptions = {}): boolean {
  const user = useContext(AuthContext)?.user ?? null;
  const activeProjectId = useProductionStore((s) => s.activeProjectId);
  const projectId = options.projectId ?? (activeProjectId || undefined);
  const { showId, mode = 'all' } = options;
  const codes = typeof code === 'string' ? [code] : code;
  const key = codes.join('|');

  return useMemo(() => {
    const context = { projectId, showId };
    const results = key.split('|').filter(Boolean).map((c) => evaluateAccess(user, c, context));
    if (results.length === 0) return false;
    return mode === 'any' ? results.some(Boolean) : results.every(Boolean);
  }, [user, key, projectId, showId, mode]);
}
