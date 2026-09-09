import { ApiClient } from '@/api/client/ApiClient';
import { PublishItem, PublishStatus, PublishDestination, PublishActivity } from '@/types/publishing';
import {
  BackendPublishDetail,
  BackendPublishList,
  mapPublishDetail,
  mapPublishList,
  mapPublishStatus,
} from '../api/publishingMapper';

class PublishingService {
  private client = new ApiClient('/api/v1');

  async getPublishes(): Promise<PublishItem[]> {
    const data = await this.client.get<{ results: BackendPublishList[] }>('/publishing/', {
      params: { page_size: 200 },
    });
    return mapPublishList(data.results || []);
  }

  async getPublishById(id: string): Promise<PublishItem | null> {
    try {
      const data = await this.client.get<BackendPublishDetail>(`/publishing/${id}/`);
      return mapPublishDetail(data);
    } catch {
      return null;
    }
  }

  async getDestinations(): Promise<PublishDestination[]> {
    const data = await this.client.get<{ results: PublishDestination[] }>('/publishing/destinations/', {
      params: { page_size: 100 },
    });
    return data.results || [];
  }

  async createPublish(data: Partial<PublishItem>): Promise<PublishItem> {
    const payload = {
      name: data.entity_name || data.publish_code || data.entity_code,
      code: data.publish_code || `PUB-${data.project_code || 'NK99'}-${Date.now().toString().slice(-4)}`,
      project_id: data.project_id || null,
      entity_type: data.entity_type || 'Shot',
      entity_id: data.entity_id || `shot-${Date.now().toString().slice(-4)}`,
      entity_code: data.entity_code || 'SH010',
      entity_name: data.entity_name || 'Shot',
      dcc_tool: data.dcc_software || 'Nuke',
      dcc_version: data.dcc_version || '15.0v2',
      source_file: data.dcc_file_path || '',
      source_version: data.version_number || 'v001',
      export_path: data.output_path || '',
      export_format: 'EXR',
    };
    const created = await this.client.post<BackendPublishDetail>('/publishing/', payload);
    return mapPublishDetail(created);
  }

  async validatePublish(id: string): Promise<PublishItem> {
    const result = await this.client.post<any>(`/publishing/${id}/validate/`, {});
    if (result && result.id) return mapPublishDetail(result as BackendPublishDetail);
    return this.refresh(id);
  }

  async republish(id: string, comment: string, artistName: string): Promise<PublishItem> {
    const created = await this.client.post<BackendPublishDetail>(`/publishing/${id}/republish/`, {});
    return mapPublishDetail(created);
  }

  async unpublish(id: string, reason: string, userName: string): Promise<PublishItem> {
    const updated = await this.client.post<BackendPublishDetail>(`/publishing/${id}/unpublish/`, {});
    return mapPublishDetail(updated);
  }

  async retryPublish(id: string): Promise<PublishItem> {
    const updated = await this.client.post<BackendPublishDetail>(`/publishing/${id}/retry/`, {});
    return mapPublishDetail(updated);
  }

  async deletePublish(id: string): Promise<void> {
    await this.client.delete(`/publishing/${id}/`);
  }

  private async refresh(id: string): Promise<PublishItem> {
    const item = await this.getPublishById(id);
    if (!item) throw new Error('Publish item not found');
    return item;
  }
}

export const publishingService = new PublishingService();
