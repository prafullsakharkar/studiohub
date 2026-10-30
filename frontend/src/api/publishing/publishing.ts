import { apiClient } from '@/api/client/ApiClient';
import { resourceApi } from '@/api/masterdata/resource';

/**
 * Publishing: export jobs ("publishes"), the registry of published files, storage roots and destinations. Row types
 * are pinned to docs/sync/samples/publishing/_flow.json (see backend-change-requests.md, "Phase 9 findings"; the
 * backend's own contracts are docs/publishing/CONTRACTS.md).
 *
 * Rules the capture established:
 *  - a job's `status` is a legacy word (Queued, Publishing, Published, Failed, Unpublished) that calls both Validated
 *    and Exported "Published"; `job_status` is the real one and is what the screens show and decide by;
 *  - a job moves only through its actions; `status` and `job_status` are read-only;
 *  - the job list filters nothing (`status`, `job_status`, `dcc_tool`, `version_id`, `project_id` all answer the same
 *    rows) and its rows carry no project id: only `search` and `ordering` work (CR-22);
 *  - a file is registered once and never edited: PUT, PATCH and DELETE are 405, only its status moves
 *    (Registered → Deprecated → Registered, Registered or Deprecated → Revoked, which is final);
 *  - a file's `revoke_reason` is shown only to holders of `publishing.revoke`;
 *  - nothing returns file contents: the registry records where a file is and what its checksum is.
 */
const V1 = '/api/v1/publishing';
const jobs = `${V1}/`;
const files = `${V1}/files/`;

/** The real state of an export job. */
export const JOB_STATUSES = ['Pending', 'Validating', 'Validated', 'Exporting', 'Exported', 'Failed', 'Cancelled'] as const;
export const DCC_TOOLS = ['Maya', 'Houdini', 'Blender', 'Nuke', 'Maya Light', 'Cinema 4D', '3ds Max', 'Unreal', 'USD'] as const;
export const FILE_ROLES = ['main', 'proxy', 'thumbnail', 'sidecar'] as const;
export const FILE_STATUSES = ['Registered', 'Deprecated', 'Revoked'] as const;
export const DESTINATION_TYPES = ['Storage Cluster', 'Client Delivery Ingest', 'Render Farm Cache', 'Cloud S3 Bucket', 'Vendor Ingest', 'Daily Review Repo', 'USD Asset Cache'] as const;
export const DESTINATION_PROTOCOLS = ['NFS', 'SMB', 'S3', 'Aspera', 'Local POSIX'] as const;

// ------------------------------------------------------------------------------------------------ jobs

export interface PublishRow {
  id: string;
  code: string;
  name: string;
  /** The legacy word. Use `job_status`. */
  status: string;
  job_status: string;
  /** Despite the name this is the project's name. */
  client_name: string;
  dcc_tool: string;
  dcc_tool_display: string;
  dcc_version: string;
  entity_type: string;
  entity_type_display: string;
  entity_code: string;
  entity_name: string;
  source_file: string;
  export_path: string;
  export_format: string;
  retry_count: number;
  is_archived: boolean;
  is_failed: boolean;
  is_success: boolean;
  created_at: string;
  updated_at: string;
}

