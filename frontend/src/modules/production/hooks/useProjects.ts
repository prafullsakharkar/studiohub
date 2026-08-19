import { useQuery } from '@tanstack/react-query';
import { projectService } from '../services/ProjectService';
import { QueryParams } from '@/types/drf';

export const PROJECT_QUERY_KEYS = {
  all: ['projects'] as const,
  lists: () => [...PROJECT_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...PROJECT_QUERY_KEYS.lists(), params] as const,
  details: () => [...PROJECT_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PROJECT_QUERY_KEYS.details(), id] as const,
};

export function useProjects(params?: QueryParams) {
  return useQuery({
    queryKey: PROJECT_QUERY_KEYS.list(params),
    queryFn: () => projectService.getProjects(params),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: PROJECT_QUERY_KEYS.detail(id),
    queryFn: () => projectService.getProjectById(id),
    enabled: !!id,
  });
}
