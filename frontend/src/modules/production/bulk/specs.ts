import { assetBatch, sequenceBatch, shotBatch, taskBatch } from '@/api/production/bulkRoutes';
import type { BulkBatchRoutes } from '@/api/production/bulkRoutes';
import { sequencesApi } from '@/api/production/structure';
import { ASSET_CATEGORIES, ASSET_STATUSES, SHOT_STATUSES, TASK_ENTITY_TYPES, TASK_PRIORITIES, TASK_STATUSES, assetsApi, shotsApi, tasksApi } from '@/api/production/work';

/**
 * What a bulk create or update of each entity takes (CR-48). A column's `key` is the API field; its `header` is the CSV
 * column name (a file may also use the key). Parents are written by code (`SQ010`, `EP101`) and resolved by the backend
 * inside the project. `update: false` columns are create-only: the backend's `bulk_update_fields` leaves them out.
 */
export interface BulkColumn {
  key: string;
  header: string;
  label: string;
  type: 'text' | 'number' | 'date';
  required?: boolean;
  /** Only for an episodic project (CR-47). */
  episodic?: boolean;
  /** False: set on create only. */
  update?: boolean;
  /** For the selected-rows editor: a fixed choice. */
  options?: readonly string[];
}

export interface BulkSpec {
  /** `sequence`, used in file names and sentences. */
  noun: string;
  plural: string;
  routes: BulkBatchRoutes;
  createPermission: string;
  updatePermission: string;
  /** Invalidated after a batch is stored. */
  queryKey: readonly unknown[];
  columns: readonly BulkColumn[];
}

/** `ProductionStatus` of the backend without Archived (that is the Archived view). */
export const STRUCTURE_STATUSES = ['Not Started', 'In Progress', 'Pending Review', 'Approved', 'Retake'] as const;
const live = (values: readonly string[]) => values.filter((value) => value !== 'Archived');

const code: BulkColumn = { key: 'code', header: 'code', label: 'Code', type: 'text', required: true };
const name: BulkColumn = { key: 'name', header: 'name', label: 'Name', type: 'text' };
const description: BulkColumn = { key: 'description', header: 'description', label: 'Description', type: 'text' };
const episode: BulkColumn = { key: 'episode_id', header: 'episode', label: 'Episode (code)', type: 'text', episodic: true };
const frameIn: BulkColumn = { key: 'frame_in', header: 'frame_in', label: 'First frame', type: 'number' };
const frameOut: BulkColumn = { key: 'frame_out', header: 'frame_out', label: 'Last frame', type: 'number' };

export const sequenceBulkSpec: BulkSpec = {
  noun: 'sequence',
  plural: 'sequences',
  routes: sequenceBatch,
  createPermission: 'sequence.create',
  updatePermission: 'sequence.update',
  queryKey: sequencesApi.keys.all,
  columns: [code, name, description, episode, frameIn, frameOut, { key: 'status', header: 'status', label: 'Status', type: 'text', options: STRUCTURE_STATUSES }],
};

export const shotBulkSpec: BulkSpec = {
  noun: 'shot',
  plural: 'shots',
  routes: shotBatch,
  createPermission: 'shot.create',
  updatePermission: 'shot.update',
  queryKey: shotsApi.keys.all,
  columns: [
    code,
    name,
    description,
    { key: 'sequence_id', header: 'sequence', label: 'Sequence (code)', type: 'text' },
    episode,
    frameIn,
    frameOut,
    { key: 'handle_frames', header: 'handle_frames', label: 'Handles', type: 'number' },
    { key: 'status', header: 'status', label: 'Status', type: 'text', options: live(SHOT_STATUSES) },
  ],
};

export const assetBulkSpec: BulkSpec = {
  noun: 'asset',
  plural: 'assets',
  routes: assetBatch,
  createPermission: 'asset.create',
  updatePermission: 'asset.update',
  queryKey: assetsApi.keys.all,
  columns: [
    code,
    { ...name, required: true },
    description,
    { key: 'asset_type_id', header: 'asset_type', label: 'Asset type (code)', type: 'text' },
    { key: 'category', header: 'category', label: 'Category', type: 'text', options: ASSET_CATEGORIES },
    { key: 'status', header: 'status', label: 'Status', type: 'text', options: live(ASSET_STATUSES) },
  ],
};

export const taskBulkSpec: BulkSpec = {
  noun: 'task',
  plural: 'tasks',
  routes: taskBatch,
  createPermission: 'task.create',
  updatePermission: 'task.update',
  queryKey: tasksApi.keys.all,
  columns: [
    code,
    { key: 'title', header: 'title', label: 'Title', type: 'text', required: true },
    description,
    { key: 'entity_type', header: 'entity_type', label: 'About', type: 'text', update: false, options: TASK_ENTITY_TYPES },
    { key: 'entity_id', header: 'entity', label: 'Shot, asset or sequence (code)', type: 'text', update: false },
    { key: 'task_type_id', header: 'task_type', label: 'Task type (code)', type: 'text' },
    { key: 'status', header: 'status', label: 'Status', type: 'text', options: live(TASK_STATUSES) },
    { key: 'priority', header: 'priority', label: 'Priority', type: 'text', options: TASK_PRIORITIES },
    { key: 'due_date', header: 'due_date', label: 'Due date (YYYY-MM-DD)', type: 'date' },
    { key: 'estimated_hours', header: 'estimated_hours', label: 'Estimated hours', type: 'number' },
  ],
};

/** The columns of `spec` for a project: the episode column only on an episodic one, create-only ones left out of an update. */
export function columnsFor(spec: BulkSpec, { episodic, mode }: { episodic: boolean; mode: 'create' | 'update' }): BulkColumn[] {
  return spec.columns.filter((column) => (episodic || !column.episodic) && (mode === 'create' || column.update !== false));
}
