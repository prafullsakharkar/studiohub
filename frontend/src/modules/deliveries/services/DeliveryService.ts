import { ApiClient } from '@/api/client/ApiClient';
import {
  DeliveryPackage,
  DeliveryDestination,
  DeliveryVersionRef,
} from '@/types/deliveries';
import { mockDeliveryDestinations } from '@/mocks/db/production/deliveries';
import {
  BackendDeliveryDetail,
  BackendDeliveryList,
  mapDeliveryDetail,
  mapDeliveryList,
} from '../api/deliveryMapper';

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

class DeliveryService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient('/api/v1');
  }

  async getDeliveries(): Promise<DeliveryPackage[]> {
    const response = await this.apiClient.get<Paginated<BackendDeliveryList>>('/deliveries/', {
      params: { page_size: 200 },
    });
    const results = Array.isArray(response) ? response : response?.results ?? [];
    return results.map(mapDeliveryList);
  }

  async getDeliveryById(id: string): Promise<DeliveryPackage | null> {
    try {
      const detail = await this.apiClient.get<BackendDeliveryDetail>(`/deliveries/${id}/`);
      return mapDeliveryDetail(detail);
    } catch {
      return null;
    }
  }

  async getDestinations(): Promise<DeliveryDestination[]> {
    return [...mockDeliveryDestinations];
  }

  async createDelivery(data: Partial<DeliveryPackage>): Promise<DeliveryPackage> {
    const payload = {
      name: data.title || data.package_code || 'Untitled Delivery',
      code: data.package_code || `DEL-${Date.now()}`,
      project_id: data.project_id || null,
      client_id: data.client?.id || null,
      delivery_method: data.destination?.type === 'AWS S3 Bucket' ? 'S3' : 'Aspera',
      delivery_destination: data.destination?.endpoint || '',
      expires_at: data.due_date || null,
      notes: data.description || '',
      client_notes: '',
    };
    const created = await this.apiClient.post<BackendDeliveryDetail>('/deliveries/', payload);
    return mapDeliveryDetail(created);
  }

  async prepareDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    const detail = await this.apiClient.post<BackendDeliveryDetail>(`/deliveries/${id}/prepare/`);
    return mapDeliveryDetail(detail);
  }

  async validateDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    await this.apiClient.post(`/deliveries/${id}/validate/`);
    return this.getDeliveryById(id) as Promise<DeliveryPackage>;
  }

  async submitDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    await this.apiClient.post(`/deliveries/${id}/submit/`);
    return this.getDeliveryById(id) as Promise<DeliveryPackage>;
  }

  async approveDelivery(id: string, _actorName?: string, notes?: string): Promise<DeliveryPackage> {
    const detail = await this.apiClient.post<BackendDeliveryDetail>(`/deliveries/${id}/approve/`, {
      client_notes: notes || '',
    });
    return mapDeliveryDetail(detail);
  }

  async rejectDelivery(id: string, reason: string, notes?: string, _actorName?: string): Promise<DeliveryPackage> {
    const detail = await this.apiClient.post<BackendDeliveryDetail>(`/deliveries/${id}/reject/`, {
      rejection_reason: reason,
      client_notes: notes || '',
    });
    return mapDeliveryDetail(detail);
  }

  async retryDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    await this.apiClient.post(`/deliveries/${id}/prepare/`);
    return this.getDeliveryById(id) as Promise<DeliveryPackage>;
  }

  async completeDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    const detail = await this.apiClient.post<BackendDeliveryDetail>(`/deliveries/${id}/complete/`);
    return mapDeliveryDetail(detail);
  }

  async cancelDelivery(id: string, reason: string, _actorName?: string): Promise<DeliveryPackage> {
    const detail = await this.apiClient.post<BackendDeliveryDetail>(`/deliveries/${id}/cancel/`, {
      cancellation_reason: reason,
    });
    return mapDeliveryDetail(detail);
  }

  async addVersionToDelivery(id: string, version: DeliveryVersionRef): Promise<DeliveryPackage> {
    await this.apiClient.post(`/deliveries/${id}/add-version/`, {
      version_id: version.id,
      version_number: version.version_number,
      entity_type: version.entity_type,
      entity_code: version.entity_code,
      entity_name: version.entity_code,
      file_size_bytes: version.file_size_bytes || 0,
      frame_count: version.duration_frames || 0,
      file_path: '',
      checksum_sha256: version.checksum_sha256 || '',
    });
    return this.getDeliveryById(id) as Promise<DeliveryPackage>;
  }

  async removeVersionFromDelivery(id: string, _versionId: string): Promise<DeliveryPackage> {
    return this.getDeliveryById(id) as Promise<DeliveryPackage>;
  }
}

export const deliveryService = new DeliveryService();
