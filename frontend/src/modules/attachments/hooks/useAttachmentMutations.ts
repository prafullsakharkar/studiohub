import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentService } from '../services/AttachmentService';
import { ATTACHMENT_KEYS } from './useAttachments';
import { AttachmentItem } from '@/types/attachments';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const useAttachmentMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createMutation = useMutation({
    mutationFn: (data: Partial<AttachmentItem>) => attachmentService.createAttachment(data),
    onSuccess: (newAtt) => {
      queryClient.invalidateQueries({ queryKey: ATTACHMENT_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Attachment Uploaded',
        message: `File "${newAtt.file_name}" attached successfully.`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Upload Failed',
        message: err.message || 'Failed to upload attachment.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => attachmentService.deleteAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTACHMENT_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Attachment Removed',
        message: 'Attachment unlinked and deleted from storage manifest.',
      });
    },
  });

  return {
    createAttachment: createMutation.mutateAsync,
    deleteAttachment: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
