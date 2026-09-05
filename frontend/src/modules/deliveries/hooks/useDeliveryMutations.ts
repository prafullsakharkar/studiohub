import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryService } from '../services/DeliveryService';
import { DeliveryPackage, DeliveryVersionRef } from '@/types/deliveries';
import { DELIVERY_QUERY_KEYS } from './useDeliveryQueries';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function useDeliveryMutations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEYS.lists() });
  };
  const invalidateDetail = (id?: string) => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEYS.detail(id) });
    }
  };
  const invalidateAll = (id?: string) => {
    invalidateLists();
    invalidateDetail(id);
  };

  const labelOf = (delivery: DeliveryPackage) =>
    delivery.package_code || delivery.title || 'delivery';

  const createMutation = useMutation({
    mutationFn: (data: Partial<DeliveryPackage>) => deliveryService.createDelivery(data),
    onSuccess: (created) => {
      invalidateAll(created.id);
      addNotification({
        type: 'success',
        title: 'Delivery Created',
        message: `Delivery package "${labelOf(created)}" was created.`,
      });
    },
  });

  const prepareMutation = useMutation({
    mutationFn: ({ id, actorName }: { id: string; actorName?: string }) =>
      deliveryService.prepareDelivery(id, actorName),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'info',
        title: 'Delivery Prepared',
        message: `"${labelOf(updated)}" is ready for review.`,
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: ({ id, actorName }: { id: string; actorName?: string }) =>
      deliveryService.validateDelivery(id, actorName),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'info',
        title: 'Delivery Validated',
        message: `"${labelOf(updated)}" passed QC validation.`,
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, actorName }: { id: string; actorName?: string }) =>
      deliveryService.submitDelivery(id, actorName),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'success',
        title: 'Delivery Submitted',
        message: `"${labelOf(updated)}" was submitted to the client.`,
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, actorName, notes }: { id: string; actorName?: string; notes?: string }) =>
      deliveryService.approveDelivery(id, actorName, notes),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'success',
        title: 'Delivery Approved',
        message: `"${labelOf(updated)}" was approved.`,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      id,
      reason,
      notes,
      actorName,
    }: {
      id: string;
      reason: string;
      notes: string;
      actorName?: string;
    }) => deliveryService.rejectDelivery(id, reason, notes, actorName),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'warning',
        title: 'Delivery Rejected',
        message: `"${labelOf(updated)}" was sent back for rework.`,
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({ id, actorName }: { id: string; actorName?: string }) =>
      deliveryService.retryDelivery(id, actorName),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'info',
        title: 'Delivery Retried',
        message: `"${labelOf(updated)}" was re-queued.`,
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, actorName }: { id: string; actorName?: string }) =>
      deliveryService.completeDelivery(id, actorName),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'success',
        title: 'Delivery Completed',
        message: `"${labelOf(updated)}" was marked complete.`,
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason, actorName }: { id: string; reason: string; actorName?: string }) =>
      deliveryService.cancelDelivery(id, reason, actorName),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'warning',
        title: 'Delivery Cancelled',
        message: `"${labelOf(updated)}" was cancelled.`,
      });
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: DeliveryVersionRef }) =>
      deliveryService.addVersionToDelivery(id, version),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'success',
        title: 'Version Added',
        message: `Version added to "${labelOf(updated)}".`,
      });
    },
  });

  const removeVersionMutation = useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      deliveryService.removeVersionFromDelivery(id, versionId),
    onSuccess: (updated, args) => {
      invalidateAll(args.id);
      addNotification({
        type: 'info',
        title: 'Version Removed',
        message: `Version removed from "${labelOf(updated)}".`,
      });
    },
  });

  return {
    createDelivery: createMutation.mutateAsync,
    prepareDelivery: prepareMutation.mutateAsync,
    validateDelivery: validateMutation.mutateAsync,
    submitDelivery: submitMutation.mutateAsync,
    approveDelivery: approveMutation.mutateAsync,
    rejectDelivery: rejectMutation.mutateAsync,
    retryDelivery: retryMutation.mutateAsync,
    completeDelivery: completeMutation.mutateAsync,
    cancelDelivery: cancelMutation.mutateAsync,
    addVersion: addVersionMutation.mutateAsync,
    removeVersion: removeVersionMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
