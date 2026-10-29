import { useQuery } from '@tanstack/react-query';
import { shotService } from '../services/ShotService';
import { QueryParams } from '@/types/common';
import { useProductionContext } from '@/core/production/ProductionContext';

export const SHOT_QUERY_KEYS = {
  all: ['shots'] as const,
  lists: () => [...SHOT_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...SHOT_QUERY_KEYS.lists(), params] as const,
  details: () => [...SHOT_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...SHOT_QUERY_KEYS.details(), id] as const,
};

export function useShots(params?: QueryParams) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'shots',
      params,
    ],
    queryFn: () =>
      shotService.getShots({
        ...params,
        project_id: projectId || undefined,
        show_id: showId || undefined,
      }),
    enabled: Boolean(projectId && showId),
  });
}

export function useShot(id?: string) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'shots',
      id,
    ],
    queryFn: () => {
      if (!id) throw new Error('Shot ID required');
      return shotService.getShotById(id);
    },
    enabled: Boolean(projectId && showId && id),
  });
}
