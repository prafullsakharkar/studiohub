import { BaseRESTAdapter } from './BaseRESTAdapter';
import { IShotRepository } from '../../interfaces/IShotRepository';
import { Shot } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export class RESTShotAdapter
  extends BaseRESTAdapter<Shot, Partial<Shot>, Partial<Shot>>
  implements IShotRepository
{
  constructor() {
    super('/api/v1/shots');
  }

  async approveShot(id: string): Promise<Shot> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<Shot>(`${this.basePath}${cleanId}/approve/`, {
      method: 'POST',
    });
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Shot>> {
    return this.request<CheckExistenceResponse<Shot>>(`${this.basePath}check-existence/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkCreate(payload: BulkCreateRequest<Shot>): Promise<BulkOperationResponse<Shot>> {
    return this.request<BulkOperationResponse<Shot>>(`${this.basePath}bulk-create/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkUpdate(payload: BulkUpdateRequest<Shot>): Promise<BulkOperationResponse<Shot>> {
    return this.request<BulkOperationResponse<Shot>>(`${this.basePath}bulk-update/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Shot>> {
    return this.request<BulkOperationResponse<Shot>>(`${this.basePath}bulk-archive/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Shot>> {
    return this.request<BulkOperationResponse<Shot>>(`${this.basePath}bulk-restore/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async archiveShot(id: string): Promise<Shot> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<Shot>(`${this.basePath}${cleanId}/archive/`, {
      method: 'POST',
    });
  }

  async restoreShot(id: string): Promise<Shot> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<Shot>(`${this.basePath}${cleanId}/restore/`, {
      method: 'POST',
    });
  }
}
