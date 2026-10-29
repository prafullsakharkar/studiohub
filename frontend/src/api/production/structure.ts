import { apiClient } from '@/api/client/ApiClient';
import { resourceApi } from '@/api/masterdata/resource';
import { listFetcher } from '@/shared/data/listing';
import type { Page } from '@/shared/data/listing';

/**
 * Production structure: projects, shows, episodes, sequences, editorial tracks, members and the
 * project-scoped read views. Row types are pinned to docs/sync/samples/production/_structure_flow.json.
 *
 * Reads return `project_id` / `episode_id` / `show_id`; writes take `project`, `episode_id`, `show`.
 */
export const PROJECT_TYPES = ['Feature Film', 'Episodic Series', 'Commercial', 'Game Cinematic'] as const;
export const PROJECT_STATUSES = ['In Progress', 'Pending Review', 'Approved', 'Archived', 'On Hold'] as const;
export const PROJECT_WORKFLOWS = ['standard', 'episodic'] as const;
export const TRACK_TYPES = ['Video', 'Audio', 'VFX Plates', 'Reference', 'Subtitles', 'Markers'] as const;

export interface Project {
  id: string;
  uuid: string;
  code: string;
  project_code: string;
  name: string;
  description: string;
  type: (typeof PROJECT_TYPES)[number];
  status: (typeof PROJECT_STATUSES)[number];
  workflow_type: (typeof PROJECT_WORKFLOWS)[number];
  fps: string | number;
  resolution: string;
  aspect_ratio: string;
  color_space: string;
  start_date: string | null;
  delivery_date: string | null;
  budget_usd: string;
  thumbnail_url: string;
  client_id: string;
  client_name: string;
  client_contact_id: string;
  client_contact_name: string;
  supervisor_id: string | null;
  supervisor_name: string;
  coordinator_id: string | null;
  coordinator_name: string;
  vendor_ids: string[];
  vendor_names: string[];
  vendor_team_ids: string[];
  total_shots: number;
  total_assets: number;
  approved_shots: number;
  in_progress_shots: number;
  created_at: string;
  updated_at: string;
}

/** Writable project fields (the rest is derived). `client` is a client id. */
export interface ProjectInput {
  code: string;
  name: string;
  type?: Project['type'];
  status?: Project['status'];
  workflow_type?: Project['workflow_type'];
  description?: string;
  fps?: number;
  resolution?: string;
  aspect_ratio?: string;
  color_space?: string;
  start_date?: string | null;
  delivery_date?: string | null;
  budget_usd?: number;
  client_id?: string;
}

export interface Show {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  type: string;
  season: number | string | null;
  status: string;
  is_primary: boolean;
  start_date: string | null;
  delivery_date: string | null;
  thumbnail_url: string;
  project_id: string;
  project_code: string;
  created_at: string;
  updated_at: string;
}
export interface ShowInput {
  project: string;
  code: string;
  name: string;
  description?: string;
  is_primary?: boolean;
  start_date?: string | null;
  delivery_date?: string | null;
}

