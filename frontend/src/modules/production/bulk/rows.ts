import { BULK_MAX_ITEMS } from '@/api/production/bulkRoutes';
import type { BulkBatchResponse, BulkCreateRow, BulkUpdateRow } from '@/api/production/bulkRoutes';
import { toCsv } from '@/shared/data/exportAll';
import { headerKey, parseDelimited } from '@/shared/utils/csv';
import type { BulkColumn } from './specs';

/**
 * Rows of a bulk file or paste, keyed by column `header`, and what they become on the wire (CR-48). An empty cell means
 * "not given": a create leaves the field to its default, an update leaves it as it is.
 */
export type SheetRow = Record<string, unknown>;

export interface ReadResult {
  rows: SheetRow[];
  /** Why the text cannot be used as it is (an unknown column, a missing required one, too many rows). */
  problems: string[];
}

/** Largest file the dialog reads (the backend refuses a body above 2.5 MB). */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Delimited text with a header row, checked against `columns` (a header may be the column's `header` or its API key). */
export function readRows(text: string, columns: readonly BulkColumn[]): ReadResult {
  const [head, ...body] = parseDelimited(text);
  if (!head) return { rows: [], problems: ['The text has no rows.'] };
  const byName = new Map<string, BulkColumn>();
  for (const column of columns) {
    byName.set(headerKey(column.header), column);
    byName.set(headerKey(column.key), column);
  }
  const problems: string[] = [];
  const mapped = head.map((cell) => {
    const column = byName.get(headerKey(cell));
    if (!column && cell.trim()) problems.push(`Unknown column "${cell.trim()}". The columns are: ${columns.map((c) => c.header).join(', ')}.`);
    return column;
  });
  for (const column of columns) {
    const given = mapped.filter((c) => c === column).length;
    if (given > 1) problems.push(`The "${column.header}" column is given ${given} times.`);
    if (column.required && given === 0) problems.push(`The "${column.header}" column is missing.`);
  }
  if (body.length > BULK_MAX_ITEMS) problems.push(`At most ${BULK_MAX_ITEMS} rows at a time; this has ${body.length}. Split it into several files.`);
  const rows = body.map((cells) => {
    const row: SheetRow = {};
    mapped.forEach((column, index) => {
      if (column) row[column.header] = (cells[index] ?? '').trim();
    });
    return row;
  });
  return { rows, problems };
}

/** A cell as an API value; `undefined` when empty. A number column sends a number when the text is one, else the text (the backend says why). */
function cellValue(column: BulkColumn, raw: unknown): unknown {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return raw;
  const text = String(raw).trim();
  if (!text) return undefined;
  if (column.type === 'number' && /^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (column.key === 'code') return text.toUpperCase();
  return text;
}

function fieldsOf(row: SheetRow, columns: readonly BulkColumn[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const column of columns) {
    if (column.key === 'code') continue;
    const value = cellValue(column, row[column.header]);
    if (value !== undefined) fields[column.key] = value;
  }
  return fields;
}

const codeOf = (row: SheetRow, columns: readonly BulkColumn[]) => {
  const column = columns.find((c) => c.key === 'code');
  return column ? String(cellValue(column, row[column.header]) ?? '') : '';
};

export const toCreateItems = (rows: readonly SheetRow[], columns: readonly BulkColumn[]): BulkCreateRow[] =>
  rows.map((row) => ({ code: codeOf(row, columns), action: 'create', data: fieldsOf(row, columns) }));

export const toUpdateItems = (rows: readonly SheetRow[], columns: readonly BulkColumn[]): BulkUpdateRow[] =>
  rows.map((row) => ({ code: codeOf(row, columns), ...fieldsOf(row, columns) }));

/**
 * Update rows less what "Load template" filled in and was left as it was: a cell equal to the loaded value is dropped
 * (so it is not written again) and a row with no other change is not sent. Rows not in `loaded` are kept whole.
 */
export function changedRows(rows: readonly SheetRow[], columns: readonly BulkColumn[], loaded: ReadonlyMap<string, SheetRow>): SheetRow[] {
  return rows.flatMap((row) => {
    const before = loaded.get(codeOf(row, columns));
    if (!before) return [row];
    const next: SheetRow = {};
    let changed = false;
    for (const column of columns) {
      const value = String(row[column.header] ?? '').trim();
      if (column.key === 'code') next[column.header] = row[column.header];
      else if (value && value !== String(before[column.header] ?? '').trim()) {
        next[column.header] = value;
        changed = true;
      }
    }
    return changed ? [next] : [];
  });
}

/** Rows by their code, as `changedRows` looks them up. */
export const byCode = (rows: readonly SheetRow[], columns: readonly BulkColumn[]): Map<string, SheetRow> =>
  new Map(rows.map((row) => [codeOf(row, columns), row]));

/** The header row of a bulk file, for "Download template". */
export const templateCsv = (columns: readonly BulkColumn[]): string => toCsv<SheetRow>([], columns.map((c) => ({ header: c.header, value: () => '' })));

/** The CSV column an error names; none for a whole-row reason or for the row's `id` (a key, not a column). */
const columnOf = (field: string | null, labels: ReadonlyMap<string, string>): string | null =>
  !field || field === 'id' ? null : (labels.get(field) ?? field);

export type RowOutcome = 'create' | 'update' | 'skip' | 'error';

export interface RowReport {
  outcome: RowOutcome;
  /** The backend's word for the row: created, updated, exists, soft_deleted, duplicate, not_found, invalid, … */
  status: string;
  messages: string[];
}

/** Per input row: what the batch did (or would do) with it, and the backend's reasons for a refused one. */
export function rowReports(response: BulkBatchResponse, columns: readonly BulkColumn[]): RowReport[] {
  const labels = new Map(columns.map((c) => [c.key, c.header]));
  const reports: RowReport[] = response.results.map((row) => ({
    outcome: !row.success ? 'error' : row.status === 'skipped' ? 'skip' : row.status === 'updated' ? 'update' : 'create',
    status: row.status,
    messages: [],
  }));
  for (const error of response.errors) {
    const report = reports[error.row];
    if (!report) continue;
    const field = columnOf(error.field, labels);
    report.messages.push(field ? `${field}: ${error.message}` : error.message);
  }
  return reports;
}

export type OutcomeCounts = Record<RowOutcome, number>;

/** How many rows each outcome has, for the summary above the rows. */
export const countOutcomes = (reports: readonly RowReport[]): OutcomeCounts =>
  reports.reduce<OutcomeCounts>((counts, r) => ({ ...counts, [r.outcome]: counts[r.outcome] + 1 }), { create: 0, update: 0, skip: 0, error: 0 });

/** The refused rows as a CSV: row number (1 is the first row under the header), code, column and message. */
export function errorReportCsv(response: BulkBatchResponse, rows: readonly SheetRow[], columns: readonly BulkColumn[]): string {
  const labels = new Map(columns.map((c) => [c.key, c.header]));
  return toCsv(response.errors, [
    { header: 'row', value: (e) => e.row + 1 },
    { header: 'code', value: (e) => codeOf(rows[e.row] ?? {}, columns) },
    { header: 'column', value: (e) => columnOf(e.field, labels) ?? '' },
    { header: 'message', value: (e) => e.message },
  ]);
}

/** Every sent row as a CSV log: row number, code, outcome (stored or not) and the reasons. */
export function logCsv(reports: readonly RowReport[], rows: readonly SheetRow[], columns: readonly BulkColumn[], committed: boolean): string {
  return toCsv(
    reports.map((report, index) => ({ report, index })),
    [
      { header: 'row', value: (r) => r.index + 1 },
      { header: 'code', value: (r) => codeOf(rows[r.index] ?? {}, columns) },
      { header: 'outcome', value: (r) => (r.report.outcome === 'error' ? 'error' : committed ? r.report.status : 'not stored') },
      { header: 'message', value: (r) => r.report.messages.join(' ') },
    ]
  );
}
