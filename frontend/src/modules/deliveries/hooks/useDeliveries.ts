import { useState, useEffect, useCallback } from 'react';
import { deliveryService } from '../services/DeliveryService';
import { DeliveryPackage, DeliveryDestination, DeliveryVersionRef } from '@/types/deliveries';

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState<DeliveryPackage[]>([]);
  const [destinations, setDestinations] = useState<DeliveryDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      const [items, dests] = await Promise.all([
        deliveryService.getDeliveries(),
        deliveryService.getDestinations(),
      ]);
      setDeliveries(items);
      setDestinations(dests);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleCreate = async (data: Partial<DeliveryPackage>) => {
    const created = await deliveryService.createDelivery(data);
    await fetchDeliveries();
    return created;
  };

  const handlePrepare = async (id: string, actorName?: string) => {
    const updated = await deliveryService.prepareDelivery(id, actorName);
    await fetchDeliveries();
    return updated;
  };

  const handleValidate = async (id: string, actorName?: string) => {
    const updated = await deliveryService.validateDelivery(id, actorName);
    await fetchDeliveries();
    return updated;
  };

  const handleSubmit = async (id: string, actorName?: string) => {
    const updated = await deliveryService.submitDelivery(id, actorName);
    await fetchDeliveries();
    return updated;
  };

  const handleApprove = async (id: string, actorName?: string, notes?: string) => {
    const updated = await deliveryService.approveDelivery(id, actorName, notes);
    await fetchDeliveries();
    return updated;
  };

  const handleReject = async (id: string, reason: string, notes: string, actorName?: string) => {
    const updated = await deliveryService.rejectDelivery(id, reason, notes, actorName);
    await fetchDeliveries();
    return updated;
  };

  const handleRetry = async (id: string, actorName?: string) => {
    const updated = await deliveryService.retryDelivery(id, actorName);
    await fetchDeliveries();
    return updated;
  };

  const handleComplete = async (id: string, actorName?: string) => {
    const updated = await deliveryService.completeDelivery(id, actorName);
    await fetchDeliveries();
    return updated;
  };

  const handleCancel = async (id: string, reason: string, actorName?: string) => {
    const updated = await deliveryService.cancelDelivery(id, reason, actorName);
    await fetchDeliveries();
    return updated;
  };

  const handleAddVersion = async (id: string, version: DeliveryVersionRef) => {
    const updated = await deliveryService.addVersionToDelivery(id, version);
    await fetchDeliveries();
    return updated;
  };

  const handleRemoveVersion = async (id: string, versionId: string) => {
    const updated = await deliveryService.removeVersionFromDelivery(id, versionId);
    await fetchDeliveries();
    return updated;
  };

  return {
    deliveries,
    destinations,
    loading,
    error,
    refresh: fetchDeliveries,
    createDelivery: handleCreate,
    prepareDelivery: handlePrepare,
    validateDelivery: handleValidate,
    submitDelivery: handleSubmit,
    approveDelivery: handleApprove,
    rejectDelivery: handleReject,
    retryDelivery: handleRetry,
    completeDelivery: handleComplete,
    cancelDelivery: handleCancel,
    addVersion: handleAddVersion,
    removeVersion: handleRemoveVersion,
  };
}
