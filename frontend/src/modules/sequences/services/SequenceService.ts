import { sequenceRepository, SequenceRepository } from '../repositories/SequenceRepository';
import { Sequence, SequenceFilterParams } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';
import { PaginatedResponse } from '@/types/common';

export class SequenceService {
  constructor(private repo: SequenceRepository = sequenceRepository) {}

  async getSequences(params?: SequenceFilterParams): Promise<PaginatedResponse<Sequence>> {
    return this.repo.findAll(params as any);
  }

  async getSequence(id: string): Promise<Sequence> {
    return this.repo.findById(id);
  }

  async createSequence(data: Partial<Sequence>): Promise<Sequence> {
    return this.repo.create(data);
  }

  async updateSequence(id: string, data: Partial<Sequence>): Promise<Sequence> {
    return this.repo.update(id, data);
  }

  async deleteSequence(id: string): Promise<void> {
    return this.repo.delete(id);
  }

  async archiveSequence(id: string): Promise<Sequence> {
    return this.repo.archiveSequence(id);
  }

  async restoreSequence(id: string): Promise<Sequence> {
    return this.repo.restoreSequence(id);
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Sequence>> {
    return this.repo.checkExistence(payload);
  }

  async bulkCreate(payload: BulkCreateRequest<Sequence>): Promise<BulkOperationResponse<Sequence>> {
    return this.repo.bulkCreate(payload);
  }

  async bulkUpdate(payload: BulkUpdateRequest<Sequence>): Promise<BulkOperationResponse<Sequence>> {
    return this.repo.bulkUpdate(payload);
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repo.bulkArchive(payload);
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repo.bulkRestore(payload);
  }
}

export const sequenceService = new SequenceService();
