import { episodeRepository, EpisodeRepository } from '../repositories/EpisodeRepository';
import { Episode, EpisodeFilterParams } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';
import { PaginatedResponse } from '@/types/common';

export class EpisodeService {
  constructor(private repo: EpisodeRepository = episodeRepository) {}

  async getEpisodes(params?: EpisodeFilterParams): Promise<PaginatedResponse<Episode>> {
    return this.repo.findAll(params as any);
  }

  async getEpisode(id: string): Promise<Episode> {
    return this.repo.findById(id);
  }

  async createEpisode(data: Partial<Episode>): Promise<Episode> {
    return this.repo.create(data);
  }

  async updateEpisode(id: string, data: Partial<Episode>): Promise<Episode> {
    return this.repo.update(id, data);
  }

  async deleteEpisode(id: string): Promise<void> {
    return this.repo.delete(id);
  }

  async archiveEpisode(id: string): Promise<Episode> {
    return this.repo.archiveEpisode(id);
  }

  async restoreEpisode(id: string): Promise<Episode> {
    return this.repo.restoreEpisode(id);
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Episode>> {
    return this.repo.checkExistence(payload);
  }

  async bulkCreate(payload: BulkCreateRequest<Episode>): Promise<BulkOperationResponse<Episode>> {
    return this.repo.bulkCreate(payload);
  }

  async bulkUpdate(payload: BulkUpdateRequest<Episode>): Promise<BulkOperationResponse<Episode>> {
    return this.repo.bulkUpdate(payload);
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repo.bulkArchive(payload);
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repo.bulkRestore(payload);
  }
}

export const episodeService = new EpisodeService();
