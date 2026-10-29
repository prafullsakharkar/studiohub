import { SHOT_QUERY_KEYS } from '@/modules/shots';

import { PROJECT_QUERY_KEYS } from '@/modules/production';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sequenceService } from '../services/SequenceService';

import { Sequence } from '@/types/production';

import { SEQUENCE_QUERY_KEYS } from './useSequences';

import { useNotificationStore } from '@/shared/stores/useNotificationStore';

import { useActivityStore } from '@/shared/stores/useActivityStore';

export function useSequenceMutations() {

  const queryClient = useQueryClient();
  const recordActivity = useActivityStore((state) => state.recordActivity);

  const addNotification = useNotificationStore((state) => state.addNotification);

  const createMutation = useMutation({

    mutationFn: (data: Partial<Sequence>) => sequenceService.createSequence(data),

    onSuccess: (newSeq) => {

      queryClient.invalidateQueries({ queryKey: SEQUENCE_QUERY_KEYS.all });

      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({

        type: 'success',

        title: 'Sequence Created',

        message: `Sequence ${newSeq.code} registered to project.`,

      });

      recordActivity({

        action: 'created',

        actionLabel: 'Created Sequence',

        resourceType: 'sequence',

        resourceId: newSeq.id,

        resourceName: newSeq.name,

        resourceCode: newSeq.code,

        projectId: newSeq.project_id,

        context: newSeq.project_code,

        description: `Created sequence ${newSeq.code} (${newSeq.name})`,

        tags: ['Sequence', 'Creation'],

      });

    },

  });

  const updateMutation = useMutation({

    mutationFn: ({ id, data }: { id: string; data: Partial<Sequence> }) =>

      sequenceService.updateSequence(id, data),

    onSuccess: (updated) => {

      queryClient.invalidateQueries({ queryKey: SEQUENCE_QUERY_KEYS.all });

      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({

        type: 'info',

        title: 'Sequence Updated',

        message: `Sequence ${updated.code} updated.`,

      });

      recordActivity({

        action: 'updated',

        actionLabel: 'Updated Sequence',

        resourceType: 'sequence',

        resourceId: updated.id,

        resourceName: updated.name,

        resourceCode: updated.code,

        projectId: updated.project_id,

        context: updated.project_code,

        description: `Updated sequence ${updated.code}`,

        tags: ['Sequence', 'Update'],

      });

    },

  });

  const archiveMutation = useMutation({

    mutationFn: (id: string) => sequenceService.archiveSequence(id),

    onSuccess: (archived) => {

      queryClient.invalidateQueries({ queryKey: SEQUENCE_QUERY_KEYS.all });

      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });

      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({

        type: 'warning',

        title: 'Sequence Archived',

        message: `Sequence ${archived.code} was soft-deleted / archived.`,

      });

      recordActivity({

        action: 'archived',

        actionLabel: 'Archived Sequence',

        resourceType: 'sequence',

        resourceId: archived.id,

        resourceName: archived.name,

        resourceCode: archived.code,

        projectId: archived.project_id,

        context: archived.project_code,

        description: `Archived sequence ${archived.code}`,

        tags: ['Sequence', 'Archive'],

      });

    },

  });

  const restoreMutation = useMutation({

    mutationFn: (id: string) => sequenceService.restoreSequence(id),

    onSuccess: (restored) => {

      queryClient.invalidateQueries({ queryKey: SEQUENCE_QUERY_KEYS.all });

      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });

      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });

      addNotification({

        type: 'success',

        title: 'Sequence Restored',

        message: `Sequence ${restored.code} has been restored to active production.`,

      });

      recordActivity({

        action: 'restored',

        actionLabel: 'Restored Sequence',

        resourceType: 'sequence',

        resourceId: restored.id,

        resourceName: restored.name,

        resourceCode: restored.code,

        projectId: restored.project_id,

        context: restored.project_code,

        description: `Restored sequence ${restored.code}`,

        tags: ['Sequence', 'Recovery'],

      });

    },

  });

  return {

    createSequence: createMutation.mutateAsync,

    updateSequence: updateMutation.mutateAsync,

    archiveSequence: archiveMutation.mutateAsync,

    restoreSequence: restoreMutation.mutateAsync,

    isCreating: createMutation.isPending,

    isUpdating: updateMutation.isPending,

    isArchiving: archiveMutation.isPending,

    isRestoring: restoreMutation.isPending,

  };

}
