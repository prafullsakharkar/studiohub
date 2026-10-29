import { IRepository } from '../../interfaces/IRepository';
import { PaginatedResponse, QueryParams } from '@/types/common';
import { AppError } from '@/api/errors/AppError';
import { getApiBaseUrl } from '../../config';
import { tokenStorage } from '@/core/auth/tokenStorage';

/**
 * Base REST Adapter
 * Performs live network HTTP requests against a Django REST Framework (DRF) backend.
 * Automatically handles bearer auth tokens, serialization of query parameters,
 * and normalizes all server responses and network failures into uniform AppError instances.
 */
export class BaseRESTAdapter<T, TCreate = Partial<T>, TUpdate = Partial<T>>
  implements IRepository<T, TCreate, TUpdate>
{
  protected readonly basePath: string;

  constructor(basePath: string) {
    // Normalize base path so it always starts and ends with a slash (DRF convention)
    let path = basePath.trim();
    if (!path.startsWith('/')) path = `/${path}`;
    if (!path.endsWith('/')) path = `${path}/`;
    this.basePath = path;
  }

  /**
   * Helper to perform typed HTTP requests.
   *
   * Phase 11 (REST integration): requests are delegated to the shared
   * `ApiClient` so every REST call gets the same treatment — bearer token
   * injection + refresh, centralized error dispatch (401/403/404/429/5xx),
   * and DRF/contract normalization. No separate/raw fetch path, no silent
   * fallback to mock data.
   */
  protected async request<R>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<R> {
    // Lazy import to avoid a module initialization cycle (ApiClient imports converters).
    const { apiClient } = await import('@/api/client/ApiClient');

    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers as Record<string, string> | undefined;
    let body: unknown = options.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // leave as string
      }
    }

    const extra = { headers } as Record<string, unknown>;
    switch (method) {
      case 'GET':
        return apiClient.get<R>(endpoint, extra as never);
      case 'POST':
        return apiClient.post<R>(endpoint, body, extra as never);
      case 'PUT':
        return apiClient.put<R>(endpoint, body, extra as never);
      case 'PATCH':
        return apiClient.patch<R>(endpoint, body, extra as never);
      case 'DELETE':
        return apiClient.delete<R>(endpoint, extra as never);
      default:
        return apiClient.get<R>(endpoint, extra as never);
    }
  }

  /**
   * Serialize QueryParams into a query string for DRF endpoints
   */
  protected buildQueryString(params?: QueryParams): string {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });

    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  }

  async findAll(params?: QueryParams): Promise<PaginatedResponse<T>> {
    const queryString = this.buildQueryString(params);
    return this.request<PaginatedResponse<T>>(`${this.basePath}${queryString}`, {
      method: 'GET',
    });
  }

  async findById(id: string): Promise<T> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<T>(`${this.basePath}${cleanId}/`, {
      method: 'GET',
    });
  }

  async create(data: TCreate): Promise<T> {
    return this.request<T>(this.basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(id: string, data: TUpdate): Promise<T> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<T>(`${this.basePath}${cleanId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch(id: string, data: Partial<TUpdate>): Promise<T> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<T>(`${this.basePath}${cleanId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(id: string): Promise<void> {
    const cleanId = encodeURIComponent(id.trim());
    await this.request<void>(`${this.basePath}${cleanId}/`, {
      method: 'DELETE',
    });
  }

  async restore(id: string): Promise<T> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<T>(`${this.basePath}${cleanId}/restore/`, {
      method: 'POST',
    });
  }

  async search(query: string, params?: QueryParams): Promise<PaginatedResponse<T>> {
    return this.findAll({ ...params, search: query });
  }
}
