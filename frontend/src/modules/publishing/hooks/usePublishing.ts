import { useQueryClient } from '@tanstack/react-query';
import { usePublishes, usePublishDestinations, PUBLISHING_QUERY_KEYS } from './usePublishes';
import { usePublishingMutations } from './usePublishingMutations';

/**
 * Aggregator hook preserving the legacy usePublishing contract, now backed
 * by TanStack Query. Prefer the granular hooks for new code.
 */
export function usePublishing() {
  const queryClient = useQueryClient();
  const publishesQuery = usePublishes();
  const destinationsQuery = usePublishDestinations();
  const mutations = usePublishingMutations();

  const firstError =
    publishesQuery.error instanceof Error
      ? publishesQuery.error.message
      : destinationsQuery.error instanceof Error
        ? destinationsQuery.error.message
        : null;

  return {
    publishes: publishesQuery.data ?? [],
    destinations: destinationsQuery.data ?? [],
    loading: publishesQuery.isLoading || destinationsQuery.isLoading,
    error: firstError,
    refresh: () => queryClient.invalidateQueries({ queryKey: PUBLISHING_QUERY_KEYS.all }),
    publish: mutations.publish,
    republish: (id: string, comment: string, artistName: string) =>
      mutations.republish({ id, comment, artistName }),
    unpublish: (id: string, reason: string, userName: string) =>
      mutations.unpublish({ id, reason, userName }),
    validate: mutations.validatePublish,
    retry: mutations.retryPublish,
    deletePublish: mutations.deletePublish,
  };
}
