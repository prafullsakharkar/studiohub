import { useQuery } from '@tanstack/react-query';
import { attachmentService, AttachmentQueryParams } from '../services/AttachmentService';

export const ATTACHMENT_KEYS = {
  all: ['attachments'] as const,
  lists: () => [...ATTACHMENT_KEYS.all, 'list'] as const,
  list: (params?: AttachmentQueryParams) => [...ATTACHMENT_KEYS.lists(), params] as const,
  details: () => [...ATTACHMENT_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...ATTACHMENT_KEYS.details(), id] as const,
};

export const useAttachments = (params?: AttachmentQueryParams) => {
  return useQuery({
    queryKey: ATTACHMENT_KEYS.list(params),
    queryFn: () => attachmentService.getAttachments(params),
    staleTime: 1000 * 60 * 5,
  });
};

export const useAttachment = (id: string) => {
  return useQuery({
    queryKey: ATTACHMENT_KEYS.detail(id),
    queryFn: () => attachmentService.getAttachmentById(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
};