export interface Publish {
  id: string;
  code: string;
  name: string;
  status: string;
  job_status: string;
  project: string | null;
  project_name: string;
  dcc_tool: string;
  dcc_tool_display: string;
  dcc_version: string;
  entity_type: string;
  entity_type_display: string;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  source_file: string;
  source_version: string;
  export_path: string;
  export_format: string;
  export_options: Record<string, unknown>;
  validation_rules: Record<string, unknown>;
  /** The stored summary of the last validation; `{}` before the first. */
  validation_results: { checked_at?: string; passed?: boolean; counts?: { passed: number; failed: number; warning: number; not_checked: number }; results?: unknown[] };
  error_message: string;
  retry_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublishInput {
  name: string;
  dcc_tool: string;
  /** Required on create (an id or a code) unless the caller is a platform administrator; a job never changes project. */
  project_id?: string;
  /** A published version of the project; the job then takes the shot or asset from it. */
  version_id?: string | null;
  /** Required unless the version names a shot or asset. */
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  entity_name?: string;
  code?: string;
  dcc_version?: string;
  source_file?: string;
  source_version?: string;
  export_path?: string;
  export_format?: string;
  export_options?: Record<string, unknown>;
  validation_rules?: Record<string, unknown>;
}

export interface PublishValidateResult {
  success: boolean;
  publish_id: string;
  status: string;
  /** No blocking rule failed. With no rules configured it is true and nothing was checked (`counts` all zero). */
  all_passed: boolean;
  checked_at: string;
  counts: { passed: number; failed: number; warning: number; not_checked: number };
  validation_results: Array<{ rule?: string; name?: string; status: string; message?: string; passed: boolean | null }>;
}

// ------------------------------------------------------------------------------------------------ files

export interface PublishedFile {
  id: string;
  version_id: string;
  project_id: string;
  /** The storage root's code. */
  storage_root: string;
  relative_path: string;
  role: string;
  /** The file type's code; empty when none. */
  file_type: string;
  size_bytes: number;
  sha256: string;
  frame_start: number | null;
  frame_end: number | null;
  checksum_state: string;
  checksum_checked_at: string | null;
  status: string;
  status_changed_at: string | null;
  /** Empty unless the caller holds `publishing.revoke`. */
  revoke_reason: string;
  export_job_id: string | null;
  created_by_id: string | null;
  created_at: string;
}

export interface PublishedFileInput {
  version_id: string;
  storage_root: string;
  relative_path: string;
  size_bytes: number;
  sha256: string;
  role?: string;
  file_type?: string;
  frame_start?: number | null;
  frame_end?: number | null;
  export_job_id?: string | null;
}

export interface BulkRegisterResult {
  success: boolean;
  succeeded_count: number;
  failed_count: number;
  results: Array<{ index: number; ok: boolean; id: string | null; error: string | null; fields?: Record<string, string[]> }>;
}

// ------------------------------------------------------------------------------- storage roots, destinations

export interface StorageRoot {
  id: string;
  code: string;
  name: string;
  linux_path: string;
  windows_path: string;
  mac_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface StorageRootInput {
  code: string;
  name: string;
  linux_path?: string;
  windows_path?: string;
  mac_path?: string;
  is_active?: boolean;
}

export interface PublishDestination {
  id: string;
  name: string;
  type: string;
  path: string;
  protocol: string;
  region: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface PublishDestinationInput {
  name: string;
  type: string;
  path: string;
  protocol: string;
  region?: string;
  is_default?: boolean;
  is_active?: boolean;
}

// -------------------------------------------------------------------------------------------- the API

const post = <T>(id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<T>(`${jobs}${id}/${action}/`, body);
const filePost = <T>(id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<T>(`${files}${id}/${action}/`, body);

export const publishApi = {
  ...resourceApi<PublishRow, PublishInput>('publishing', jobs),
  get: (id: string, signal?: AbortSignal) => apiClient.get<Publish>(`${jobs}${id}/`, { signal }),
  create: (input: PublishInput) => apiClient.post<Publish>(jobs, input),
  update: (id: string, patch: Partial<Omit<PublishInput, 'project_id' | 'version_id' | 'code'>>) => apiClient.patch<Publish>(`${jobs}${id}/`, patch),

  validate: (id: string) => post<PublishValidateResult>(id, 'validate'),
  startExport: (id: string) => post<Publish>(id, 'start-export'),
  completeExport: (id: string) => post<Publish>(id, 'complete-export'),
  fail: (id: string, reason: string) => post<Publish>(id, 'fail', { reason }),
  retry: (id: string) => post<Publish>(id, 'retry'),
  /** Cancels the job; the reason is kept. Only before the export started or after it failed. */
  unpublish: (id: string, reason?: string) => post<Publish>(id, 'unpublish', reason ? { reason } : {}),
  /** A new Pending job from this one (any status); answers the new job. */
  republish: (id: string, comment?: string) => post<Publish>(id, 'republish', comment ? { comment } : {}),
};

export const publishedFilesApi = {
  ...resourceApi<PublishedFile, PublishedFileInput>('published-files', files),
  create: (input: PublishedFileInput) => apiClient.post<PublishedFile>(files, input),
  deprecate: (id: string, note?: string) => filePost<PublishedFile>(id, 'deprecate', note ? { note } : {}),
  restore: (id: string) => filePost<PublishedFile>(id, 'restore'),
  /** A reason is required; revoking is final for everyone but a holder of the override code. */
  revoke: (id: string, reason: string) => filePost<PublishedFile>(id, 'revoke', { reason }),
  bulkRegister: (items: PublishedFileInput[]) => apiClient.post<BulkRegisterResult>(`${files}bulk-register/`, { items }),
};

export const storageRootsApi = resourceApi<StorageRoot, StorageRootInput>('publishing-roots', `${V1}/storage-roots/`);
export const publishDestinationsApi = resourceApi<PublishDestination, PublishDestinationInput>('publishing-destinations', `${V1}/destinations/`);
