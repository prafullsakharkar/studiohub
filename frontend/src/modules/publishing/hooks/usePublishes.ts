import { useQuery } from '@tanstack/react-query';
import { publishingService } from '../services/PublishingService';

export const PUBLISHING_QUERY_KEYS = {
  all: ['publishing'] as const,
  lists: () => [...PUBLISHING_QUERY_KEYS.all, 'list'] as const,
  list: () => [...PUBLISHING_QUERY_KEYS.lists()] as const,
  destinations: () => [...PUBLISHING_QUERY_KEYS.all, 'destinations'] as const,
};

export function usePublishes() {
  return useQuery({
    queryKey: PUBLISHING_QUERY_KEYS.list(),
    queryFn: () => publishingService.getPublishes(),
  });
}

export function usePublishDestinations() {
  return useQuery({
    queryKey: PUBLISHING_QUERY_KEYS.destinations(),
    queryFn: () => publishingService.getDestinations(),
    // Destinations are static config-like data (mock-backed until the
    // backend ships a destinations endpoint).
    staleTime: Infinity,
  });
}
