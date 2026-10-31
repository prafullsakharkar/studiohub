import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/production/structure';
import type { QueryParams } from '@/types/common';
import { useAuth } from '@/modules/auth';
import { useCan } from '@/core/permissions/useCan';

export const PROJECT_QUERY_KEYS = {
  all: ['projects'] as const,
  lists: () => [...PROJECT_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams, userId?: string) =>
    [...PROJECT_QUERY_KEYS.lists(), params, userId] as const,
  details: () => [...PROJECT_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PROJECT_QUERY_KEYS.details(), id] as const,
};

export function useProjects(params?: QueryParams) {
  const { user } = useAuth();
  // The list route needs `project.view`; without it every page of the app (the project switcher asks on each) would
  // draw a 403 for a signed-in user who holds no role.
  const canView = useCan('project.view');

  return useQuery({
    queryKey: PROJECT_QUERY_KEYS.list(params, user?.id),
    queryFn: ({ signal }) => projectsApi.list({ page_size: 100, ...(params as Record<string, string | number | boolean | undefined>) }, signal),
    enabled: Boolean(user) && canView,
    staleTime: 1000 * 30,
  });
}

export function useProject(id?: string) {
  return useQuery({
    queryKey: PROJECT_QUERY_KEYS.detail(id || ''),
    queryFn: ({ signal }) => projectsApi.get(id || '', signal),
    enabled: !!id,
  });
}
