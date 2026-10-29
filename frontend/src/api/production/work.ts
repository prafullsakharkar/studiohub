import { apiClient } from '@/api/client/ApiClient';
import { resourceApi } from '@/api/masterdata/resource';
import { archivable } from './structure';
import type { BulkResult, ExistenceResult } from './structure';

/**
 * Production work: shots, assets, tasks, timelogs, task templates. Row types are pinned to
 * docs/sync/samples/production/_work_flow.json (see backend-change-requests.md, "Phase 6 notes").
 *
 * Three rules the capture established:
 *  - reads name the parent `project_id`, writes take `project`; a task is linked with
 *    `entity_type` + `entity_id` (`shot_id` on a write is silently dropped);
 *  - write responses are NOT read-shaped (a task saved with `task_type_id` answers without any task type; the detail has `task_type_code`): re-read the record;
 *  - timelog hours are numbers on reads and strings on write responses; tasks carry hour strings.
 */
const V1 = '/api/v1';

export const SHOT_STATUSES = ['Not Started', 'In Progress', 'Pending Review', 'Approved', 'Retake', 'On Hold', 'Archived'] as const;
export const TASK_STATUSES = ['Not Started', 'In Progress', 'Pending Review', 'Approved', 'Retake', 'Archived'] as const;
export const ASSET_STATUSES = TASK_STATUSES;
export const TASK_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export const ASSET_CATEGORIES = ['Character', 'Environment', 'Vehicle', 'Prop', 'FX Rig', 'Shader & LookDev', 'Matte Painting', 'Crowd Agent', 'Costume / Groom'] as const;
export const TIMELOG_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected'] as const;
/** What a task is about; `General` is a project-level task with no link. */
export const TASK_ENTITY_TYPES = ['Shot', 'Asset', 'Sequence', 'General'] as const;
/** A template targets a shot or an asset only. */
export const TEMPLATE_ENTITY_TYPES = ['Shot', 'Asset'] as const;

