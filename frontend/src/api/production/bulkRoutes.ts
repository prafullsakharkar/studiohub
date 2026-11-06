import { apiClient } from '@/api/client/ApiClient';

/**
 * The bulk routes of the production entities (CR-48): `POST {base}bulk-create/` and `{base}bulk-update/` with a dry run,
 * all-or-nothing batches and per-row errors. Bulk archive and restore are the typed `archivable()` helpers in `work.ts`
 * and `structure.ts`.
 */

// ---------------------------------------------------------------- CR-48 batches

/** One row of a batch answer: `index` is the item's position, `id` is null for a row that was not stored. */
export interface BulkBatchRow {
  index: number;
  id: string | null;
  code: string | null;
  status: string;
  success: boolean;
  actionTaken: string;
  error: unknown;
  suggestedAction?: string;
}

/** A refused row's reason, one per message; `row` is the item's index, `field` null for a whole-row reason. */
export interface BulkBatchError {
  row: number;
  field: string | null;
  message: string;
}

/**
 * `bulk-create` / `bulk-update` answer (CR-48). With `dry_run` nothing is stored and `committed` is false; with
 * `atomic` a single failed row stores nothing either. `successful` / `failed` count the rows that passed or not.
 */
export interface BulkBatchResponse {
  operation_id: string;
  timestamp: string;
  processed: number;
  successful: number;
  failed: number;
  partial_success: boolean;
  summary: Record<string, number>;
  results: BulkBatchRow[];
  dry_run: boolean;
  atomic: boolean;
  committed: boolean;
  errors: BulkBatchError[];
}

export interface BulkBatchOptions {
  dry_run: boolean;
  atomic: boolean;
}

/** A create item: the code, and the other fields under `data`. */
export interface BulkCreateRow {
  code: string;
  action?: 'create' | 'skip';
  data: Record<string, unknown>;
}

/** An update item: the row's code (within the batch's project) or id, and the fields to change. */
export type BulkUpdateRow = { code?: string; id?: string } & Record<string, unknown>;

/** Most items one batch may carry (the backend answers 400 above it). */
export const BULK_MAX_ITEMS = 500;

export interface BulkBatchRoutes {
  create: (projectId: string, items: BulkCreateRow[], options: BulkBatchOptions) => Promise<BulkBatchResponse>;
  update: (projectId: string, items: BulkUpdateRow[], options: BulkBatchOptions) => Promise<BulkBatchResponse>;
  /** The same field values on every id (selected rows). */
  updateIds: (ids: string[], changes: Record<string, unknown>, options: BulkBatchOptions) => Promise<BulkBatchResponse>;
}

export function bulkBatch(base: string): BulkBatchRoutes {
  return {
    create: (projectId, items, options) => apiClient.post<BulkBatchResponse>(`${base}bulk-create/`, { project_id: projectId, items, ...options }),
    update: (projectId, items, options) => apiClient.post<BulkBatchResponse>(`${base}bulk-update/`, { project_id: projectId, items, ...options }),
    updateIds: (ids, changes, options) => apiClient.post<BulkBatchResponse>(`${base}bulk-update/`, { ids, changes, ...options }),
  };
}

export const sequenceBatch = bulkBatch('/api/v1/sequences/');
export const shotBatch = bulkBatch('/api/v1/shots/');
export const assetBatch = bulkBatch('/api/v1/assets/');
export const taskBatch = bulkBatch('/api/v1/tasks/');
