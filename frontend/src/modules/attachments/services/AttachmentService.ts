import { apiClient } from '@/api/client/ApiClient';
import { AttachmentItem } from '@/types/attachments';

export interface AttachmentQueryParams {
  entity_type?: string;
  entity_id?: string;
  category?: string;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export class AttachmentService {
  async getAttachments(params?: AttachmentQueryParams): Promise<AttachmentItem[]> {
    return apiClient.get<AttachmentItem[]>('/api/v1/attachments/', { params });
  }

  async getAttachmentById(id: string): Promise<AttachmentItem> {
    return apiClient.get<AttachmentItem>(`/api/v1/attachments/${id}/`);
  }

  async createAttachment(data: Partial<AttachmentItem>): Promise<AttachmentItem> {
    return apiClient.post<AttachmentItem>('/api/v1/attachments/', data);
  }

  async deleteAttachment(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/attachments/${id}/`);
  }
}

export const attachmentService = new AttachmentService();
