import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LARGE_EXPORT_ROWS, exportAll, toCsv } from '../exportAll';
import type { ListParams, Page } from '../listing';

type Row = { id: number; name: string };

/** Raw bytes of a jsdom Blob (Node's Response cannot read jsdom Blobs). */
const bytesOf = (blob: Blob) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
/** Decoded text, BOM kept so tests can see it. */
const textOf = async (blob: Blob) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await bytesOf(blob));
const columns = [
  { header: 'ID', value: (r: Row) => r.id },
  { header: 'Name', value: (r: Row) => r.name },
];

describe('toCsv', () => {
  it('escapes quotes, commas and newlines; CRLF rows', () => {
    const csv = toCsv([{ id: 1, name: 'He said "hi", ok\nbye' }], columns);
    expect(csv).toBe('ID,Name\r\n1,"He said ""hi"", ok\nbye"\r\n');
  });

  it('neutralizes spreadsheet formulas', () => {
    const csv = toCsv([{ id: 1, name: '=HYPERLINK("http://evil")' }, { id: 2, name: '+1' }, { id: 3, name: '@SUM(A1)' }, { id: 4, name: '-2' }], columns);
    const lines = csv.trim().split('\r\n').slice(1);
    expect(lines.every((l) => l.split(',')[1].replace(/^"/, '').startsWith("'"))).toBe(true);
  });

  it('renders null/undefined empty and objects as JSON', () => {
    const csv = toCsv([{ id: 1, name: null as never }], [...columns, { header: 'Tags', value: () => ['a', 'b'] }]);
    expect(csv).toBe('ID,Name,Tags\r\n1,,"[""a"",""b""]"\r\n');
  });
});

describe('exportAll', () => {
  let downloads: string[];
  let blobs: Blob[];
  beforeEach(() => {
    downloads = [];
    blobs = [];
    vi.stubGlobal('URL', { ...URL, createObjectURL: (b: Blob) => (blobs.push(b), 'blob:x'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const rowsOf = (total: number): Row[] => Array.from({ length: total }, (_, i) => ({ id: i + 1, name: `n${i + 1}` }));
  const paged =
    (all: Row[]) =>
    async (p: ListParams): Promise<Page<Row>> => {
      const size = Number(p.page_size ?? 25);
      const page = Number(p.page ?? 1);
      const slice = all.slice((page - 1) * size, page * size);
      return { count: all.length, next: page * size < all.length ? 'next' : null, previous: null, results: slice };
    };

  it('exports ALL matching rows, ignoring the visible page, and applies the current filters', async () => {
    const all = rowsOf(1200);
    const fetchPage = vi.fn(paged(all));
    const result = await exportAll({ fetchPage, params: { page: 3, page_size: 25, search: 'n', ordering: 'name' }, columns, filename: 'departments.csv' });

    expect(result).toEqual({ rows: 1200, cancelled: false });
    expect(downloads).toEqual(['departments.csv']);
    const text = await textOf(blobs[0]);
    expect(text.split('\r\n').length).toBe(1 + 1200 + 1); // header + rows + trailing newline
    // every data request carried the filters; none carried the table's page
    const dataCalls = fetchPage.mock.calls.slice(1).map(([p]) => p);
    expect(dataCalls.every((p) => p.search === 'n' && p.ordering === 'name' && p.page_size === 500)).toBe(true);
    expect(dataCalls.map((p) => p.page)).toEqual([1, 2, 3]);
  });

  it('starts with a UTF-8 BOM so spreadsheets read accents correctly', async () => {
    await exportAll({ fetchPage: paged(rowsOf(2)), params: {}, columns, filename: 'x.csv' });
    const bytes = await bytesOf(blobs[0]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
  });

  it('asks before a very large export and stops if declined', async () => {
    const fetchPage = vi.fn(async (): Promise<Page<Row>> => ({ count: LARGE_EXPORT_ROWS + 1, next: 'n', previous: null, results: [] }));
    const confirmLarge = vi.fn(async () => false);
    const result = await exportAll({ fetchPage, params: {}, columns, filename: 'x.csv', confirmLarge });

    expect(confirmLarge).toHaveBeenCalledWith(LARGE_EXPORT_ROWS + 1);
    expect(result).toEqual({ rows: 0, cancelled: true });
    expect(fetchPage).toHaveBeenCalledTimes(1); // only the count probe
    expect(downloads).toEqual([]);
  });

  it('can be cancelled mid-export', async () => {
    const controller = new AbortController();
    const all = rowsOf(1500);
    const fetchPage = vi.fn(async (p: ListParams) => {
      if (p.page === 2) controller.abort();
      return paged(all)(p);
    });
    await expect(exportAll({ fetchPage, params: {}, columns, filename: 'x.csv', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(downloads).toEqual([]);
  });

  it('reports progress', async () => {
    const onProgress = vi.fn();
    await exportAll({ fetchPage: paged(rowsOf(700)), params: {}, columns, filename: 'x.csv', onProgress });
    expect(onProgress).toHaveBeenLastCalledWith(700, 700);
  });
});
