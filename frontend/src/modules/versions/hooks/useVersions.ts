import { useQuery } from '@tanstack/react-query';
import { versionService } from '../services/VersionService';
import { QueryParams } from '@/types/common';
import { useProductionContext } from '@/core/production/ProductionContext';

export const VERSION_KEYS = {
  all: ['versions'] as const,
  lists: () => [...VERSION_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...VERSION_KEYS.lists(), params] as const,
  details: () => [...VERSION_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...VERSION_KEYS.details(), id] as const,
};

export const useVersions = (params?: QueryParams) => {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'versions',
      params,
    ],
    queryFn: () =>
      versionService.getVersions({
        ...params,
        project_id: projectId || undefined,
        show_id: showId || undefined,
      }),
    enabled: Boolean(projectId && showId),
    staleTime: 1000 * 60 * 5,
  });
};

export const useVersion = (id: string) => {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'versions',
      id,
    ],
    queryFn: () => versionService.getVersionById(id),
    enabled: Boolean(projectId && showId && id),
    staleTime: 1000 * 60 * 5,
  });
};
