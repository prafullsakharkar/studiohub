import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { fetchAllRows, listFetcher, toPage } from '../listing';
import type { Page } from '../listing';

const departments = loadSample('masterdata/departments.json');
const softwareBare = loadSample('masterdata/platform__master-data__software.json');
const paginated = departments.list_admin.body as Page<{ id: string }>;
const bare = (softwareBare.list_admin.body as { items: unknown[] }).items;

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('toPage', () => {
  it('keeps a paginated envelope (real departments sample)', () => {
    const page = toPage(paginated);
    expect(page.count).toBe(5);
    expect(page.next).toBeNull();
    expect(page.results.length).toBeGreaterThan(0);
  });

  it('turns a bare array (real software sample) into a single page', () => {
    const page = toPage(bare);
    expect(page).toEqual({ count: bare.length, next: null, previous: null, results: bare });
  });

  it('tolerates null/garbage', () => {
    expect(toPage(null).results).toEqual([]);
    expect(toPage({} as never).count).toBe(0);
  });
});

describe('listFetcher', () => {
  it('requests the route with page params and no empty values', async () => {
    const { calls } = mockFetch(() => ({ body: paginated }));
    const page = await listFetcher('/api/v1/departments/')({ page: 2, page_size: 25, search: '', ordering: 'name' });

    const url = new URL(calls[0].url);
    expect(url.pathname).toBe('/api/v1/departments/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', page_size: '25', ordering: 'name' });
    expect(page.count).toBe(5);
  });

  it('treats a bare-array route like a one-page list', async () => {
    mockFetch(() => ({ body: bare }));
    const page = await listFetcher('/api/v1/platform/master-data/software')({ page: 1 });
    expect(page.results).toHaveLength(bare.length);
    expect(page.next).toBeNull();
  });
});

describe('fetchAllRows', () => {
  const pages = (n: number): Page<number>[] =>
    Array.from({ length: n }, (_, i) => ({
      count: n * 2,
      next: i < n - 1 ? `http://x/?page=${i + 2}` : null,
      previous: null,
      results: [i * 2, i * 2 + 1],
    }));

  it('follows next until exhausted, at the maximum page size', async () => {
    const data = pages(3);
    const fetchPage = vi.fn(async (p: { page?: number }) => data[(p.page ?? 1) - 1]);
    const progress = vi.fn();
    const rows = await fetchAllRows(fetchPage, { search: 'x' }, { onProgress: progress });

    expect(rows).toEqual([0, 1, 2, 3, 4, 5]);
    expect(fetchPage.mock.calls.map(([p]) => p)).toEqual([
      { search: 'x', page: 1, page_size: 500 },
      { search: 'x', page: 2, page_size: 500 },
      { search: 'x', page: 3, page_size: 500 },
    ]);
    expect(progress).toHaveBeenLastCalledWith(6, 6);
  });

  it('does a single request for a bare-array route', async () => {
    mockFetch(() => ({ body: bare }));
    const rows = await fetchAllRows(listFetcher('/api/v1/platform/master-data/software'));
    expect(rows).toHaveLength(bare.length);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(async () => {
      controller.abort();
      return pages(2)[0];
    });
    await expect(fetchAllRows(fetchPage, {}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('refuses to loop forever', async () => {
    const fetchPage = async () => ({ count: 1, next: 'http://x/?page=2', previous: null, results: [1] });
    await expect(fetchAllRows(fetchPage, {}, { maxPages: 3 })).rejects.toThrow(/stopped after 3 pages/);
  });
});
