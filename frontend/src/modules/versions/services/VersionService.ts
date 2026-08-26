import { apiClient } from '@/api/client/ApiClient';
import { ProductionVersion } from '@/types/versions';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export class VersionService {
  async getVersions(params?: QueryParams): Promise<PaginatedResponse<ProductionVersion>> {
    return apiClient.get<PaginatedResponse<ProductionVersion>>('/api/v1/versions/', { params });
  }

  async getVersionById(id: string): Promise<ProductionVersion> {
    return apiClient.get<ProductionVersion>(`/api/v1/versions/${id}/`);
  }

  async createVersion(data: Partial<ProductionVersion>): Promise<ProductionVersion> {
    return apiClient.post<ProductionVersion>('/api/v1/versions/', data);
  }

  async updateVersion(id: string, data: Partial<ProductionVersion>): Promise<ProductionVersion> {
    return apiClient.patch<ProductionVersion>(`/api/v1/versions/${id}/`, data);
  }

  async deleteVersion(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/versions/${id}/`);
  }

  async publishVersion(id: string, payload?: { dcc_software?: string; publisher_name?: string; comment?: string }): Promise<ProductionVersion> {
    return apiClient.post<ProductionVersion>(`/api/v1/versions/${id}/publish/`, payload || {});
  }

  async unpublishVersion(id: string, payload?: { user_name?: string }): Promise<ProductionVersion> {
    return apiClient.post<ProductionVersion>(`/api/v1/versions/${id}/unpublish/`, payload || {});
  }

  async archiveVersion(id: string): Promise<ProductionVersion> {
    return apiClient.post<ProductionVersion>(`/api/v1/versions/${id}/archive/`, {});
  }

  async addToPlaylist(id: string, payload: { playlist_id: string; playlist_name?: string; playlist_type?: string }): Promise<ProductionVersion> {
    return apiClient.post<ProductionVersion>(`/api/v1/versions/${id}/add-to-playlist/`, payload);
  }
}

export const versionService = new VersionService();
