import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { AuthContext } from '@/core/auth/AuthContext';
import { partialMembershipOf } from '@/core/permissions/access';
import { useProductionStore } from '@/core/production/useProductionStore';
import { getDashboardData } from '../api/getDashboardData';
import { ProjectDashboardData } from '../types';

export interface UseProjectDashboardOptions {
  refetchInterval?: number | false;
  enabled?: boolean;
}

/**
 * Project-Context Aware TanStack Query Hook for StudioHub Command Center.
 * Automatically synchronizes with useProductionStore.activeProjectId.
 *
 * Query Key Structure: ['dashboard', projectId]
 * Guaranteeing zero cross-project data leakage.
 */
export function useProjectDashboard(options: UseProjectDashboardOptions = {}) {
  const { activeProjectId } = useProductionStore();
  const projectId = activeProjectId || null;
  const user = useContext(AuthContext)?.user ?? null;
  // A member limited to a show, a department or a vendor/client side gets 404 from the dashboard: do not ask.
  const partial = projectId ? partialMembershipOf(user, projectId) : null;

  const isEnabled = Boolean(projectId && !partial && (options.enabled ?? true));

  return useQuery<ProjectDashboardData, Error>({
    queryKey: ['dashboard', projectId],
    queryFn: ({ signal }) => {
      if (!projectId) {
        throw new Error('Active project context is required');
      }
      return getDashboardData(projectId);
    },
    enabled: isEnabled,
    staleTime: 30000, // 30 seconds
    refetchInterval: options.refetchInterval ?? 60000, // Background poll every 60s
    placeholderData: (previousData) => {
      // Do NOT leak previous project's data when switching projects!
      // Only retain placeholder data if the project ID is strictly identical
      if (previousData && previousData.project.id === projectId) {
        return previousData;
      }
      return undefined;
    },
  });
}

/**
 * Hook to invalidate dashboard queries for the current or a specific project.
 */
export function useInvalidateProjectDashboard() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useProductionStore();

  return (targetProjectId?: string) => {
    const pId = targetProjectId || activeProjectId;
    if (pId) {
      queryClient.invalidateQueries({
        queryKey: ['dashboard', pId],
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: ['dashboard'],
      });
    }
  };
}
