import { apiClient } from '@/api/client/ApiClient';
import { resourceApi } from '@/api/masterdata/resource';
import { createQueryKeys } from '@/shared/data/queryKeys';
import { listFetcher } from '@/shared/data/listing';
import type { StatusHistoryRow } from './work';

/**
 * Production review: versions, reviews, playlists, media, workflows and automation rules. Row types are pinned
 * to docs/sync/samples/production/_review_flow.json (see backend-change-requests.md, "Phase 7 notes").
 *
 * Rules the capture established:
 *  - the JSON lists on a version (`reviews`, `playlists`, `notes_list`, `media_items`, `activity`, `attachments`) are
 *    caches (DECISIONS D-18): nothing here reads them; the review, playlist and media records are the truth;
 *  - versions are filtered by `entity_type` + `entity_id` (`shot_id`, `task_id`, `asset_id`, `artist`, `is_hero` are ignored);
 *  - approving what you produced is 403 `separation_of_duties` on every path (D-04);
 *  - `simulate` on a workflow is a stub and nothing executes automation rules (§ Phase 7 notes).
 */
const V1 = '/api/v1';

export const REVIEW_STATUSES = ['Pending Review', 'Submitted', 'In Review', 'Approved', 'Rejected', 'Changes Requested', 'Retake', 'Closed'] as const;

// ---------------------------------------------------------------------------------------------- versions

export interface Version {
  id: string;
  uuid: string;
  code: string;
  /** Numbered by the server (`v001`…); a number sent on create is ignored. */
  version_number: string;
  version_index: number;
  status: string;
  department: string;
  notes: string;
  changelog: string;
  tags: string[];
  is_published: boolean;
  is_hero: boolean;
  is_archived: boolean;
  published_at: string | null;
  published_by_id: string | null;
  publishing_info: Record<string, unknown>;
  artist_id: string | null;
  artist_name: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  shot_id: string | null;
  asset_id: string | null;
  task_id: string | null;
  frame_range: string;
  start_frame: number | null;
  end_frame: number | null;
  resolution: string;
  fps: string;
  color_space: string;
  file_path: string;
  file_size_mb: string;
  source_file_url: string;
  video_url: string;
  thumbnail_url: string;
  /** Caches (D-18): do not read. */
  activity: unknown[];
  attachments: unknown[];
  media_items: unknown[];
  notes_list: unknown[];
  playlists: unknown[];
  reviews: unknown[];
  project_id: string;
  project_code: string;
  created_at: string;
  updated_at: string;
}
export interface VersionInput {
  project: string;
  /** About a shot or an asset, not both (400). A task alone takes the task's shot or asset. */
  shot?: string | null;
  asset?: string | null;
  task?: string | null;
  code?: string;
  department?: string;
  artist?: string | null;
  notes?: string;
  changelog?: string;
  tags?: string[];
  resolution?: string;
  fps?: string | number;
  start_frame?: number | null;
  end_frame?: number | null;
  color_space?: string;
  file_path?: string;
  source_file_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  status?: string;
}

export const versionsApi = {
  ...resourceApi<Version, VersionInput>('versions', `${V1}/versions/`),
  /** Versions have no bulk routes. Archiving a published version is a 400: unpublish first. */
  archive: (id: string) => apiClient.post<Version>(`${V1}/versions/${id}/archive/`, {}),
  restoreOne: (id: string) => apiClient.post<Version>(`${V1}/versions/${id}/restore/`, {}),
  archived: listFetcher<Version>(`${V1}/versions/archived/`),
  /** Needs an approved version (400 otherwise) and `version.publish`. The body is merged into `publishing_info`. */
  publish: (id: string, publishingInfo: Record<string, unknown> = {}) => apiClient.post<Version>(`${V1}/versions/${id}/publish/`, publishingInfo),
  unpublish: (id: string) => apiClient.post<Version>(`${V1}/versions/${id}/unpublish/`, {}),
  /** Makes it the hero of its shot or asset (demoting the previous one) and approves it, so separation of duties applies. */
  promote: (id: string, overrideReason?: string) => apiClient.post<Version>(`${V1}/versions/${id}/promote/`, overrideReason ? { override_reason: overrideReason } : {}),
  /** An existing playlist (`playlist_id`) or a new one (`playlist_name`); answers the version. */
  addToPlaylist: (id: string, target: { playlist_id?: string; playlist_name?: string }) => apiClient.post<Version>(`${V1}/versions/${id}/add-to-playlist/`, target),
  statusHistory: (id: string, signal?: AbortSignal) => apiClient.get<StatusHistoryRow[]>(`${V1}/versions/${id}/status-history/`, { signal }),
};

