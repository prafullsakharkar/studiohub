import { useQuery } from '@tanstack/react-query';
import { episodeService } from '../services/EpisodeService';
import { EpisodeFilterParams } from '@/types/production';
import { useProductionContext } from '@/core/production/ProductionContext';

export const EPISODE_QUERY_KEYS = {
  all: ['episodes'] as const,
  lists: () => [...EPISODE_QUERY_KEYS.all, 'list'] as const,
  list: (params?: EpisodeFilterParams) => [...EPISODE_QUERY_KEYS.lists(), params] as const,
  details: () => [...EPISODE_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...EPISODE_QUERY_KEYS.details(), id] as const,
};

export function useEpisodes(params?: EpisodeFilterParams) {
  const { projectId } = useProductionContext();
  const effectiveProjectId = params?.project_id || projectId;

  return useQuery({
    queryKey: [
      'projects',
      effectiveProjectId,
      'episodes',
      params,
    ],
    queryFn: () =>
      episodeService.getEpisodes({
        ...params,
        project_id: effectiveProjectId || undefined,
      }),
    enabled: Boolean(effectiveProjectId),
  });
}

export function useEpisode(id: string) {
  const { projectId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'episodes',
      id,
    ],
    queryFn: () => episodeService.getEpisode(id),
    enabled: Boolean(id),
  });
}
