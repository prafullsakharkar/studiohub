import { apiClient } from '@/api/client/ApiClient';
import { MediaItem } from '@/types/media';

export interface MediaQueryParams {
  entity_type?: string;
  entity_id?: string;
  media_type?: string;
  project_id?: string;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export class MediaService {
  async getMediaList(params?: MediaQueryParams): Promise<MediaItem[]> {
    return apiClient.get<MediaItem[]>('/api/v1/media/', { params });
  }

  async getMediaById(id: string): Promise<MediaItem> {
    return apiClient.get<MediaItem>(`/api/v1/media/${id}/`);
  }

  async createMedia(data: Partial<MediaItem>): Promise<MediaItem> {
    return apiClient.post<MediaItem>('/api/v1/media/', data);
  }

  async updateMedia(id: string, data: Partial<MediaItem>): Promise<MediaItem> {
    return apiClient.patch<MediaItem>(`/api/v1/media/${id}/`, data);
  }

  async deleteMedia(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/media/${id}/`);
  }
}

export const mediaService = new MediaService();
