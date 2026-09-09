import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sequenceService } from '../services/SequenceService';
import { Sequence, SequenceInput, SequenceUpdateInput } from '@/types/sequences';
import { SEQUENCE_QUERY_KEYS } from './useSequences';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { PROJECT_QUERY_KEYS } from '@/modules/production/hooks/useProjects';

export function useSequenceMutations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: SEQUENCE_QUERY_KEYS.all });
    queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
  };

  const createMutation = useMutation({
    mutationFn: (data: SequenceInput) => sequenceService.createSequence(data),
    onSuccess: (created) => {
      invalidateAll();
      addNotification({
        type: 'success',
        title: 'Sequence Created',
        message: `Sequence ${created.code} registered to project ${created.project_code}.`,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SequenceUpdateInput> }) =>
      sequenceService.updateSequence(id, data),
    onSuccess: (updated) => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Sequence Updated',
        message: `Sequence ${updated.code} updated.`,
      });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (items: SequenceInput[]) => sequenceService.bulkCreate(items),
    onSuccess: (response) => {
      invalidateAll();
      addNotification({
        type: 'success',
        title: 'Bulk Create Complete',
        message: `${response.successful} created, ${response.failed} failed.`,
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (items: SequenceUpdateInput[]) => sequenceService.bulkUpdate(items),
    onSuccess: (response) => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Bulk Update Complete',
        message: `${response.successful} updated, ${response.failed} failed.`,
      });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (ids: string[]) => sequenceService.bulkArchive(ids),
    onSuccess: (response) => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Sequences Archived',
        message: `${response.successful} archived, ${response.failed} failed.`,
      });
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: string[]) => sequenceService.bulkRestore(ids),
    onSuccess: (response) => {
      invalidateAll();
      addNotification({
        type: 'success',
        title: 'Sequences Restored',
        message: `${response.successful} restored, ${response.failed} failed.`,
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => sequenceService.restoreSequence(id),
    onSuccess: (restored) => {
      invalidateAll();
      addNotification({
        type: 'success',
        title: 'Sequence Restored',
        message: `Sequence ${restored.code} restored from archive.`,
      });
    },
  });

  const existenceCheckMutation = useMutation({
    mutationFn: (items: Array<Pick<SequenceInput, 'project_id' | 'code'>>) =>
      sequenceService.existenceCheck(items),
  });

  return {
    createSequence: createMutation.mutateAsync,
    updateSequence: updateMutation.mutateAsync,
    bulkCreate: bulkCreateMutation.mutateAsync,
    bulkUpdate: bulkUpdateMutation.mutateAsync,
    bulkArchive: bulkArchiveMutation.mutateAsync,
    bulkRestore: bulkRestoreMutation.mutateAsync,
    restoreSequence: restoreMutation.mutateAsync,
    existenceCheck: existenceCheckMutation.mutateAsync,
    isCheckingExistence: existenceCheckMutation.isPending,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isBulkCreating: bulkCreateMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
    isBulkArchiving: bulkArchiveMutation.isPending,
    isBulkRestoring: bulkRestoreMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}
