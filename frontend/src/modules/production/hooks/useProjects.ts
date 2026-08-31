import { useQuery } from '@tanstack/react-query';
import { projectService } from '../services/ProjectService';
import { QueryParams } from '@/types/drf';
import { useOrganization } from '@/core/organization/useOrganization';

export const PROJECT_QUERY_KEYS = {
  all: ['projects'] as const,
  lists: () => [...PROJECT_QUERY_KEYS.all, 'list'] as const,
  list: (organizationId: string | undefined, params?: QueryParams) =>
    [...PROJECT_QUERY_KEYS.lists(), organizationId, params] as const,
  details: () => [...PROJECT_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PROJECT_QUERY_KEYS.details(), id] as const,
};

export function useProjects(params?: QueryParams) {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;
  return useQuery({
    queryKey: PROJECT_QUERY_KEYS.list(organizationId, params),
    queryFn: () => projectService.getProjects(params),
    enabled: !!organizationId,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: PROJECT_QUERY_KEYS.detail(id),
    queryFn: () => projectService.getProjectById(id),
    enabled: !!id,
  });
}
