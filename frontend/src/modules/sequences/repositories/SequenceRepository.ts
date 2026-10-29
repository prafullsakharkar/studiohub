import { BaseRepository } from '@/core/repository/BaseRepository';
import { ISequenceRepository } from './ISequenceRepository';
import { Sequence } from '@/types/production';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export class SequenceRepository
  extends BaseRepository<Sequence, Partial<Sequence>, Partial<Sequence>>
  implements ISequenceRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/sequences', client);
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Sequence>> {
    return this.client.post<CheckExistenceResponse<Sequence>>(`${this.basePath}check-existence/`, payload);
  }

  override async bulkCreate(payload: any): Promise<any> {
    if (Array.isArray(payload)) {
      return super.bulkCreate(payload);
    }
    return this.client.post<BulkOperationResponse<Sequence>>(`${this.basePath}bulk-create/`, payload);
  }

  override async bulkUpdate(payload: any): Promise<any> {
    if (Array.isArray(payload)) {
      return super.bulkUpdate(payload);
    }
    return this.client.post<BulkOperationResponse<Sequence>>(`${this.basePath}bulk-update/`, payload);
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.client.post<any>(`${this.basePath}bulk-archive/`, payload);
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.client.post<any>(`${this.basePath}bulk-restore/`, payload);
  }

  async archiveSequence(id: string): Promise<Sequence> {
    return this.client.post<Sequence>(`${this.basePath}${id}/archive/`);
  }

  async restoreSequence(id: string): Promise<Sequence> {
    return this.client.post<Sequence>(`${this.basePath}${id}/restore/`);
  }
}

export const sequenceRepository = new SequenceRepository();
