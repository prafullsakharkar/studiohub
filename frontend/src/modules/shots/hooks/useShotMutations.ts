import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shotService } from '../services/ShotService';
import { Shot } from '@/types/shots';
import { SHOT_QUERY_KEYS } from './useShots';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { PROJECT_QUERY_KEYS } from '@/modules/production/hooks/useProjects';

export function useShotMutations() {
  const queryClient = useQueryClient();
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
    },
  });

  return {
    createShot: createMutation.mutateAsync,
    updateShot: updateMutation.mutateAsync,
    approveShot: approveMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isApproving: approveMutation.isPending,
  };
}