export interface Episode {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  episode_number: number | null;
  season_number: number | null;
  status: string;
  air_date: string | null;
  delivery_date: string | null;
  duration_frames: number | null;
  frame_in: number;
  frame_out: number;
  metadata: Record<string, unknown>;
  is_deleted: boolean;
  deleted_at: string | null;
  project_id: string;
  project_code: string;
  project_name: string;
  show_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface EpisodeInput {
  project: string;
  code: string;
  name?: string;
  show?: string | null;
  description?: string;
  episode_number?: number | null;
  season_number?: number | null;
  air_date?: string | null;
  delivery_date?: string | null;
}

export interface Sequence {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  status: string;
  department: string;
  frame_in: number;
  frame_out: number;
  tags: string[];
  metadata: Record<string, unknown>;
  shots_count: number;
  lead_artist: string | null;
  lead_artist_id: string | null;
  lead_artist_name: string;
  is_deleted: boolean;
  deleted_at: string | null;
  episode_id: string | null;
  show_id: string | null;
  project_id: string;
  project_code: string;
  project_name: string;
  created_at: string;
  updated_at: string;
}
export interface SequenceInput {
  project: string;
  code: string;
  name?: string;
  /** Required when the project is episodic. */
  episode_id?: string | null;
  description?: string;
  frame_in?: number;
  frame_out?: number;
}

export interface EditorialTrack {
  id: string;
  uuid: string;
  name: string;
  track_type: (typeof TRACK_TYPES)[number];
  track_number: number;
  status: string;
  start_tc: string;
  end_tc: string;
  clip_count: number;
  cut_id: string | null;
  cut_name: string;
  project_id: string;
  project_code: string;
  updated_at: string;
}
export interface EditorialTrackInput {
  project: string;
  name: string;
  track_type?: EditorialTrack['track_type'];
  track_number?: number;
}

export interface ProjectMember {
  id: string;
  user_id: string;
  userId: string;
  project_id: string;
  projectId: string;
  project_code: string;
  project_name: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  roles: string[];
  role_id: string | null;
  scope: string;
  status: string;
  department: string;
  department_id: string;
  team_id: string;
  client_id: string;
  vendor_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectNote {
  id: string;
  subject: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  tags: string[];
  author_id: string;
  author_name: string;
  author_role: string;
  author_avatar: string;
  addressed_at: string | null;
  addressed_by: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  frame_number: number | null;
  timecode_ref: string;
  project_id: string;
  project_code: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCounts {
  approved_shots: number;
  assets: number;
  completed_tasks: number;
  deliveries: number;
  editorial: number;
  in_progress_shots: number;
  notes: number;
  reviews: number;
  sequences: number;
  shots: number;
  tasks: number;
  versions: number;
}

const V1 = '/api/v1';

export const projectsApi = {
  ...resourceApi<Project, ProjectInput>('projects', `${V1}/projects/`),
  /** Archive = `DELETE` (204). `POST {id}/archive/` does the same since CR-13 was applied; DELETE needs no body. */
  archive: (id: string) => apiClient.delete<void>(`${V1}/projects/${id}/`),
  restore: (id: string) => apiClient.post<Project>(`${V1}/projects/${id}/restore/`, {}),
  archived: listFetcher<Project>(`${V1}/projects/archived/`),
  statistics: (id: string, signal?: AbortSignal) => apiClient.get<ProjectCounts>(`${V1}/projects/${id}/statistics/`, { signal }),
  dashboard: (id: string, signal?: AbortSignal) => apiClient.get<ProjectDashboard>(`${V1}/projects/${id}/dashboard/`, { signal }),
};

export interface ProjectDashboard {
  activity: Array<{ id: string; action: string; description: string; entity_type: string; entity_code: string; entity_id: string; timestamp: string; user_name: string }>;
  [section: string]: unknown;
}

export const showsApi = resourceApi<Show, ShowInput>('shows', `${V1}/shows/`);
export const tracksApi = resourceApi<EditorialTrack, EditorialTrackInput>('editorial-tracks', `${V1}/editorial/tracks/`);

/** Episodes and sequences: soft-deletable, with archive/restore and the bulk routes. */
export function archivable<Row, Input>(name: string, base: string) {
  return {
    ...resourceApi<Row, Input>(name, base),
    archive: (id: string) => apiClient.post<Row>(`${base}${id}/archive/`, {}),
    restoreOne: (id: string) => apiClient.post<Row>(`${base}${id}/restore/`, {}),
    archived: listFetcher<Row>(`${base}archived/`),
    bulkCreate: (projectId: string, items: Array<{ code: string; data: Record<string, unknown> }>) => apiClient.post<BulkResult>(`${base}bulk-create/`, { project_id: projectId, items }),
    bulkUpdate: (items: Array<{ id: string; data: Record<string, unknown> }>) => apiClient.post<BulkResult>(`${base}bulk-update/`, { items }),
    bulkArchive: (ids: string[]) => apiClient.post<BulkResult>(`${base}bulk-archive/`, { ids }),
    bulkRestore: (ids: string[]) => apiClient.post<BulkResult>(`${base}bulk-restore/`, { ids }),
    checkExistence: (projectId: string, codes: string[]) => apiClient.post<ExistenceResult>(`${base}check-existence/`, { project_id: projectId, codes }),
  };
}
export const episodesApi = archivable<Episode, EpisodeInput>('episodes', `${V1}/episodes/`);
export const sequencesApi = archivable<Sequence, SequenceInput>('sequences', `${V1}/sequences/`);

/** Bulk routes answer 200 even when items failed: read `failed` / `results[]`. */
export interface BulkResult {
  operation_id: string;
  processed: number;
  successful?: number;
  failed: number;
  success: boolean;
  partial_success: boolean;
  results: Array<{ index: number; code?: string | null; id?: string | null; status: string; actionTaken: string; success?: boolean; error?: unknown; entity?: unknown }>;
  [field: string]: unknown;
}
export interface ExistenceResult {
  items: Array<{ code: string; state?: string; existing_entity?: unknown; [field: string]: unknown }>;
  [field: string]: unknown;
}

/** `/api/organizations/projects/{id}/…`: the project-scoped tree (404, not 403, for non-members). */
const scoped = (projectId: string) => `/api/organizations/projects/${projectId}`;
export const projectScopedApi = {
  summary: (projectId: string, signal?: AbortSignal) => apiClient.get<{ counts: ProjectCounts; project: Project; [k: string]: unknown }>(`${scoped(projectId)}/summary/`, { signal }),
  members: (projectId: string, signal?: AbortSignal) => apiClient.get<{ count: number; results: ProjectMember[] }>(`${scoped(projectId)}/members/`, { signal }),
  /** 201 when new, 200 when already a member, 404 "User not found." for an unknown e-mail. */
  addMember: (projectId: string, input: { user_id?: string; email?: string; role: string }) => apiClient.post<ProjectMember>(`${scoped(projectId)}/members/`, input),
  notes: (projectId: string, signal?: AbortSignal) => apiClient.get<Page<ProjectNote>>(`${scoped(projectId)}/notes/`, { signal }),
  addNote: (projectId: string, input: { subject: string; body?: string; category?: string }) => apiClient.post<ProjectNote>(`${scoped(projectId)}/notes/`, input),
  activity: (projectId: string, signal?: AbortSignal) => apiClient.get<Page<Record<string, unknown>>>(`${scoped(projectId)}/activity/`, { signal }),
  pipeline: (projectId: string, signal?: AbortSignal) => apiClient.get<ProjectPipeline>(`${scoped(projectId)}/pipeline/`, { signal }),
  resources: (projectId: string, signal?: AbortSignal) => apiClient.get<ProjectResources>(`${scoped(projectId)}/resources/`, { signal }),
  schedule: (projectId: string, signal?: AbortSignal) => apiClient.get<ProjectSchedule>(`${scoped(projectId)}/schedule/`, { signal }),
  files: (projectId: string, signal?: AbortSignal) => apiClient.get<Page<Record<string, unknown>>>(`${scoped(projectId)}/files/`, { signal }),
};

export interface ProjectPipeline {
  project_id: string;
  aspect_ratio: string;
  color_space: string;
  fps: number;
  resolution: string;
  ocio_config: string;
  usd_schema_version: string;
  dcc_integrations: Array<{ name: string; plugin: string; version: string }>;
  pipeline_steps: unknown[];
}
export interface ProjectResources {
  project_id: string;
  total_artists: number;
  artists: unknown[];
  departments: unknown[];
}
export interface ProjectSchedule {
  project_id: string;
  start_date: string | null;
  delivery_date: string | null;
  milestones: unknown[];
}
