import { PaginatedResponse, QueryParams } from '@/types/common';

/**
 * Generic Base Repository Interface
 * Defines standard CRUD and querying operations for all entity repositories.
 */
export interface IRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  /**
   * Fetch a paginated list of entities matching optional query/filter criteria
   */
  findAll(params?: QueryParams): Promise<PaginatedResponse<T>>;

  /**
   * Retrieve an entity by its unique ID
   */
  findById(id: string): Promise<T>;

  /**
   * Create a new entity record
   */
  create(data: TCreate): Promise<T>;

  /**
   * Replace/update an existing entity record by ID
   */
  update(id: string, data: TUpdate): Promise<T>;

  /**
   * Partially patch an existing entity record by ID
   */
  patch(id: string, data: Partial<TUpdate>): Promise<T>;

  /**
   * Delete an entity record by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Soft-delete restore an entity record (if supported by entity)
   */
  restore?(id: string): Promise<T>;

  /**
   * Perform free-text search across entity records
   */
  search?(query: string, params?: QueryParams): Promise<PaginatedResponse<T>>;
}