export type ShotStatus = (typeof SHOT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TimelogStatus = (typeof TIMELOG_STATUSES)[number];

// ----------------------------------------------------------------------------------------------- shots

export interface Shot {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  status: string;
  frame_in: number;
  frame_out: number;
  frame_count: number;
  handle_frames: number;
  thumbnail_url: string;
  video_url: string;
  current_version: string;
  current_version_id: string | null;
  assigned_artist_id: string | null;
  assigned_artist_name: string;
  supervisor_approved: boolean;
  client_approved: boolean;
  /** `{layout, animation, fx, lighting, comp}` → stage status. */
  pipeline: Record<string, string>;
  project_id: string;
  project_code: string;
  sequence_id: string | null;
  sequence_code: string;
  episode_id: string | null;
  show_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface ShotInput {
  project: string;
  code: string;
  name?: string;
  description?: string;
  sequence_id?: string | null;
  /** Required by the server when the project is episodic. */
  episode_id?: string | null;
  show_id?: string | null;
  status?: string;
  frame_in?: number;
  frame_out?: number;
  handle_frames?: number;
  assigned_artist?: string | null;
}

/** `GET /shots/{id}/assets/`: a bare array. */
export interface ShotAssetLink {
  id: string;
  shot_id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  asset_category: string;
  asset_status: string;
  thumbnail_url: string;
  quantity: number;
  notes: string;
  created_at: string;
}
/** `GET /assets/{id}/shots/`: a bare array. */
export interface AssetShotLink {
  id: string;
  asset_id: string;
  shot_id: string;
  shot_code: string;
  shot_name: string;
  shot_status: string;
  quantity: number;
  notes: string;
  created_at: string;
}
/** `GET /{shots,tasks,timelogs}/{id}/status-history/`: a bare array, newest first. */
export interface StatusHistoryRow {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  from_status: string;
  to_status: string;
  reason: string;
  actor_id: string;
  actor_name: string;
  changed_at: string;
}

export const shotsApi = {
  ...archivable<Shot, ShotInput>('shots', `${V1}/shots/`),
  /** Only from Pending Review, and needs `shot.approve`; any other state is 400 `invalid_transition`. */
  approve: (id: string) => apiClient.post<Shot>(`${V1}/shots/${id}/approve/`, {}),
  /** Needs `production.code.rename`. */
  renameCode: (id: string, code: string) => apiClient.post<Shot>(`${V1}/shots/${id}/rename-code/`, { code }),
  statusHistory: (id: string, signal?: AbortSignal) => apiClient.get<StatusHistoryRow[]>(`${V1}/shots/${id}/status-history/`, { signal }),
  assets: (id: string, signal?: AbortSignal) => apiClient.get<ShotAssetLink[]>(`${V1}/shots/${id}/assets/`, { signal }),
  linkAsset: (id: string, input: { asset_id: string; quantity?: number; notes?: string }) => apiClient.post<ShotAssetLink>(`${V1}/shots/${id}/assets/`, input),
  updateAssetLink: (id: string, assetId: string, patch: { quantity?: number; notes?: string }) => apiClient.patch<ShotAssetLink>(`${V1}/shots/${id}/assets/${assetId}/`, patch),
  unlinkAsset: (id: string, assetId: string) => apiClient.delete<void>(`${V1}/shots/${id}/assets/${assetId}/`),
};

// ---------------------------------------------------------------------------------------------- assets

export interface Asset {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  category: string;
  status: string;
  version: string;
  software: string;
  file_format: string;
  poly_count: number;
  lod_levels: number;
  usd_prim_path: string;
  thumbnail_url: string;
  turntable_video_url: string;
  tags: string[];
  is_archived: boolean;
  asset_type_id: string | null;
  asset_type_code: string;
  asset_type_name: string;
  assigned_artist_id: string | null;
  assigned_artist_name: string;
  assigned_artist_avatar: string | null;
  department_id: string | null;
  department_name: string;
  team_id: string | null;
  team_name: string;
  parent_asset_id: string | null;
  project_id: string;
  project_code: string;
  project_name: string;
  show_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface AssetInput {
  project: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  status?: string;
  software?: string;
  file_format?: string;
  tags?: string[];
  asset_type_id?: string | null;
  assigned_artist?: string | null;
  parent_asset?: string | null;
  team?: string | null;
  show_id?: string | null;
}

export const assetsApi = {
  ...archivable<Asset, AssetInput>('assets', `${V1}/assets/`),
  /** Needs `production.code.rename`. */
  renameCode: (id: string, code: string) => apiClient.post<Asset>(`${V1}/assets/${id}/rename-code/`, { code }),
  shots: (id: string, signal?: AbortSignal) => apiClient.get<AssetShotLink[]>(`${V1}/assets/${id}/shots/`, { signal }),
};

// ----------------------------------------------------------------------------------------------- tasks

export interface Task {
  id: string;
  uuid: string;
  code: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  /** Decimal strings, unlike timelog hours. `pending_hours` can be negative. */
  estimated_hours: string;
  logged_hours: string;
  pending_hours: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  /** The link, readable only: set it with `entity_type` + `entity_id`. */
  shot_id: string | null;
  asset_id: string | null;
  sequence_id: string | null;
  task_type_id: string | null;
  task_type_code: string;
  task_type_name: string;
  department: string;
  department_id: string;
  team_id: string | null;
  team_name: string;
  assignee_id: string | null;
  assignee_name: string;
  assignee_role: string;
  assignee_avatar: string | null;
  reviewer_id: string | null;
  reviewer_name: string;
  reviewer_avatar: string | null;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  software: string;
  tags: string[];
  workflow: Record<string, unknown>;
  schedule: Record<string, unknown>;
  dependencies: Record<string, unknown>;
  is_archived: boolean;
  project_id: string;
  project_code: string;
  project_name: string;
  created_at: string;
  updated_at: string;
}
export interface TaskInput {
  project: string;
  title: string;
  code: string;
  entity_type?: string;
  entity_id?: string;
  task_type_id?: string | null;
  assignee?: string | null;
  reviewer?: string | null;
  team?: string | null;
  priority?: string;
  status?: string;
  due_date?: string | null;
  estimated_hours?: string | number;
  description?: string;
  tags?: string[];
  software?: string;
}

/** `bulk-status` answers 200, or 207 when any item failed: per-item `ok` / `error`. */
export interface BulkStatusResult {
  success: boolean;
  updated_count: number;
  failed_count: number;
  results: Array<{ id: string; ok: boolean; error: 'not_found' | 'invalid_transition' | null }>;
}
export interface BulkAssignResult {
  success: boolean;
  updated_count: number;
  results: Array<{ id: string; status: string }>;
}

export const tasksApi = {
  ...archivable<Task, TaskInput>('tasks', `${V1}/tasks/`),
  statusHistory: (id: string, signal?: AbortSignal) => apiClient.get<StatusHistoryRow[]>(`${V1}/tasks/${id}/status-history/`, { signal }),
  /** One of `assignee_id` / `team_id`; each assignee must be a member of every task's project. */
  bulkAssign: (taskIds: string[], target: { assignee_id?: string | null; team_id?: string | null }) => apiClient.post<BulkAssignResult>(`${V1}/tasks/bulk-assign/`, { task_ids: taskIds, ...target }),
  /** 1 to 100 ids. */
  bulkStatus: (taskIds: string[], status: string) => apiClient.post<BulkStatusResult>(`${V1}/tasks/bulk-status/`, { task_ids: taskIds, status }),
  /** Takes `task_ids` (not `ids`, unlike the other bulk routes); soft-archives. */
  bulkDelete: (taskIds: string[]) => apiClient.post<{ success: boolean; deleted_count: number }>(`${V1}/tasks/bulk-delete/`, { task_ids: taskIds }),
};

// -------------------------------------------------------------------------------------------- timelogs

export interface Timelog {
  id: string;
  uuid: string;
  task_id: string;
  task_code: string;
  task_title: string;
  person_id: string;
  person_name: string;
  person_role: string;
  person_avatar: string | null;
  /** A JSON number here; the create/patch response carries a string. */
  duration_hours: number;
  hourly_rate_usd: number;
  date: string;
  billable: boolean;
  notes: string;
  status: string;
  activity_category: string;
  department: string;
  adjustment_of: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  rejection_reason: string;
  project_id: string;
  project_code: string;
  project_name: string;
  created_at: string;
  updated_at: string;
}
export interface TimelogInput {
  task_id: string;
  /** Greater than zero, unless correcting an approved entry with `adjustment_of` (CR-14). */
  duration_hours: string | number;
  date: string;
  notes?: string;
  billable?: boolean;
  activity_category?: string;
  status?: 'Draft' | 'Submitted';
  adjustment_of?: string;
  /** Needs `timelog.manage` when it is not the caller. */
  person_id?: string;
}

export const timelogsApi = {
  ...resourceApi<Timelog, TimelogInput>('timelogs', `${V1}/timelogs/`),
  /** Needs `timelog.approve`, and the approver may not be the person who logged it. */
  approve: (id: string, overrideReason?: string) => apiClient.post<Timelog>(`${V1}/timelogs/${id}/approve/`, overrideReason ? { override_reason: overrideReason } : {}),
  reject: (id: string, rejectionReason: string) => apiClient.post<Timelog>(`${V1}/timelogs/${id}/reject/`, { rejection_reason: rejectionReason }),
  statusHistory: (id: string, signal?: AbortSignal) => apiClient.get<StatusHistoryRow[]>(`${V1}/timelogs/${id}/status-history/`, { signal }),
};

// ------------------------------------------------------------------------------------- task templates

export interface TemplateItem {
  id: string;
  name: string;
  order: number;
  default_bid_hours: string;
  task_type_id: string;
  task_type_code: string;
  task_type_name: string;
  department_name: string;
}
export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  /** Shot or Asset. */
  entity_type: string;
  is_active: boolean;
  /** `studio` templates are shared; writes need `tasktemplate.manage_studio`. */
  scope: 'studio' | 'project';
  project_id: string | null;
  project_code: string;
  items: TemplateItem[];
  created_at: string;
  updated_at: string;
}
export interface TaskTemplateInput {
  name: string;
  description?: string;
  entity_type?: string;
  is_active?: boolean;
  /** Omit for a studio template. */
  project_id?: string | null;
  items?: Array<{ task_type_id: string; name: string; order?: number; default_bid_hours?: string | number }>;
}
export interface TemplateApplyResult {
  created: Array<{ id: string; code: string; title: string; task_type_id: string; estimated_hours: string }>;
  /** Tasks that already existed for this record: applying twice creates nothing new. */
  existing: TemplateApplyResult['created'];
}

export const taskTemplatesApi = {
  ...resourceApi<TaskTemplate, TaskTemplateInput>('task-templates', `${V1}/task-templates/`),
  /** 201 with `created` the first time, 200 with the same tasks under `existing` after. */
  apply: (id: string, input: { project_id: string; entity_id: string }) => apiClient.post<TemplateApplyResult>(`${V1}/task-templates/${id}/apply/`, input),
  copyToProject: (id: string, input: { project_id: string; name?: string }) => apiClient.post<TaskTemplate>(`${V1}/task-templates/${id}/copy-to-project/`, input),
};

export type { BulkResult, ExistenceResult };
