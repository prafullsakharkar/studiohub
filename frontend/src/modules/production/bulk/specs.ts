import { assetBatch, sequenceBatch, shotBatch, taskBatch } from '@/api/production/bulkRoutes';
import type { BulkBatchRoutes } from '@/api/production/bulkRoutes';
import { sequencesApi } from '@/api/production/structure';
import type { PageFetcher } from '@/shared/data/listing';
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
  /** A parent column: the list row's field that holds the parent's code (`sequence_code` for `sequence_id`). */
  codeFrom?: string;
}

/** What "Load template" fills a create example with: codes of the project's own parents and the catalog's types. */
export interface TemplateParents {
  episode?: string;
  sequence?: string;
  /** The episode of `sequence` (episodic projects). */
  sequenceEpisode?: string;
  shot?: string;
  asset?: string;
  assetType?: string;
  taskType?: string;
}
export type TemplateNeed = 'episode' | 'sequence' | 'shot' | 'asset' | 'assetType' | 'taskType';

export interface BulkTemplate {
  /** Which parents `example` uses; only those are fetched. */
  needs: readonly TemplateNeed[];
  /** Example row `n` (1, 2, 3) by column header; a column it leaves out stays empty. */
  example: (n: number, parents: TemplateParents) => Record<string, string>;
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
  /** The list route, for "Load template" on an update (the project's current rows). */
  list: PageFetcher<object>;
  columns: readonly BulkColumn[];
  template: BulkTemplate;
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
/** Example codes 010, 020, 030 (the studio's step of ten). */
const step = (n: number) => String(n * 10).padStart(3, '0');
const frames = (n: number) => ({ frame_in: '1001', frame_out: String(1000 + n * 48) });

export const sequenceBulkSpec: BulkSpec = {
  noun: 'sequence',
  plural: 'sequences',
  routes: sequenceBatch,
  createPermission: 'sequence.create',
  updatePermission: 'sequence.update',
  queryKey: sequencesApi.keys.all,
  list: sequencesApi.list,
  columns: [code, name, description, episode, frameIn, frameOut, { key: 'status', header: 'status', label: 'Status', type: 'text', options: STRUCTURE_STATUSES }],
  template: {
    needs: ['episode'],
    example: (n, p) => ({ code: `SQ${step(n)}`, name: `Sequence ${step(n)}`, episode: p.episode ?? '', ...frames(n), status: STRUCTURE_STATUSES[0] }),
  },
};

export const shotBulkSpec: BulkSpec = {
  noun: 'shot',
  plural: 'shots',
  routes: shotBatch,
  createPermission: 'shot.create',
  updatePermission: 'shot.update',
  queryKey: shotsApi.keys.all,
  list: shotsApi.list,
  columns: [
    code,
    name,
    description,
    { key: 'sequence_id', header: 'sequence', label: 'Sequence (code)', type: 'text', codeFrom: 'sequence_code' },
    episode,
    frameIn,
    frameOut,
    { key: 'handle_frames', header: 'handle_frames', label: 'Handles', type: 'number' },
    { key: 'status', header: 'status', label: 'Status', type: 'text', options: live(SHOT_STATUSES) },
  ],
  template: {
    needs: ['sequence'],
    // A shot is filed under its sequence's episode (D-12), so the example takes that one.
    example: (n, p) => ({
      code: `${p.sequence ?? 'SQ010'}_${step(n)}0`,
      name: `Shot ${step(n)}0`,
      sequence: p.sequence ?? '',
      episode: p.sequenceEpisode ?? '',
      ...frames(n),
      handle_frames: '8',
      status: live(SHOT_STATUSES)[0],
    }),
  },
};

export const assetBulkSpec: BulkSpec = {
  noun: 'asset',
  plural: 'assets',
  routes: assetBatch,
  createPermission: 'asset.create',
  updatePermission: 'asset.update',
  queryKey: assetsApi.keys.all,
  list: assetsApi.list,
  columns: [
    code,
    { ...name, required: true },
    description,
    { key: 'asset_type_id', header: 'asset_type', label: 'Asset type (code)', type: 'text', codeFrom: 'asset_type_code' },
    { key: 'category', header: 'category', label: 'Category', type: 'text', options: ASSET_CATEGORIES },
    { key: 'status', header: 'status', label: 'Status', type: 'text', options: live(ASSET_STATUSES) },
  ],
  template: {
    needs: ['assetType'],
    example: (n, p) => ({
      code: `AST${step(n)}`,
      name: `${ASSET_CATEGORIES[(n - 1) % ASSET_CATEGORIES.length]} ${step(n)}`,
      asset_type: p.assetType ?? '',
      category: ASSET_CATEGORIES[(n - 1) % ASSET_CATEGORIES.length],
      status: live(ASSET_STATUSES)[0],
    }),
  },
};

export const taskBulkSpec: BulkSpec = {
  noun: 'task',
  plural: 'tasks',
  routes: taskBatch,
  createPermission: 'task.create',
  updatePermission: 'task.update',
  queryKey: tasksApi.keys.all,
  list: tasksApi.list,
  columns: [
    code,
    { key: 'title', header: 'title', label: 'Title', type: 'text', required: true },
    description,
    { key: 'entity_type', header: 'entity_type', label: 'About', type: 'text', update: false, options: TASK_ENTITY_TYPES },
    { key: 'entity_id', header: 'entity', label: 'Shot, asset or sequence (code)', type: 'text', update: false },
    { key: 'task_type_id', header: 'task_type', label: 'Task type (code)', type: 'text', codeFrom: 'task_type_code' },
    { key: 'status', header: 'status', label: 'Status', type: 'text', options: live(TASK_STATUSES) },
    { key: 'priority', header: 'priority', label: 'Priority', type: 'text', options: TASK_PRIORITIES },
    { key: 'due_date', header: 'due_date', label: 'Due date (YYYY-MM-DD)', type: 'date' },
    { key: 'estimated_hours', header: 'estimated_hours', label: 'Estimated hours', type: 'number' },
  ],
  template: {
    needs: ['shot', 'asset', 'taskType'],
    // About the project's first shot, else its first asset, else nothing in particular.
    example: (n, p) => {
      const about = p.shot ? { entity_type: 'Shot', entity: p.shot } : p.asset ? { entity_type: 'Asset', entity: p.asset } : { entity_type: 'General', entity: '' };
      return {
        code: `${p.taskType ?? 'TASK'}${step(n)}`,
        title: `Task ${step(n)}`,
        ...about,
        task_type: p.taskType ?? '',
        status: live(TASK_STATUSES)[0],
        priority: 'Medium',
        estimated_hours: String(n * 8),
      };
    },
  },
};

/** The columns of `spec` for a project: the episode column only on an episodic one, create-only ones left out of an update. */
export function columnsFor(spec: BulkSpec, { episodic, mode }: { episodic: boolean; mode: 'create' | 'update' }): BulkColumn[] {
  return spec.columns.filter((column) => (episodic || !column.episodic) && (mode === 'create' || column.update !== false));
}
