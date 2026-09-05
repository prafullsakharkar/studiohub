import { useQueryClient } from '@tanstack/react-query';
import { useDeliveryDetail, DELIVERY_QUERY_KEYS } from './useDeliveryQueries';
import { useDeliveryMutations } from './useDeliveryMutations';
import { DeliveryVersionRef } from '@/types/deliveries';

/**
 * Aggregator hook preserving the legacy useDeliveryWorkspace contract, now
 * backed by TanStack Query. Prefer the granular hooks for new code.
 */
export function useDeliveryWorkspace(deliveryId: string) {
  const queryClient = useQueryClient();
  const detailQuery = useDeliveryDetail(deliveryId || undefined);
  const mutations = useDeliveryMutations();

  const delivery = detailQuery.data ?? null;
  const error = detailQuery.error instanceof Error ? detailQuery.error.message : null;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEYS.all });

  const guard = () => {
    if (!deliveryId) return false;
    return true;
  };

  return {
    delivery,
    loading: detailQuery.isLoading,
    error,
    refresh,
    prepare: (actorName?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.prepareDelivery({ id: deliveryId, actorName });
    },
    validate: (actorName?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.validateDelivery({ id: deliveryId, actorName });
    },
    submit: (actorName?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.submitDelivery({ id: deliveryId, actorName });
    },
    approve: (actorName?: string, notes?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.approveDelivery({ id: deliveryId, actorName, notes });
    },
    reject: (reason: string, notes: string, actorName?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.rejectDelivery({ id: deliveryId, reason, notes, actorName });
    },
    retry: (actorName?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.retryDelivery({ id: deliveryId, actorName });
    },
    complete: (actorName?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.completeDelivery({ id: deliveryId, actorName });
    },
    cancel: (reason: string, actorName?: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.cancelDelivery({ id: deliveryId, reason, actorName });
    },
    addVersion: (version: DeliveryVersionRef) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.addVersion({ id: deliveryId, version });
    },
    removeVersion: (versionId: string) => {
      if (!guard()) return Promise.resolve(undefined);
      return mutations.removeVersion({ id: deliveryId, versionId });
    },
  };
}
