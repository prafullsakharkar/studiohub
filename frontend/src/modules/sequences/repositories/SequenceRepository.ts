import { BaseRepository } from '@/core/repository/BaseRepository';
import { ISequenceRepository } from './ISequenceRepository';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';
import {
  BulkResponse,
  ExistenceResponse,
  Sequence,
  SequenceInput,
  SequenceUpdateInput,
} from '@/types/sequences';
import { PaginatedResponse, QueryParams } from '@/types/drf';

/**
 * Sequence repository.
 *
 * Standard CRUD reuses `BaseRepository`. Bulk operations are custom
 * `@action` endpoints on the backend (`/api/v1/sequences/bulk-create/`,
 * `bulk-update/`, `bulk-archive/`, `bulk-restore/`, `existence-check/`) that
 * return a per-item envelope rather than the generic `T[]`, so they are
 * implemented directly against the client here.
 */
class SequenceCrud extends BaseRepository<Sequence, SequenceInput, SequenceUpdateInput> {}

export class SequenceRepository implements ISequenceRepository {
  protected client: IApiClient;
  protected basePath: string;
  private crud: SequenceCrud;

  constructor(client: IApiClient = apiClient) {
    this.client = client;
    this.basePath = '/api/v1/sequences/';
    this.crud = new SequenceCrud(this.basePath, client);
  }

  // ---- Standard CRUD (delegated) --------------------------------------

  findAll(params?: QueryParams): Promise<PaginatedResponse<Sequence>> {
    return this.crud.findAll(params);
  }

  findById(id: string): Promise<Sequence> {
    return this.crud.findById(id);
  }

  create(data: SequenceInput): Promise<Sequence> {
    return this.crud.create(data);
  }

  update(id: string, data: SequenceUpdateInput): Promise<Sequence> {
    return this.crud.update(id, data);
  }

  patch(id: string, data: Partial<SequenceUpdateInput>): Promise<Sequence> {
    return this.crud.patch(id, data);
  }

  delete(id: string): Promise<void> {
    return this.crud.delete(id);
  }

  restore(id: string): Promise<Sequence> {
    return this.crud.restore(id);
  }

  search(query: string, params?: QueryParams): Promise<PaginatedResponse<Sequence>> {
    return this.crud.search(query, params);
  }

  // ---- Bulk operations (custom backend endpoints) ----------------------

  async bulkCreate(items: SequenceInput[]): Promise<BulkResponse> {
    return this.client.post<BulkResponse>(`${this.basePath}bulk-create/`, { items });
  }

  async bulkUpdate(items: SequenceUpdateInput[]): Promise<BulkResponse> {
    return this.client.patch<BulkResponse>(`${this.basePath}bulk-update/`, { items });
  }

  async bulkArchive(ids: string[]): Promise<BulkResponse> {
    return this.client.post<BulkResponse>(`${this.basePath}bulk-archive/`, { ids });
  }

  async bulkRestore(ids: string[]): Promise<BulkResponse> {
    return this.client.post<BulkResponse>(`${this.basePath}bulk-restore/`, { ids });
  }

  async existenceCheck(
    items: Array<Pick<SequenceInput, 'project_id' | 'code'>>
  ): Promise<ExistenceResponse> {
    return this.client.post<ExistenceResponse>(`${this.basePath}existence-check/`, { items });
  }

  async getArchived(params?: QueryParams): Promise<PaginatedResponse<Sequence>> {
    return this.client.get<PaginatedResponse<Sequence>>(`${this.basePath}archived/`, {
      params,
    });
  }
}

export const sequenceRepository = new SequenceRepository();
