import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shotService } from '../services/ShotService';
import { Shot } from '@/types/production';
import { SHOT_QUERY_KEYS } from './useShots';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
;
import { useActivityStore } from '@/shared/stores/useActivityStore';

export function useShotMutations() {
  const queryClient = useQueryClient();
  const recordActivity = useActivityStore((state) => state.recordActivity);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Shot>) => shotService.createShot(data),
    onSuccess: (newShot) => {
      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Shot Created',
        message: `Shot ${newShot.code} registered to sequence.`,
      });

      recordActivity({
        action: 'created',
        actionLabel: 'Shot Created',
        resourceType: 'shot',
        resourceId: newShot.id,
        resourceName: newShot.name || newShot.code,
        resourceCode: newShot.code,
        projectId: newShot.project_id,
        context: newShot.sequence_code || newShot.project_code,
        description: `Registered shot ${newShot.code} to sequence ${newShot.sequence_code || 'pipeline'}.`,
        tags: ['Shot', 'Creation'],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Shot> }) =>
      shotService.updateShot(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Shot Updated',
        message: `Shot ${updated.code} status updated.`,
      });

      recordActivity({
        action: 'updated',
        actionLabel: 'Shot Updated',
        resourceType: 'shot',
        resourceId: updated.id,
        resourceName: updated.name || updated.code,
        resourceCode: updated.code,
        projectId: updated.project_id,
        context: updated.sequence_code || updated.project_code,
        description: `Updated shot ${updated.code} (Status: ${updated.status || 'Active'}).`,
        tags: ['Shot', 'Update'],
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => shotService.approveShot(id),
    onSuccess: (approvedShot) => {
      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Shot Approved',
        message: `Supervisor approved shot ${approvedShot.code}. Final delivery package unlocked.`,
      });

      recordActivity({
        action: 'approved',
        actionLabel: 'Shot Approved',
        resourceType: 'shot',
        resourceId: approvedShot.id,
        resourceName: approvedShot.name || approvedShot.code,
        resourceCode: approvedShot.code,
        projectId: approvedShot.project_id,
        context: approvedShot.sequence_code || approvedShot.project_code,
        description: `Supervisor approved shot ${approvedShot.code}. Final turnover package validated.`,
        diffs: [{ field: 'status', label: 'Status', before: 'Review', after: 'Approved' }],
        tags: ['Shot', 'Approval'],
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => shotService.archiveShot(id),
    onSuccess: (archivedShot) => {
      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Shot Archived',
        message: `Shot ${archivedShot.code} moved to archive.`,
      });

      recordActivity({
        action: 'archived',
        actionLabel: 'Shot Archived',
        resourceType: 'shot',
        resourceId: archivedShot.id,
        resourceName: archivedShot.name || archivedShot.code,
        resourceCode: archivedShot.code,
        projectId: archivedShot.project_id,
        context: archivedShot.sequence_code || archivedShot.project_code,
        description: `Archived shot ${archivedShot.code}.`,
        tags: ['Shot', 'Archive'],
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => shotService.restoreShot(id),
    onSuccess: (restoredShot) => {
      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Shot Restored',
        message: `Shot ${restoredShot.code} restored to active pipeline.`,
      });

      recordActivity({
        action: 'restored',
        actionLabel: 'Shot Restored',
        resourceType: 'shot',
        resourceId: restoredShot.id,
        resourceName: restoredShot.name || restoredShot.code,
        resourceCode: restoredShot.code,
        projectId: restoredShot.project_id,
        context: restoredShot.sequence_code || restoredShot.project_code,
        description: `Restored shot ${restoredShot.code}.`,
        tags: ['Shot', 'Restore'],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shotService.deleteShot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'warning',
        title: 'Shot Deleted',
        message: 'Shot was permanently removed.',
      });
    },
  });

  return {
    createShot: createMutation.mutateAsync,
    updateShot: updateMutation.mutateAsync,
    approveShot: approveMutation.mutateAsync,
    archiveShot: archiveMutation.mutateAsync,
    restoreShot: restoreMutation.mutateAsync,
    deleteShot: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isApproving: approveMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
