import { describe, expect, it, vi } from 'vitest';
import { withClientFilters } from '../clientFilters';
import type { PageFetcher } from '../listing';

type Row = { id: string; kind: string; size: number };
const rows: Row[] = [
  { id: 'a', kind: 'x', size: 1 },
  { id: 'b', kind: 'y', size: 2 },
  { id: 'c', kind: 'x', size: 3 },
];
const server = () => vi.fn<PageFetcher<Row>>(async () => ({ count: rows.length, next: null, previous: null, results: rows }));

describe('withClientFilters', () => {
  it('narrows the rows by the chosen value and recounts, without sending that parameter', async () => {
    const fetchPage = server();
    const page = await withClientFilters(fetchPage, { kind: (row, value) => row.kind === value })({ kind: 'x', search: 'q', ordering: '-size' });
    expect(page.results.map((r) => r.id)).toEqual(['a', 'c']);
    expect(page.count).toBe(2);
    expect(fetchPage).toHaveBeenCalledWith({ search: 'q', ordering: '-size' }, undefined);
  });
  it('a blank or absent value narrows nothing', async () => {
    const fetchPage = server();
    const fetcher = withClientFilters(fetchPage, { kind: (row, value) => row.kind === value });
    expect((await fetcher({ kind: '' })).results).toHaveLength(3);
    expect((await fetcher({})).results).toHaveLength(3);
  });
  it('all chosen rules must pass; parameters without a rule go to the server', async () => {
    const fetchPage = server();
    const fetcher = withClientFilters(fetchPage, { kind: (row, value) => row.kind === value, min: (row, value) => row.size >= Number(value) });
    expect((await fetcher({ kind: 'x', min: '2', start: '2026-01-01' })).results.map((r) => r.id)).toEqual(['c']);
    expect(fetchPage.mock.calls[0][0]).toEqual({ start: '2026-01-01' });
  });
});
