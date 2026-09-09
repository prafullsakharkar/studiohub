import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';
import { IBaseRepository } from './IBaseRepository';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export abstract class BaseRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>>
  implements IBaseRepository<T, TCreate, TUpdate>
{
  protected client: IApiClient;
  protected basePath: string;

  constructor(basePath: string, client: IApiClient = apiClient) {
    this.basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    this.client = client;
  }

  async findAll(params?: QueryParams): Promise<PaginatedResponse<T>> {
    return this.client.get<PaginatedResponse<T>>(this.basePath, { params });
  }

  async findById(id: string): Promise<T> {
    return this.client.get<T>(`${this.basePath}${id}/`);
  }

  async create(data: TCreate): Promise<T> {
    return this.client.post<T>(this.basePath, data);
  }

  async update(id: string, data: TUpdate): Promise<T> {
    return this.client.put<T>(`${this.basePath}${id}/`, data);
  }

  async patch(id: string, data: Partial<TUpdate>): Promise<T> {
    return this.client.patch<T>(`${this.basePath}${id}/`, data);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${this.basePath}${id}/`);
  }

  async restore(id: string): Promise<T> {
    return this.client.post<T>(`${this.basePath}${id}/restore/`);
  }

  async bulkCreate(items: TCreate[]): Promise<T[]> {
    return this.client.post<T[]>(`${this.basePath}bulk/`, { items });
  }

  async bulkUpdate(items: (TUpdate & { id: string })[]): Promise<T[]> {
    return this.client.patch<T[]>(`${this.basePath}bulk/`, { items });
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.client.post(`${this.basePath}bulk-delete/`, { ids });
  }

  async search(query: string, params?: QueryParams): Promise<PaginatedResponse<T>> {
    return this.findAll({ ...params, search: query });
  }
}
