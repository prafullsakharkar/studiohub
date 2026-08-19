import { Options as KyOptions } from 'ky';

export interface RequestOptions extends Omit<KyOptions, 'searchParams'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
  timeout?: number;
  retry?: number;
}

export interface IApiClient {
  get<T>(url: string, options?: RequestOptions): Promise<T>;
  post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(url: string, options?: RequestOptions): Promise<T>;
  upload<T>(url: string, formData: FormData, options?: RequestOptions): Promise<T>;
  download(url: string, filename?: string, options?: RequestOptions): Promise<Blob>;
}
