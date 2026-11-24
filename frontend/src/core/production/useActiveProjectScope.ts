import { useProductionStore } from './useProductionStore';

/**
 * The project chosen in the project switcher as a list scope (`{ projectId }`), or `undefined` with none chosen. The
 * sidebar's lists pass it to their config, so they show that project only and follow the switcher; with none chosen they
 * show every project the caller can read.
 */
export function useActiveProjectScope(): { projectId: string } | undefined {
  const projectId = useProductionStore((s) => s.activeProjectId);
  return projectId ? { projectId } : undefined;
}
