import { ISequenceRepository } from '../repositories/ISequenceRepository';
import { sequenceRepository } from '../repositories/SequenceRepository';
import {
  BulkResponse,
  ExistenceResponse,
  Sequence,
  SequenceInput,
  SequenceUpdateInput,
} from '@/types/sequences';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export class SequenceService {
  private repository: ISequenceRepository;

  constructor(repository: ISequenceRepository = sequenceRepository) {
    this.repository = repository;
  }

  async getSequences(params?: QueryParams): Promise<PaginatedResponse<Sequence>> {
    return this.repository.findAll(params);
  }

  async getArchived(params?: QueryParams): Promise<PaginatedResponse<Sequence>> {
    return this.repository.getArchived(params);
  }

  async getSequenceById(id: string): Promise<Sequence> {
    return this.repository.findById(id);
  }

  async createSequence(data: SequenceInput): Promise<Sequence> {
    return this.repository.create(data);
  }

  async updateSequence(id: string, data: Partial<SequenceUpdateInput>): Promise<Sequence> {
    return this.repository.patch(id, data);
  }

  async restoreSequence(id: string): Promise<Sequence> {
    return this.repository.restore(id);
  }

  async bulkCreate(items: SequenceInput[]): Promise<BulkResponse> {
    return this.repository.bulkCreate(items);
  }

  async bulkUpdate(items: SequenceUpdateInput[]): Promise<BulkResponse> {
    return this.repository.bulkUpdate(items);
  }

  async bulkArchive(ids: string[]): Promise<BulkResponse> {
    return this.repository.bulkArchive(ids);
  }

  async bulkRestore(ids: string[]): Promise<BulkResponse> {
    return this.repository.bulkRestore(ids);
  }

  async existenceCheck(
    items: Array<Pick<SequenceInput, 'project_id' | 'code'>>
  ): Promise<ExistenceResponse> {
    return this.repository.existenceCheck(items);
  }
}

export const sequenceService = new SequenceService();
