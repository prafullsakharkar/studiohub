import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publishingService } from '../services/PublishingService';
import { PublishItem } from '@/types/publishing';
import { PUBLISHING_QUERY_KEYS } from './usePublishes';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function usePublishingMutations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: PUBLISHING_QUERY_KEYS.all });
  };

  const publishMutation = useMutation({
    mutationFn: (data: Partial<PublishItem>) => publishingService.createPublish(data),
    onSuccess: (created) => {
      invalidateAll();
      addNotification({
        type: 'success',
        title: 'Publish Submitted',
        message: `Publish "${created.publish_code || created.entity_name}" was submitted for processing.`,
      });
    },
  });

  const republishMutation = useMutation({
    mutationFn: ({ id, comment, artistName }: { id: string; comment: string; artistName: string }) =>
      publishingService.republish(id, comment, artistName),
    onSuccess: (updated) => {
      invalidateAll();
      addNotification({
        type: 'success',
        title: 'Republish Submitted',
        message: `Republish of "${updated.publish_code || updated.entity_name}" was submitted.`,
      });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: ({ id, reason, userName }: { id: string; reason: string; userName: string }) =>
      publishingService.unpublish(id, reason, userName),
    onSuccess: (updated) => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Publish Withdrawn',
        message: `"${updated.publish_code || updated.entity_name}" was unpublished.`,
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => publishingService.validatePublish(id),
    onSuccess: (updated) => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Validation Complete',
        message: `"${updated.publish_code || updated.entity_name}" passed pre-flight validation.`,
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => publishingService.retryPublish(id),
    onSuccess: (updated) => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Publish Retried',
        message: `"${updated.publish_code || updated.entity_name}" was re-queued.`,
      });
    },
  });

  const deletePublishMutation = useMutation({
    mutationFn: (id: string) => publishingService.deletePublish(id),
    onSuccess: () => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Publish Deleted',
        message: 'The publish record was removed.',
      });
    },
  });

  return {
    publish: publishMutation.mutateAsync,
    republish: republishMutation.mutateAsync,
    unpublish: unpublishMutation.mutateAsync,
    validatePublish: validateMutation.mutateAsync,
    retryPublish: retryMutation.mutateAsync,
    deletePublish: deletePublishMutation.mutateAsync,
    isPublishing: publishMutation.isPending,
  };
}
