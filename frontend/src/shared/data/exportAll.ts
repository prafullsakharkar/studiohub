import { fetchAllRows } from './listing';
import type { ListParams, PageFetcher } from './listing';

export interface ExportColumn<T> {
  header: string;
  /** Cell value; objects/arrays are JSON-encoded. */
  value: (row: T) => unknown;
}

/** Above this many rows the caller should confirm first (a 20,000-row export is 40 requests). */
export const LARGE_EXPORT_ROWS = 10_000;

/**
 * Spreadsheet apps execute cells that start with = + - @ (CSV/formula injection). Prefixing a
 * single quote makes them literal text; the value is otherwise unchanged.
 */
function neutralize(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = neutralize(text);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** RFC 4180 CSV (CRLF rows). */
export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','));
  return lines.join('\r\n') + '\r\n';
}

export interface ExportAllOptions<T> {
  fetchPage: PageFetcher<T>;
  /** The table's current filters/search/ordering. page and page_size are ignored. */
  params: ListParams;
  columns: readonly ExportColumn<T>[];
  filename: string;
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number | null) => void;
  /** Called when the match count exceeds LARGE_EXPORT_ROWS; resolve false to stop before downloading. */
  confirmLarge?: (count: number) => Promise<boolean>;
}

export interface ExportResult {
  rows: number;
  cancelled: boolean;
}

/**
 * Export every row matching the current filters (not just the visible page) as CSV and download
 * it. Cancellable, reports progress, and asks first for very large exports.
 */
export async function exportAll<T>(options: ExportAllOptions<T>): Promise<ExportResult> {
  const { fetchPage, params, columns, filename, signal, onProgress, confirmLarge } = options;
  const { page: _page, page_size: _size, ...filters } = params;

  // One cheap request tells us how many rows match before we pull them all.
  const probe = await fetchPage({ ...filters, page: 1, page_size: 1 }, signal);
  if (probe.count > LARGE_EXPORT_ROWS && confirmLarge && !(await confirmLarge(probe.count))) {
    return { rows: 0, cancelled: true };
  }

  const rows = await fetchAllRows(fetchPage, filters, { signal, onProgress });
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return { rows: rows.length, cancelled: false };
}
