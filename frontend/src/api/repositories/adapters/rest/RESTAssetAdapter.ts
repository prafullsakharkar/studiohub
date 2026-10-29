import { BaseRESTAdapter } from './BaseRESTAdapter';
import { IAssetRepository } from '../../interfaces/IAssetRepository';
import { Asset } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export class RESTAssetAdapter
  extends BaseRESTAdapter<Asset, Partial<Asset>, Partial<Asset>>
  implements IAssetRepository
{
  constructor() {
    super('/api/v1/assets');
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Asset>> {
    return this.request<CheckExistenceResponse<Asset>>(`${this.basePath}check-existence/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkCreate(payload: BulkCreateRequest<Asset>): Promise<BulkOperationResponse<Asset>> {
    return this.request<BulkOperationResponse<Asset>>(`${this.basePath}bulk-create/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkUpdate(payload: BulkUpdateRequest<Asset>): Promise<BulkOperationResponse<Asset>> {
    return this.request<BulkOperationResponse<Asset>>(`${this.basePath}bulk-update/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Asset>> {
    return this.request<BulkOperationResponse<Asset>>(`${this.basePath}bulk-archive/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Asset>> {
    return this.request<BulkOperationResponse<Asset>>(`${this.basePath}bulk-restore/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async archiveAsset(id: string): Promise<Asset> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<Asset>(`${this.basePath}${cleanId}/archive/`, {
      method: 'POST',
    });
  }

  async restoreAsset(id: string): Promise<Asset> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<Asset>(`${this.basePath}${cleanId}/restore/`, {
      method: 'POST',
    });
  }
}
