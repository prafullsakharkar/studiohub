import ky, { KyInstance, Options as KyOptions } from 'ky';
import { IApiClient, RequestOptions } from './types';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { refreshAccessToken } from '@/core/auth/sessionRefresh';
import { normalizeApiPath } from './url';
import { ApiError } from '@/api/errors/ApiError';
import { mapHttpError } from '@/api/errors/errorMapper';
import { logger } from '@/core/logging/logger';
import { DrfErrorResponse } from '@/types/common';

import { getApiBaseUrl } from '@/api/repositories/config';
import { centralErrorHandler } from '@/core/api/error-handler';

/**
 * Auth endpoints that must never carry a Bearer header or trigger a refresh: the caller has
 * no (valid) session yet, or is the refresh itself.
 */
const PUBLIC_AUTH_PATHS = [
  '/auth/login/',
  '/auth/refresh/',
  '/auth/forgot-password/',
  '/auth/reset-password/',
  '/auth/mfa/challenge/',
];

function isPublicAuthPath(url: string): boolean {
  const path = url.split('?')[0];
  return PUBLIC_AUTH_PATHS.some((p) => path.endsWith(p));
}

export class ApiClient implements IApiClient {
  private client: KyInstance;

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
            const skipAuth = (options as RequestOptions)?.skipAuth || isPublicAuthPath(request.url);
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

  /**
   * Run a request with auth handling:
   *  - no access token but a refresh token (reload / new tab) -> exchange first, avoiding a 401;
   *  - 401 -> refresh once (single flight, cross-tab safe) and retry once;
   *  - refresh failure rejects every waiting request, then the central handler ends the session.
   */
  private async executeWithAuthRetry<T>(
    url: string,
    options: RequestOptions | undefined,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const authenticated = !options?.skipAuth && !isPublicAuthPath(url);

    try {
      if (authenticated && !tokenStorage.getAccessToken() && tokenStorage.getRefreshToken()) {
        await refreshAccessToken(null);
      }
      const sentToken = tokenStorage.getAccessToken();
      try {
        return await requestFn();
      } catch (error: unknown) {
        const normalized = mapHttpError(error);
        if (!authenticated || !normalized.isSessionLoss || normalized.isAccountDisabled) throw normalized;

        try {
          await refreshAccessToken(sentToken);
        } catch (refreshError) {
          const refreshFailure = mapHttpError(refreshError);
          // A rejected refresh means the session is gone: surface the original 401 so the
          // central handler treats it as an expiry. Network/5xx refresh failures are reported as-is.
          throw refreshFailure.isAuthError ? normalized : refreshFailure;
        }
        return await requestFn();
      }
    } catch (error: unknown) {
      const finalError = mapHttpError(error);
      // A 401 from login / MFA / password reset is a credential failure the form displays; it is
      // not an expired session, so it must not sign anyone out or toast "session expired".
      if (!(finalError.isAuthError && !authenticated)) {
        centralErrorHandler.handleError(finalError, { source: 'ApiClient' });
      }
      throw finalError;
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

  private async dispatch<T>(method: string, rawUrl: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = normalizeApiPath(rawUrl);
    return this.executeWithAuthRetry(url, options, async () => {
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

  public async upload<T>(rawUrl: string, formData: FormData, options?: RequestOptions): Promise<T> {
    const url = normalizeApiPath(rawUrl);
    return this.executeWithAuthRetry(url, options, async () => {
      const kyOptions: KyOptions = {
        ...options,
        body: formData,
        searchParams: this.sanitizeParams(options?.params),
        signal: options?.signal,
      };
      return await this.client.post(url, kyOptions).json<T>();
    });
  }

  public async download(rawUrl: string, filename?: string, options?: RequestOptions): Promise<Blob> {
    const url = normalizeApiPath(rawUrl);
    return this.executeWithAuthRetry(url, options, async () => {
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
