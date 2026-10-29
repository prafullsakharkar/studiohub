import ky, { KyInstance, Options as KyOptions } from 'ky';
import { IApiClient, RequestOptions } from './types';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { ApiError } from '@/api/errors/ApiError';
import { mapHttpError } from '@/api/errors/errorMapper';
import { logger } from '@/core/logging/logger';
import { DrfErrorResponse } from '@/types/common';

import { getApiBaseUrl } from '@/api/repositories/config';
import { centralErrorHandler } from '@/core/api/error-handler';
import { ContractValidator } from '@/core/api/generated/validator';

export class ApiClient implements IApiClient {
  private client: KyInstance;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor(prefix = '') {
    const baseUrl = getApiBaseUrl();
    const effectivePrefix = prefix || (baseUrl ? `${baseUrl}` : undefined);

    this.client = ky.create({
      prefix: effectivePrefix,
      timeout: 30000,
      retry: {
        limit: 1,
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

              const apiError = ApiError.fromDrfResponse(response.status, errorData, response.headers);
              throw apiError;
            } else {
              centralErrorHandler.recordSuccess();
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

      const response = await this.client
        .post('/api/v1/auth/refresh/', {
          json: { refresh: refreshToken },
          retry: 0,
        })
        .json<{ access: string; refresh?: string }>();

      const newAccessToken = response.access;
      tokenStorage.setAccessToken(newAccessToken);
      // Persist rotated refresh tokens (backend rotates on every refresh).
      if (response.refresh) {
        tokenStorage.setRefreshToken(response.refresh);
      }
      this.isRefreshing = false;
      this.onTokenRefreshed(newAccessToken);
      logger.info('ApiClient', 'Token refreshed successfully via REST API');
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
      const normalized = mapHttpError(error);

      // 1. Attempt token refresh on 401
      if (normalized.isAuthError && !normalized.isAccountDisabled) {
        const newToken = await this.handleTokenRefresh();
        if (newToken) {
          try {
            return await requestFn();
          } catch (retryError) {
            const finalErr = mapHttpError(retryError);
            centralErrorHandler.handleError(finalErr, { source: 'ApiClient' });
            throw finalErr;
          }
        }
      }

      // 2. Dispatch to central error handler
      centralErrorHandler.handleError(normalized, { source: 'ApiClient' });
      throw normalized;
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

  private async dispatch<T>(method: string, url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    ContractValidator.validateRequest(method, url, body, options?.params);

    return this.executeWithAuthRetry(async () => {
      const kyOptions: KyOptions = {
        ...options,
        json: body,
        searchParams: this.sanitizeParams(options?.params),
        signal: options?.signal,
      };

      const upperMethod = method.toUpperCase();
      let result: T;
      if (upperMethod === 'GET') {
        result = await this.client.get(url, kyOptions).json<T>();
      } else if (upperMethod === 'POST') {
        result = await this.client.post(url, kyOptions).json<T>();
      } else if (upperMethod === 'PUT') {
        result = await this.client.put(url, kyOptions).json<T>();
      } else if (upperMethod === 'PATCH') {
        result = await this.client.patch(url, kyOptions).json<T>();
      } else if (upperMethod === 'DELETE') {
        const res = await this.client.delete(url, kyOptions);
        if (res.status === 204) return {} as T;
        result = await res.json<T>();
      } else {
        result = await this.client(url, { ...kyOptions, method }).json<T>();
      }
      ContractValidator.validateResponse(method, url, 200, result);
      return result;
    });
  }

  public async get<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.dispatch<T>('GET', url, undefined, options);
  }

  public async post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.dispatch<T>('POST', url, body, options);
  }

  public async put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.dispatch<T>('PUT', url, body, options);
  }

  public async patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.dispatch<T>('PATCH', url, body, options);
  }

  public async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.dispatch<T>('DELETE', url, undefined, options);
  }

  public async upload<T>(url: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.executeWithAuthRetry(async () => {
      const kyOptions: KyOptions = {
        ...options,
        body: formData,
        searchParams: this.sanitizeParams(options?.params),
        signal: options?.signal,
      };
      return await this.client.post(url, kyOptions).json<T>();
    });
  }

  public async download(url: string, filename?: string, options?: RequestOptions): Promise<Blob> {
    return this.executeWithAuthRetry(async () => {
      const kyOptions: KyOptions = {
        ...options,
        searchParams: this.sanitizeParams(options?.params),
        signal: options?.signal,
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
