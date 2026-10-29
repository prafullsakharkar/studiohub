import { useMutation, useQueryClient } from '@tanstack/react-query';
import { episodeService } from '../services/EpisodeService';
import { Episode } from '@/types/production';
import { EPISODE_QUERY_KEYS } from './useEpisodes';
import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { SEQUENCE_QUERY_KEYS } from '@/modules/sequences';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';

export function useEpisodeMutations() {
  const queryClient = useQueryClient();
  const recordActivity = useActivityStore((state) => state.recordActivity);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Episode>) => episodeService.createEpisode(data),
    onSuccess: (newEp) => {
      queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({
        type: 'success',
        title: 'Episode Created',
        message: `Episode ${newEp.code} registered to project.`,
      });

      recordActivity({
        action: 'created',
        actionLabel: 'Created Episode',
        resourceType: 'episode',
        resourceId: newEp.id,
        resourceName: newEp.name,
        resourceCode: newEp.code,
        projectId: newEp.project_id,
        context: newEp.project_code,
        description: `Created episode ${newEp.code} (${newEp.name})`,
        tags: ['Episode', 'Creation'],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Episode> }) =>
      episodeService.updateEpisode(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({
        type: 'info',
        title: 'Episode Updated',
        message: `Episode ${updated.code} updated.`,
      });

      recordActivity({
        action: 'updated',
        actionLabel: 'Updated Episode',
        resourceType: 'episode',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        projectId: updated.project_id,
        context: updated.project_code,
        description: `Updated episode ${updated.code} (${updated.name})`,
        tags: ['Episode', 'Update'],
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => episodeService.archiveEpisode(id),
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({
        type: 'warning',
        title: 'Episode Archived',
        message: `Episode ${archived.code} archived.`,
      });

      recordActivity({
        action: 'archived',
        actionLabel: 'Archived Episode',
        resourceType: 'episode',
        resourceId: archived.id,
        resourceName: archived.name,
        resourceCode: archived.code,
        projectId: archived.project_id,
        context: archived.project_code,
        description: `Archived episode ${archived.code} (${archived.name})`,
        tags: ['Episode', 'Archive'],
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => episodeService.restoreEpisode(id),
    onSuccess: (restored) => {
      queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({
        type: 'success',
        title: 'Episode Restored',
        message: `Episode ${restored.code} restored to active slate.`,
      });

      recordActivity({
        action: 'restored',
        actionLabel: 'Restored Episode',
        resourceType: 'episode',
        resourceId: restored.id,
        resourceName: restored.name,
        resourceCode: restored.code,
        projectId: restored.project_id,
        context: restored.project_code,
        description: `Restored episode ${restored.code} (${restored.name})`,
        tags: ['Episode', 'Restore'],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => episodeService.deleteEpisode(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({
        type: 'error',
        title: 'Episode Removed',
        message: 'Episode removed from database.',
      });

      recordActivity({
        action: 'deleted',
        actionLabel: 'Deleted Episode',
        resourceType: 'episode',
        resourceId: deletedId,
        resourceName: 'Deleted Episode',
        description: `Deleted episode ID: ${deletedId}`,
        tags: ['Episode', 'Deletion'],
      });
    },
  });

  return {
    createEpisode: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,

    updateEpisode: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,

    archiveEpisode: archiveMutation.mutateAsync,
    isArchiving: archiveMutation.isPending,

    restoreEpisode: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,

    deleteEpisode: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
