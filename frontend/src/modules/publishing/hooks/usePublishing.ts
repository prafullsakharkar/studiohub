import { useState, useEffect, useCallback } from 'react';
import { publishingService } from '../services/PublishingService';
import { PublishItem, PublishDestination } from '@/types/publishing';

export function usePublishing() {
  const [publishes, setPublishes] = useState<PublishItem[]>([]);
  const [destinations, setDestinations] = useState<PublishDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublishes = useCallback(async () => {
    try {
      setLoading(true);
      const [items, dests] = await Promise.all([
        publishingService.getPublishes(),
        publishingService.getDestinations(),
      ]);
      setPublishes(items);
      setDestinations(dests);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load publish items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublishes();
  }, [fetchPublishes]);

  const handlePublish = async (data: Partial<PublishItem>) => {
    const created = await publishingService.createPublish(data);
    await fetchPublishes();
    return created;
  };

  const handleRepublish = async (id: string, comment: string, artistName: string) => {
    const updated = await publishingService.republish(id, comment, artistName);
    await fetchPublishes();
    return updated;
  };

  const handleUnpublish = async (id: string, reason: string, userName: string) => {
    const updated = await publishingService.unpublish(id, reason, userName);
    await fetchPublishes();
    return updated;
  };

  const handleValidate = async (id: string) => {
    const updated = await publishingService.validatePublish(id);
    await fetchPublishes();
    return updated;
  };

  const handleRetry = async (id: string) => {
    const updated = await publishingService.retryPublish(id);
    await fetchPublishes();
    return updated;
  };

  const handleDelete = async (id: string) => {
    await publishingService.deletePublish(id);
    await fetchPublishes();
  };

  return {
    publishes,
    destinations,
    loading,
    error,
    refresh: fetchPublishes,
    publish: handlePublish,
    republish: handleRepublish,
    unpublish: handleUnpublish,
    validate: handleValidate,
    retry: handleRetry,
    deletePublish: handleDelete,
  };
}
