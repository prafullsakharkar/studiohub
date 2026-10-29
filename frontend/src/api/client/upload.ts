import { ApiError } from '@/api/errors/ApiError';
import { getApiBaseUrl } from '@/api/repositories/config';
import { refreshAccessToken } from '@/core/auth/sessionRefresh';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { centralErrorHandler } from '@/core/api/error-handler';

/** Backend `ATTACHMENT_MAX_BYTES` (config/settings/components/storage.py). */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0-100, rounded. */
  percent: number;
}

export interface UploadOptions {
  /** Extra multipart fields, e.g. `{ name, description, file_type }`. */
  fields?: Record<string, string>;
  /** Multipart field that carries the file. Backend: `file`. */
  fileField?: string;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

/** Cheap checks the user can fix before waiting for an upload; the server stays authoritative. */
export function checkUploadable(file: File): string | null {
  if (file.size <= 0) return 'The file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return `The file is larger than the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`;
  return null;
}

function parseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

function sendOnce<T>(url: string, file: File, token: string | null, options: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBaseUrl()}${url}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      });
    };
    xhr.onload = () => {
      let body: unknown = xhr.responseText;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        // Proxy HTML (413 / 502): the normalizer ignores it and uses the status.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(ApiError.fromDrfResponse(xhr.status, body as never, parseHeaders(xhr.getAllResponseHeaders())));
    };
    xhr.onerror = () =>
      reject(new ApiError('Network connection failure during upload.', 0, {}, { type: 'NETWORK' }));
    xhr.ontimeout = () => reject(new ApiError('The upload timed out.', 504, {}, { type: 'TIMEOUT' }));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new DOMException('Upload cancelled', 'AbortError'));
        return;
      }
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    const form = new FormData();
    for (const [key, value] of Object.entries(options.fields ?? {})) form.append(key, value);
    form.append(options.fileField ?? 'file', file);
    xhr.send(form);
  });
}

/**
 * Multipart upload with progress and cancellation. `fetch` cannot report upload progress, so
 * this uses XHR, with the same auth rules as `ApiClient`: bearer token, one refresh + retry on
 * 401, central error handling (a cancelled upload is not an error and is not reported).
 */
export async function uploadFile<T>(url: string, file: File, options: UploadOptions = {}): Promise<T> {
  try {
    if (!tokenStorage.getAccessToken() && tokenStorage.getRefreshToken()) await refreshAccessToken(null);
    const sent = tokenStorage.getAccessToken();
    try {
      return await sendOnce<T>(url, file, sent, options);
    } catch (error) {
      if (!(error instanceof ApiError) || !error.isAuthError || error.isAccountDisabled) throw error;
      await refreshAccessToken(sent);
      return await sendOnce<T>(url, file, tokenStorage.getAccessToken(), options);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof ApiError) centralErrorHandler.handleError(error, { source: 'upload' });
    throw error;
  }
}
