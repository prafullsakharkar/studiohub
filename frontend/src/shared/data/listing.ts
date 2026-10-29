import { apiClient } from '@/api/client/ApiClient';
import type { RequestOptions } from '@/api/client/types';

/** DRF `StandardPagination` envelope (verified: docs/sync/samples, default page size 25, max 500). */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ParamValue = string | number | boolean | null | undefined;

export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [filter: string]: ParamValue;
}

export type PageFetcher<T> = (params: ListParams, signal?: AbortSignal) => Promise<Page<T>>;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 500;

/**
 * Backend list routes are of two kinds: 46 paginated and 32 that return a bare array
 * (docs/sync/00-backend-inventory.md). Both become a `Page` so callers need one code path;
 * a bare array is a single page with `count = length`.
 */
export function toPage<T>(response: Page<T> | T[] | null | undefined): Page<T> {
  if (Array.isArray(response)) {
    return { count: response.length, next: null, previous: null, results: response };
  }
  if (response && Array.isArray(response.results)) {
    return {
      count: typeof response.count === 'number' ? response.count : response.results.length,
      next: response.next ?? null,
      previous: response.previous ?? null,
      results: response.results,
    };
  }
  return { count: 0, next: null, previous: null, results: [] };
}

/** Fetcher for a list route; works for paginated and bare-array endpoints alike. */
export function listFetcher<T>(url: string, options: RequestOptions = {}): PageFetcher<T> {
  return async (params, signal) =>
    toPage(await apiClient.get<Page<T> | T[]>(url, { ...options, params, signal }));
}

export interface FetchAllOptions {
  signal?: AbortSignal;
  /** Safety valve against runaway loops. At page_size 500 this is 50,000 rows. */
  maxPages?: number;
  onProgress?: (loaded: number, total: number | null) => void;
}

/**
 * Every row of a list route, following `next` until exhausted. Use for dropdowns and exports;
 * never for tables (use `usePaginatedList`). Handles bare-array endpoints in a single request.
 */
export async function fetchAllRows<T>(
  fetchPage: PageFetcher<T>,
  params: ListParams = {},
  { signal, maxPages = 100, onProgress }: FetchAllOptions = {}
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const result = await fetchPage({ ...params, page, page_size: MAX_PAGE_SIZE }, signal);
    rows.push(...result.results);
    onProgress?.(rows.length, result.count);
    if (!result.next) return rows;
  }
  throw new Error(`fetchAllRows stopped after ${maxPages} pages; narrow the filters.`);
}
