import { useQuery } from '@tanstack/react-query';
import { sequenceService } from '../services/SequenceService';
import { SequenceFilterParams } from '@/types/production';
import { useProductionContext } from '@/core/production/ProductionContext';

export const SEQUENCE_QUERY_KEYS = {
  all: ['sequences'] as const,
  lists: () => [...SEQUENCE_QUERY_KEYS.all, 'list'] as const,
  list: (params?: SequenceFilterParams) => [...SEQUENCE_QUERY_KEYS.lists(), params] as const,
  details: () => [...SEQUENCE_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...SEQUENCE_QUERY_KEYS.details(), id] as const,
};

export function useSequences(params?: SequenceFilterParams) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'sequences',
      params,
    ],
    queryFn: () =>
      sequenceService.getSequences({
        ...params,
        project_id: projectId || undefined,
        show_id: showId || undefined,
      }),
    enabled: Boolean(projectId && showId),
  });
}

export function useSequence(id: string) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'sequences',
      id,
    ],
    queryFn: () => sequenceService.getSequence(id),
    enabled: Boolean(projectId && showId && id),
  });
}
