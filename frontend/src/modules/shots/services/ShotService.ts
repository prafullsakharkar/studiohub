import { IShotRepository, shotRepository } from '@/api/repositories';
import { Shot } from '@/types/production';
import { PaginatedResponse, QueryParams } from '@/types/common';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export class ShotService {
  private repository: IShotRepository;

  constructor(repository: IShotRepository = shotRepository) {
    this.repository = repository;
  }

  async getShots(params?: QueryParams): Promise<PaginatedResponse<Shot>> {
    return this.repository.findAll(params);
  }

  async getShotById(id: string): Promise<Shot> {
    return this.repository.findById(id);
  }

  async createShot(data: Partial<Shot>): Promise<Shot> {
    return this.repository.create(data);
  }

  async updateShot(id: string, data: Partial<Shot>): Promise<Shot> {
    return this.repository.patch(id, data);
  }

  async approveShot(id: string): Promise<Shot> {
    return this.repository.approveShot(id);
  }

  async archiveShot(id: string): Promise<Shot> {
    return this.repository.archiveShot(id);
  }

  async restoreShot(id: string): Promise<Shot> {
    return this.repository.restoreShot(id);
  }

  async deleteShot(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Shot>> {
    return this.repository.checkExistence(payload);
  }

  async bulkCreate(payload: BulkCreateRequest<Shot>): Promise<BulkOperationResponse<Shot>> {
    return this.repository.bulkCreate(payload);
  }

  async bulkUpdate(payload: BulkUpdateRequest<Shot>): Promise<BulkOperationResponse<Shot>> {
    return this.repository.bulkUpdate(payload);
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repository.bulkArchive(payload);
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repository.bulkRestore(payload);
  }
}

export const shotService = new ShotService();

