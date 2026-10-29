import { BaseRepository } from '@/core/repository/BaseRepository';
import { IEpisodeRepository } from './IEpisodeRepository';
import { Episode } from '@/types/production';
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

export class EpisodeRepository
  extends BaseRepository<Episode, Partial<Episode>, Partial<Episode>>
  implements IEpisodeRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/episodes', client);
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Episode>> {
    return this.client.post<CheckExistenceResponse<Episode>>(`${this.basePath}check-existence/`, payload);
  }

  override async bulkCreate(payload: any): Promise<any> {
    if (Array.isArray(payload)) {
      return super.bulkCreate(payload);
    }
    return this.client.post<BulkOperationResponse<Episode>>(`${this.basePath}bulk-create/`, payload);
  }

  override async bulkUpdate(payload: any): Promise<any> {
    if (Array.isArray(payload)) {
      return super.bulkUpdate(payload);
    }
    return this.client.post<BulkOperationResponse<Episode>>(`${this.basePath}bulk-update/`, payload);
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.client.post<any>(`${this.basePath}bulk-archive/`, payload);
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.client.post<any>(`${this.basePath}bulk-restore/`, payload);
  }

  async archiveEpisode(id: string): Promise<Episode> {
    return this.client.post<Episode>(`${this.basePath}${id}/archive/`);
  }

  async restoreEpisode(id: string): Promise<Episode> {
    return this.client.post<Episode>(`${this.basePath}${id}/restore/`);
  }
}

export const episodeRepository = new EpisodeRepository();
