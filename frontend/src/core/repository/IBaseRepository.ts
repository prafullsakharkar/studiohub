import { PaginatedResponse, QueryParams } from '@/types/drf';

export interface IBaseRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  findAll(params?: QueryParams): Promise<PaginatedResponse<T>>;
  findById(id: string): Promise<T>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  patch(id: string, data: Partial<TUpdate>): Promise<T>;
  delete(id: string): Promise<void>;
  restore?(id: string): Promise<T>;
  bulkCreate?(items: TCreate[]): Promise<T[]>;
  bulkUpdate?(items: (TUpdate & { id: string })[]): Promise<T[]>;
  bulkDelete?(ids: string[]): Promise<void>;
  search?(query: string, params?: QueryParams): Promise<PaginatedResponse<T>>;
}
