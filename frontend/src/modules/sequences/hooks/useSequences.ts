import { useQuery } from '@tanstack/react-query';
import { sequenceService } from '../services/SequenceService';
import { QueryParams } from '@/types/drf';

export const SEQUENCE_QUERY_KEYS = {
  all: ['sequences'] as const,
  lists: () => [...SEQUENCE_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...SEQUENCE_QUERY_KEYS.lists(), params] as const,
  archived: () => [...SEQUENCE_QUERY_KEYS.all, 'archived'] as const,
  details: () => [...SEQUENCE_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...SEQUENCE_QUERY_KEYS.details(), id] as const,
};

export function useSequences(params?: QueryParams) {
  return useQuery({
    queryKey: SEQUENCE_QUERY_KEYS.list(params),
    queryFn: () => sequenceService.getSequences(params),
  });
}

export function useArchivedSequences(params?: QueryParams) {
  return useQuery({
    queryKey: SEQUENCE_QUERY_KEYS.archived(),
    queryFn: () => sequenceService.getArchived(params),
  });
}

export function useSequence(id?: string) {
  return useQuery({
    queryKey: id ? SEQUENCE_QUERY_KEYS.detail(id) : ['sequences', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Sequence ID required');
      return sequenceService.getSequenceById(id);
    },
    enabled: !!id,
  });
}
