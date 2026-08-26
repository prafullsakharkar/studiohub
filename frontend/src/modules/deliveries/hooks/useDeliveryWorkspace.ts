import { useState, useEffect, useCallback } from 'react';
import { deliveryService } from '../services/DeliveryService';
import { DeliveryPackage, DeliveryVersionRef } from '@/types/deliveries';

export function useDeliveryWorkspace(deliveryId: string) {
  const [delivery, setDelivery] = useState<DeliveryPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDelivery = useCallback(async () => {
    if (!deliveryId) return;
    try {
      setLoading(true);
      const data = await deliveryService.getDeliveryById(deliveryId);
      if (!data) {
        setError('Delivery package not found');
      } else {
        setDelivery(data);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery workspace');
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  const prepare = async (actorName?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.prepareDelivery(deliveryId, actorName);
    setDelivery(updated);
    return updated;
  };

  const validate = async (actorName?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.validateDelivery(deliveryId, actorName);
    setDelivery(updated);
    return updated;
  };

  const submit = async (actorName?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.submitDelivery(deliveryId, actorName);
    setDelivery(updated);
    return updated;
  };

  const approve = async (actorName?: string, notes?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.approveDelivery(deliveryId, actorName, notes);
    setDelivery(updated);
    return updated;
  };

  const reject = async (reason: string, notes: string, actorName?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.rejectDelivery(deliveryId, reason, notes, actorName);
    setDelivery(updated);
    return updated;
  };

  const retry = async (actorName?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.retryDelivery(deliveryId, actorName);
    setDelivery(updated);
    return updated;
  };

  const complete = async (actorName?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.completeDelivery(deliveryId, actorName);
    setDelivery(updated);
    return updated;
  };

  const cancel = async (reason: string, actorName?: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.cancelDelivery(deliveryId, reason, actorName);
    setDelivery(updated);
    return updated;
  };

  const addVersion = async (version: DeliveryVersionRef) => {
    if (!deliveryId) return;
    const updated = await deliveryService.addVersionToDelivery(deliveryId, version);
    setDelivery(updated);
    return updated;
  };

  const removeVersion = async (versionId: string) => {
    if (!deliveryId) return;
    const updated = await deliveryService.removeVersionFromDelivery(deliveryId, versionId);
    setDelivery(updated);
    return updated;
  };

  return {
    delivery,
    loading,
    error,
    refresh: fetchDelivery,
    prepare,
    validate,
    submit,
    approve,
    reject,
    retry,
    complete,
    cancel,
    addVersion,
    removeVersion,
  };
}
