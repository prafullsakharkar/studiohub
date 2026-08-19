import ky, { KyInstance, Options as KyOptions } from 'ky';
import { IApiClient, RequestOptions } from './types';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { ApiError } from '@/api/errors/ApiError';
import { mapHttpError } from '@/api/errors/errorMapper';
import { logger } from '@/core/logging/logger';
import { DrfErrorResponse } from '@/types/drf';
import { dispatchMockRequest } from '@/mocks/mockRouter';

export class ApiClient implements IApiClient {
  private client: KyInstance;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor(prefix = '') {
    this.client = ky.create({
      prefix: prefix || undefined,
      timeout: 30000,
      retry: {
        limit: 2,
        methods: ['get'],
        statusCodes: [408, 502, 503, 504],
      },
      hooks: {
        beforeRequest: [
          ({ request, options }: any) => {
            const skipAuth = (options as RequestOptions)?.skipAuth;
            if (!skipAuth) {
              const token = tokenStorage.getAccessToken();
              if (token) {
                request.headers.set('Authorization', `Bearer ${token}`);
              }
              const activeOrgId = typeof localStorage !== 'undefined' ? localStorage.getItem('studiohub_active_org_id') : null;
              if (activeOrgId) {
                request.headers.set('X-Organization-Id', activeOrgId);
              }
            }
            logger.debug('ApiClient', `→ ${request.method} ${request.url}`);
          },
        ] as any,
        afterResponse: [
          async ({ request, options, response }: any) => {
            if (!response) return;
            logger.debug('ApiClient', `← [${response.status}] ${request.method} ${request.url}`);

            if (!response.ok) {
              let errorData: DrfErrorResponse | string | undefined;
              try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  errorData = await response.clone().json();
                } else {
                  errorData = await response.clone().text();
                }
              } catch {
                // Ignore parse errors
              }

              throw ApiError.fromDrfResponse(response.status, errorData);
            }
          },
        ] as any,
      },
    } as any);
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private async handleTokenRefresh(): Promise<string | null> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      tokenStorage.clearTokens();
      return null;
    }

    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.addRefreshSubscriber((newToken) => {
          resolve(newToken);
        });
      });
    }

    this.isRefreshing = true;

    try {
      logger.info('ApiClient', 'Attempting automatic JWT token refresh...');
      const mockRes = await dispatchMockRequest<{ access: string }>('POST', '/api/v1/auth/refresh/', { refresh: refreshToken });
      if (mockRes) {
        const newAccessToken = mockRes.data.access;
        tokenStorage.setAccessToken(newAccessToken);
        this.isRefreshing = false;
        this.onTokenRefreshed(newAccessToken);
        logger.info('ApiClient', 'Token refreshed successfully');
        return newAccessToken;
      }

      const response = await ky
        .post('/api/v1/auth/refresh/', {
          json: { refresh: refreshToken },
          retry: 0,
        })
        .json<{ access: string }>();

      const newAccessToken = response.access;
      tokenStorage.setAccessToken(newAccessToken);
      this.isRefreshing = false;
      this.onTokenRefreshed(newAccessToken);
      logger.info('ApiClient', 'Token refreshed successfully');
      return newAccessToken;
    } catch (err) {
      this.isRefreshing = false;
      this.refreshSubscribers = [];
      logger.warn('ApiClient', 'Token refresh failed. Clearing session.', err);
      tokenStorage.clearTokens();
      return null;
    }
  }

  private async executeWithAuthRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      return await requestFn();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        const newToken = await this.handleTokenRefresh();
        if (newToken) {
          return await requestFn();
        }
      }
      throw mapHttpError(error);
    }
  }

  private sanitizeParams(params?: Record<string, string | number | boolean | undefined | null>): Record<string, string> | undefined {
    if (!params) return undefined;
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        sanitized[key] = String(value);
      }
    }
    return sanitized;
  }

  public async get<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.executeWithAuthRetry(async () => {
      const mockRes = await dispatchMockRequest<T>('GET', url, undefined, options?.params);
      if (mockRes) {
        return mockRes.data;
      }

      const kyOptions: KyOptions = {
        ...options,
        searchParams: this.sanitizeParams(options?.params),
      };
      return await this.client.get(url, kyOptions).json<T>();
    });
  }

  public async post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.executeWithAuthRetry(async () => {
      const mockRes = await dispatchMockRequest<T>('POST', url, body, options?.params);
      if (mockRes) {
        return mockRes.data;
      }

      const kyOptions: KyOptions = {
        ...options,
        json: body,
        searchParams: this.sanitizeParams(options?.params),
      };
      return await this.client.post(url, kyOptions).json<T>();
    });
  }

  public async put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.executeWithAuthRetry(async () => {
      const mockRes = await dispatchMockRequest<T>('PUT', url, body, options?.params);
      if (mockRes) {
        return mockRes.data;
      }

      const kyOptions: KyOptions = {
        ...options,
        json: body,
        searchParams: this.sanitizeParams(options?.params),
      };
      return await this.client.put(url, kyOptions).json<T>();
    });
  }

  public async patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.executeWithAuthRetry(async () => {
      const mockRes = await dispatchMockRequest<T>('PATCH', url, body, options?.params);
      if (mockRes) {
        return mockRes.data;
      }

      const kyOptions: KyOptions = {
        ...options,
        json: body,
        searchParams: this.sanitizeParams(options?.params),
      };
      return await this.client.patch(url, kyOptions).json<T>();
    });
  }

  public async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.executeWithAuthRetry(async () => {
      const mockRes = await dispatchMockRequest<T>('DELETE', url, undefined, options?.params);
      if (mockRes) {
        return mockRes.data;
      }

      const kyOptions: KyOptions = {
        ...options,
        searchParams: this.sanitizeParams(options?.params),
      };
      const res = await this.client.delete(url, kyOptions);
      if (res.status === 204) {
        return {} as T;
      }
      return await res.json<T>();
    });
  }

  public async upload<T>(url: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.executeWithAuthRetry(async () => {
      const mockRes = await dispatchMockRequest<T>('POST', url, formData, options?.params);
      if (mockRes) {
        return mockRes.data;
      }

      const kyOptions: KyOptions = {
        ...options,
        body: formData,
        searchParams: this.sanitizeParams(options?.params),
      };
      return await this.client.post(url, kyOptions).json<T>();
    });
  }

  public async download(url: string, filename?: string, options?: RequestOptions): Promise<Blob> {
    return this.executeWithAuthRetry(async () => {
      const kyOptions: KyOptions = {
        ...options,
        searchParams: this.sanitizeParams(options?.params),
      };
      const response = await this.client.get(url, kyOptions);
      const blob = await response.blob();

      if (filename && typeof window !== 'undefined') {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }

      return blob;
    });
  }
}

export const apiClient = new ApiClient();