// ----------------------------------------------------------------------------------------------- reviews

export interface ReviewVersion {
  /** The version's id; `item_id` is the row that puts it on this review. */
  id: string;
  item_id: string;
  code: string;
  version_number: string;
  status: string;
  order: number;
}
export interface ReviewParticipant {
  id: string;
  legacy_id: string;
  /** Null for a person who only has a name (converted old data). */
  user_id: string | null;
  name: string;
  role: string;
  verdict: string;
  verdict_date: string | null;
  verdict_notes: string;
}
export interface ReviewComment {
  id: string;
  author: string;
  author_id: string | null;
  text: string;
  frame_number: number | null;
  timecode: string | null;
  tags: string[];
  is_client_visible: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by_id: string | null;
  parent_id: string | null;
  replies: ReviewComment[];
  created_at: string;
}
export interface ReviewNote {
  id: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  category: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}
export interface ReviewAnnotation {
  id: string;
  author_id: string | null;
  author_name: string;
  comment: string;
  frame_number: number | null;
  timecode: string | null;
  drawing_coordinates: Record<string, unknown> | null;
  created_at: string;
}
export interface ReviewActivity {
  id: string;
  action: string;
  user: string;
  notes: string;
  timestamp: string;
}
export interface Review {
  id: string;
  uuid: string;
  code: string;
  title: string;
  description: string;
  status: string;
  supervisor_verdict: string;
  lead_reviewer_name: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  thumbnail_url: string;
  video_url: string;
  client: Record<string, unknown>;
  vendor: Record<string, unknown>;
  versions: ReviewVersion[];
  /** The review's participants. */
  reviewers: ReviewParticipant[];
  comments: ReviewComment[];
  notes: ReviewNote[];
  annotations: ReviewAnnotation[];
  activity: ReviewActivity[];
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface ReviewInput {
  project: string;
  title: string;
  code: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  thumbnail_url?: string;
  video_url?: string;
}

const reviewBase = `${V1}/reviews/`;
const reviewPost = (id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<Review>(`${reviewBase}${id}/${action}/`, body);

export const reviewsApi = {
  ...resourceApi<Review, ReviewInput>('reviews', reviewBase),
  archived: listFetcher<Review>(`${reviewBase}archived/`),
  /** `archive` is unmapped on reviews (403 for everyone, CR-15): `remove` (DELETE, `review.delete`) archives. */
  restoreOne: (id: string) => reviewPost(id, 'restore'),
  // status machine (see statusFlow.ts); the decisions need `review.approve`, the rest `review.update`
  submit: (id: string) => reviewPost(id, 'submit'),
  startReview: (id: string) => reviewPost(id, 'start-review'),
  approve: (id: string, notes?: string) => reviewPost(id, 'approve', notes ? { notes } : {}),
  reject: (id: string, notes?: string) => reviewPost(id, 'reject', notes ? { notes } : {}),
  requestChanges: (id: string, notes?: string) => reviewPost(id, 'request-changes', notes ? { notes } : {}),
  /** A decision by name, e.g. `Retake`; the same transition table applies. */
  verdict: (id: string, verdict: string, notes?: string) => reviewPost(id, 'verdict', { verdict, ...(notes ? { notes } : {}) }),
  close: (id: string) => reviewPost(id, 'close'),
  statusHistory: (id: string, signal?: AbortSignal) => apiClient.get<StatusHistoryRow[]>(`${reviewBase}${id}/status-history/`, { signal }),
  // the parts: adding a version or participant and resolving or reopening a comment answer the whole review;
  // adding a comment, note or annotation answers the new part
  addVersion: (id: string, versionId: string) => reviewPost(id, 'versions', { version_id: versionId }),
  removeVersion: (id: string, versionId: string) => apiClient.delete<Review>(`${reviewBase}${id}/versions/${versionId}/`),
  /** The user must be an active member of the project; a user once per review. */
  addParticipant: (id: string, input: { user_id: string; role?: string }) => reviewPost(id, 'participants', input),
  removeParticipant: (id: string, participantId: string) => apiClient.delete<Review>(`${reviewBase}${id}/participants/${participantId}/`),
  /** Accepted only from the participant's own account; an approving verdict is subject to separation of duties. */
  participantVerdict: (id: string, input: { participant_id: string; verdict: string; notes?: string }) => reviewPost(id, 'participant-verdict', input),
  addComment: (id: string, input: { text: string; frame_number?: number | null; timecode?: string | null; tags?: string[]; is_client_visible?: boolean; parent_id?: string | null }) => apiClient.post<ReviewComment>(`${reviewBase}${id}/comments/`, input),
  resolveComment: (id: string, commentId: string) => apiClient.post<Review>(`${reviewBase}${id}/comments/${commentId}/resolve/`, {}),
  reopenComment: (id: string, commentId: string) => apiClient.post<Review>(`${reviewBase}${id}/comments/${commentId}/reopen/`, {}),
  addNote: (id: string, input: { content: string; category?: string; is_pinned?: boolean }) => apiClient.post<ReviewNote>(`${reviewBase}${id}/notes/`, input),
  addAnnotation: (id: string, input: { comment?: string; frame_number?: number | null; timecode?: string | null; drawing_coordinates?: Record<string, unknown> | null }) => apiClient.post<ReviewAnnotation>(`${reviewBase}${id}/annotations/`, input),
};

// ----------------------------------------------------------------------------------------------- playlists

export interface PlaylistEntry {
  id: string;
  /** Null for a placeholder entry (an empty `add-entry`). */
  version_id: string | null;
  version_number?: string;
  item_order: number;
  legacy_id: string;
}
export interface PlaylistShareSettings {
  is_public?: boolean;
  allow_client_approval?: boolean;
  require_passcode?: boolean;
  client_id?: string;
  expires_at?: string | null;
}
export interface Playlist {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  status: string;
  client_only: boolean;
  is_archived: boolean;
  entries: PlaylistEntry[];
  share_settings: PlaylistShareSettings;
  activity: unknown[];
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface PlaylistInput {
  project: string;
  name: string;
  code: string;
  description?: string;
  client_only?: boolean;
  /** Entries are set on create only; afterwards use add-entry, remove-entry and reorder (400 otherwise). */
  entries?: Array<{ version_id: string }>;
  share_settings?: PlaylistShareSettings;
}

const playlistBase = `${V1}/playlists/`;
export const playlistsApi = {
  ...resourceApi<Playlist, PlaylistInput>('playlists', playlistBase),
  archive: (id: string) => apiClient.post<Playlist>(`${playlistBase}${id}/archive/`, {}),
  restoreOne: (id: string) => apiClient.post<Playlist>(`${playlistBase}${id}/restore/`, {}),
  archived: listFetcher<Playlist>(`${playlistBase}archived/`),
  /** A version of the playlist's project, or none (a placeholder entry). The same version may be added twice. */
  addEntry: (id: string, input: { version_id?: string } = {}) => apiClient.post<Playlist>(`${playlistBase}${id}/add-entry/`, input),
  /** Unknown id: 200 and nothing changes. */
  removeEntry: (id: string, entryId: string) => apiClient.post<Playlist>(`${playlistBase}${id}/remove-entry/`, { entry_id: entryId }),
  /** The listed entries come first in this order; unlisted ones follow in their old order. */
  reorder: (id: string, entryIds: string[]) => apiClient.post<Playlist>(`${playlistBase}${id}/reorder/`, { entries: entryIds.map((entryId) => ({ id: entryId })) }),
  share: (id: string, settings: PlaylistShareSettings) => apiClient.post<Playlist>(`${playlistBase}${id}/share/`, settings),
};

// --------------------------------------------------------------------------------------------------- media

export interface Media {
  id: string;
  uuid: string;
  code: string;
  name: string;
  title: string;
  file_name: string;
  media_type: string;
  category: string;
  file_format: string;
  storage_tier: string;
  source_url: string;
  preview_url: string;
  thumbnail_url: string;
  file_size_mb: string;
  resolution: string;
  entity_type: string;
  entity_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface MediaInput {
  project: string;
  entity_type: string;
  entity_id: string;
  /** Free text on the server (default `image`); it accepts any value. */
  media_type: string;
  category?: string;
  file_format?: string;
  storage_tier?: string;
  source_url?: string;
  preview_url?: string;
  thumbnail_url?: string;
  file_size_mb?: number | string;
  resolution?: string;
}

const mediaBase = `${V1}/media/`;
export const mediaApi = {
  /** The list is a bare array. `archive` is unmapped (403 for everyone, CR-15): DELETE (`media.delete`) archives. */
  ...resourceApi<Media, MediaInput>('media', mediaBase),
  archived: listFetcher<Media>(`${mediaBase}archived/`),
  restoreOne: (id: string) => apiClient.post<Media>(`${mediaBase}${id}/restore/`, {}),
};

// ----------------------------------------------------------------------------------------------- workflows

export interface Workflow {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  category: string;
  department: string;
  is_active: boolean;
  is_archived: boolean;
  nodes: Array<Record<string, unknown>>;
  transitions: Array<Record<string, unknown>>;
  automation_rules: unknown[];
  execution_stats: Record<string, unknown>;
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface WorkflowInput {
  project: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  department?: string;
  is_active?: boolean;
  nodes?: Array<Record<string, unknown>>;
  transitions?: Array<Record<string, unknown>>;
  automation_rules?: unknown[];
}
/** A stub: every node of the stored graph is reported as a success; nothing is evaluated. */
export interface WorkflowSimulation {
  simulation_id: string;
  overall_status: string;
  steps: Array<{ node: string; status: string }>;
  side_effects: unknown[];
  audit_entry: Record<string, unknown>;
}

const workflowBase = `${V1}/workflows/`;
export const workflowsApi = {
  ...resourceApi<Workflow, WorkflowInput>('workflows', workflowBase),
  archive: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/archive/`, {}),
  restoreOne: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/restore/`, {}),
  archived: listFetcher<Workflow>(`${workflowBase}archived/`),
  activate: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/activate/`, {}),
  deactivate: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/deactivate/`, {}),
  /** An inactive copy named "<name> (Copy)" with code "<code>-COPY"; codes are not unique, so a second clone repeats it. */
  clone: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/clone/`, {}),
  simulate: (id: string) => apiClient.post<WorkflowSimulation>(`${workflowBase}${id}/simulate/`, {}),
};

// --------------------------------------------------------------------------------------------- automations

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: { event: string; entity_type: string; filters: Record<string, unknown> };
  conditions: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  is_active: boolean;
  required_role: string;
  workflow_id: string | null;
  execution_count: number;
  last_triggered_at: string | null;
  last_status: string;
  created_at: string;
  updated_at: string;
}
export interface AutomationRuleInput {
  name: string;
  description?: string;
  /** An object (a bare string is a 400). */
  trigger: { event: string; entity_type?: string; filters?: Record<string, unknown> };
  conditions?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  is_active?: boolean;
  required_role?: string;
  /** Required for anyone but a platform administrator; a rule without a project is a studio-wide rule. */
  project_id?: string;
}

export const automationKeys = createQueryKeys('automation-rules');
const ruleBase = `${V1}/automations/rules/`;
/** Rules are stored definitions: nothing in the backend fires them yet (`execution_count` stays 0). */
export const automationsApi = {
  rules: listFetcher<AutomationRule>(ruleBase),
  get: (id: string, signal?: AbortSignal) => apiClient.get<AutomationRule>(`${ruleBase}${id}/`, { signal }),
  create: (input: AutomationRuleInput) => apiClient.post<AutomationRule>(ruleBase, input),
  update: (id: string, patch: Partial<AutomationRuleInput>) => apiClient.patch<AutomationRule>(`${ruleBase}${id}/`, patch),
  remove: (id: string) => apiClient.delete<void>(`${ruleBase}${id}/`),
  auditLogs: listFetcher<Record<string, unknown>>(`${V1}/automations/audit-logs/`),
};

