import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaService } from '../services/MediaService';
import { MEDIA_KEYS } from './useMedia';
import { MediaItem } from '@/types/media';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const useMediaMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createMutation = useMutation({
    mutationFn: (data: Partial<MediaItem>) => mediaService.createMedia(data),
    onSuccess: (newMedia) => {
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Media Uploaded',
        message: `Media item "${newMedia.name}" successfully registered in storage tier.`,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MediaItem> }) =>
      mediaService.updateMedia(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Media Updated',
        message: `Media "${updated.name}" metadata updated.`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaService.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Media Removed',
        message: 'Media asset detached from storage index.',
      });
    },
  });

  return {
    createMedia: createMutation.mutateAsync,
    updateMedia: updateMutation.mutateAsync,
    deleteMedia: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
