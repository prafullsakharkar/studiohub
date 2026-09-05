import { useQueryClient } from '@tanstack/react-query';
import { useDeliveryList, useDeliveryDestinations, DELIVERY_QUERY_KEYS } from './useDeliveryQueries';
import { useDeliveryMutations } from './useDeliveryMutations';
import { DeliveryPackage, DeliveryVersionRef } from '@/types/deliveries';

/**
 * Aggregator hook preserving the legacy useDeliveries contract, now backed
 * by TanStack Query. Prefer the granular hooks for new code.
 */
export function useDeliveries() {
  const queryClient = useQueryClient();
  const deliveriesQuery = useDeliveryList();
  const destinationsQuery = useDeliveryDestinations();
  const mutations = useDeliveryMutations();

  const firstError =
    deliveriesQuery.error instanceof Error
      ? deliveriesQuery.error.message
      : destinationsQuery.error instanceof Error
        ? destinationsQuery.error.message
        : null;

  return {
    deliveries: deliveriesQuery.data ?? [],
    destinations: destinationsQuery.data ?? [],
    loading: deliveriesQuery.isLoading || destinationsQuery.isLoading,
    error: firstError,
    refresh: () => queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEYS.all }),
    createDelivery: (data: Partial<DeliveryPackage>) => mutations.createDelivery(data),
    prepareDelivery: (id: string, actorName?: string) =>
      mutations.prepareDelivery({ id, actorName }),
    validateDelivery: (id: string, actorName?: string) =>
      mutations.validateDelivery({ id, actorName }),
    submitDelivery: (id: string, actorName?: string) =>
      mutations.submitDelivery({ id, actorName }),
    approveDelivery: (id: string, actorName?: string, notes?: string) =>
      mutations.approveDelivery({ id, actorName, notes }),
    rejectDelivery: (id: string, reason: string, notes: string, actorName?: string) =>
      mutations.rejectDelivery({ id, reason, notes, actorName }),
    retryDelivery: (id: string, actorName?: string) =>
      mutations.retryDelivery({ id, actorName }),
    completeDelivery: (id: string, actorName?: string) =>
      mutations.completeDelivery({ id, actorName }),
    cancelDelivery: (id: string, reason: string, actorName?: string) =>
      mutations.cancelDelivery({ id, reason, actorName }),
    addVersion: (id: string, version: DeliveryVersionRef) =>
      mutations.addVersion({ id, version }),
    removeVersion: (id: string, versionId: string) =>
      mutations.removeVersion({ id, versionId }),
  };
}
