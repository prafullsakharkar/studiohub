import { useQuery } from '@tanstack/react-query';
import { shotService } from '../services/ShotService';
import { QueryParams } from '@/types/drf';

export const SHOT_QUERY_KEYS = {
  all: ['shots'] as const,
  lists: () => [...SHOT_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...SHOT_QUERY_KEYS.lists(), params] as const,
  details: () => [...SHOT_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...SHOT_QUERY_KEYS.details(), id] as const,
};

export function useShots(params?: QueryParams) {
  return useQuery({
    queryKey: SHOT_QUERY_KEYS.list(params),
    queryFn: () => shotService.getShots(params),
  });
}

export function useShot(id?: string) {
  return useQuery({
    queryKey: id ? SHOT_QUERY_KEYS.detail(id) : ['shots', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Shot ID required');
      return shotService.getShotById(id);
    },
    enabled: !!id,
  });
}
