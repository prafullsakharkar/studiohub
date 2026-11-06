import { useProductionStore } from '@/core/production/useProductionStore';
import { isEpisodicProject } from '../projectWorkflow';
import { useProject } from './useProjects';

export interface ProjectEpisodic {
  /** True only once the project is loaded and is episodic: unknown counts as not episodic, so nothing flashes in. */
  isEpisodic: boolean;
  /** The project is still being read; callers that redirect wait for this. */
  isLoading: boolean;
}

/**
 * The one episodic check of the UI (CR-47): every nav item, route, column, filter and picker that is about episodes asks
 * this. It reads the project from the shared query cache, so switching projects re-renders from fresh data.
 */
export function useProjectIsEpisodic(projectId?: string | null): ProjectEpisodic {
  const query = useProject(projectId || undefined);
  return { isEpisodic: isEpisodicProject(query.data), isLoading: Boolean(projectId) && query.isLoading };
}

/** `useProjectIsEpisodic` for the project chosen in the project switcher. */
export function useActiveProjectIsEpisodic(): ProjectEpisodic & { projectId: string | null } {
  const { activeProjectId } = useProductionStore();
  return { ...useProjectIsEpisodic(activeProjectId), projectId: activeProjectId };
}
