import { apiClient } from '@/api/client/ApiClient';
import { resourceApi } from '@/api/masterdata/resource';
import { listFetcher } from '@/shared/data/listing';

/**
 * Deliveries and delivery destinations. Row types are pinned to docs/sync/samples/deliveries/_flow.json
 * (see backend-change-requests.md, "Phase 8 notes"; the backend's own contracts are docs/deliveries/CONTRACTS.md).
 *
 * Rules the capture established:
 *  - a delivery moves only through its actions (`status` is read-only); the reads say "Ready" for the backend's
 *    Prepared and "Completed" for Complete, the history rows say Prepared and Complete;
 *  - the list filters by `status` (the read words or the stored ones), `client_status`, `delivery_method`, `client`,
 *    `project` and `destination` (also as `*_id`), and searches name, code and client; a project's deliveries come
 *    from `/api/organizations/projects/{id}/deliveries/`, which takes the same filters (CR-17, applied);
 *  - the person who prepared a delivery cannot sign it off (403 `separation_of_duties`);
 *  - the passcode is never in a response: `has_passcode`, and `GET passcode/` for holders of `delivery.view_secret`;
 *  - only a Draft or a Cancelled delivery can be deleted (409 `delivery_not_editable` otherwise, CR-18, applied);
 *  - people are named beside their ids (`actor_name`, `checked_by_name`, `signed_off_by_name`, CR-21, applied).
 */
const V1 = '/api/v1';
const base = `${V1}/deliveries/`;

/** Status words as the reads show them. */
export const DELIVERY_STATUSES = ['Draft', 'Validating', 'Ready', 'Signed Off', 'Submitted', 'Approved', 'Rejected', 'Completed', 'Cancelled'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const DELIVERY_METHODS = ['Aspera', 'S3', 'FTP', 'Web Download'] as const;
/** The seven destination types; anything else is a 400 (CR-19, applied). */
export const DESTINATION_TYPES = ['Aspera Connect', 'Signiant Media Shuttle', 'AWS S3 Bucket', 'Frame.io Enterprise', 'LTO Tape Archive', 'Client SFTP', 'Hard Drive Ingest'] as const;

/** The history rows use the backend's words for two statuses. */
const HISTORY_WORDS: Record<string, string> = { Prepared: 'Ready', Complete: 'Completed' };
export const deliveryStatusLabel = (status: string) => HISTORY_WORDS[status] ?? status;

// ------------------------------------------------------------------------------------------------ rows

export interface DeliveryRow {
  id: string;
  code: string;
  name: string;
  status: string;
  client_status: string;
  /** Absent (not empty) when the delivery has no client. */
  client_name?: string;
  project_name: string;
  delivery_method: string;
  expires_at: string | null;
  is_expired: boolean;
  is_archived: boolean;
  total_frames: number;
  total_size_bytes: number;
  version_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryItemFile {
  storage_root_code: string;
  relative_path: string;
  role: string;
  file_type_code: string;
  size_bytes: number;
  sha256: string;
  frame_start: number | null;
  frame_end: number | null;
  /** Set when the delivery was sent: from then on the item is a frozen record. */
  frozen_at: string | null;
}

export interface DeliveryItem {
  /** The old integer id; `uid` is the one to send. */
  id: number;
  uid: string;
  version_id: string;
  version_number: string;
  entity_type: string;
  entity_code: string;
  entity_name: string;
  file_path: string;
  file_size_bytes: number;
  frame_count: number;
  checksum_md5: string;
  checksum_sha256: string;
  is_validated: boolean;
  validation_notes: string;
  files: DeliveryItemFile[];
  created_at: string;
}

export interface Delivery {
  id: string;
  code: string;
  name: string;
  status: string;
  client_status: string;
  project: string | null;
  project_name: string;
  client: string | null;
  /** Absent (not empty) when the delivery has no client. */
  client_name?: string;
  destination: string | null;
  destination_name: string;
  /** Deprecated free text; the destination's address when one is chosen. */
  delivery_destination: string;
  delivery_method: string;
  has_passcode: boolean;
  expires_at: string | null;
  notes: string;
  /** The client's feedback only. */
  client_notes: string;
  cancellation_reason: string;
  rejection_reason: string;
  signed_off_by: string | null;
  /** The person's name, else their email; empty for nobody. */
  signed_off_by_name: string;
  signed_off_at: string | null;
  sent_at: string | null;
  transfer_reference: string;
  client_answered_by: string | null;
  client_answered_by_name: string;
  client_answered_at: string | null;
  revision_of: string | null;
  has_revoked_content: boolean;
  total_frames: number;
  total_size_bytes: number;
  checksums: { manifest_sha256?: string; total_size_bytes?: number; version_count?: number };
  manifest_data: Record<string, unknown>;
  is_archived: boolean;
  versions: DeliveryItem[];
  created_at: string;
  updated_at: string;
}

export interface DeliveryInput {
  name: string;
  /** Required on create (an id or a code); a delivery never changes project. */
  project_id?: string;
  client_id?: string | null;
  destination_id?: string | null;
  delivery_method?: string;
  /** Write-only; only a holder of `delivery.view_secret` can read it back. */
  passcode?: string;
  expires_at?: string | null;
  notes?: string;
  client_notes?: string;
  code?: string;
}

export interface DeliveryStatusChange {
  id: string;
  from_status: string;
  to_status: string;
  /** User id; null for a system move (a revoked file reopened the sign-off). */
  actor: string | null;
  /** Empty for a system move. */
  actor_name: string;
  reason: string;
  override_kind: string;
  at: string;
}

export interface DeliveryQCCheck {
  run_id: string;
  check_name: string;
  outcome: string;
  detail: string;
  /** The item's uid; null for a check of the whole package. */
  item: string | null;
  checked_by: string | null;
  checked_by_name: string;
  checked_at: string;
}

export interface DeliveryDestination {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  port: number | null;
  target_directory: string;
  storage_region: string;
  transfer_rate_mbps: number | null;
  credentials_configured: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DestinationInput {
  name: string;
  type: string;
  endpoint: string;
  port?: number | null;
  target_directory?: string;
  /** Write aliases of `storage_region` and `transfer_rate_mbps`. */
  region?: string;
  rate?: number | null;
  is_default?: boolean;
  is_active?: boolean;
}

// ------------------------------------------------------------------------------------- action answers

export interface QCCheckResult {
  check: string;
  outcome: string;
  detail: string;
}
export interface ValidateResult {
  success: boolean;
  all_valid: boolean;
  delivery_id: string;
  run_id: string;
  status: string;
  package_checks: QCCheckResult[];
  validation_results: Array<{ version_id: string; version_number: string; status: string; checks: QCCheckResult[]; checksums: { md5: string; sha256: string } }>;
}
export interface PrepareResult {
  success: boolean;
  delivery_id: string;
  status: string;
  checksums: Delivery['checksums'];
  manifest_data: Record<string, unknown>;
}
export interface SubmitResult {
  success: boolean;
  delivery_id: string;
  status: string;
  submission_result: { success: boolean; submitted_at: string; delivery_method: string; destination: string; transfer_reference: string };
}
export interface ReviseResult extends Delivery {
  /** Versions of the rejected delivery that could not be carried over, with why. */
  skipped_versions: Array<{ version_id: string; reason: string }>;
}
export interface BulkCancelResult {
  success: boolean;
  succeeded_count: number;
  failed_count: number;
  /** `error`: null, `not_found` (unknown, not yours, or not yours to cancel) or `invalid_transition`. */
  results: Array<{ id: string; ok: boolean; error: string | null }>;
}

// -------------------------------------------------------------------------------------------- the API

const post = <T>(id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<T>(`${base}${id}/${action}/`, body);

export const deliveriesApi = {
  ...resourceApi<DeliveryRow, DeliveryInput>('deliveries', base),
  /** The detail shape; `create`/`update` answer it too. */
  get: (id: string, signal?: AbortSignal) => apiClient.get<Delivery>(`${base}${id}/`, { signal }),
  create: (input: DeliveryInput) => apiClient.post<Delivery>(base, input),
  update: (id: string, patch: Partial<Omit<DeliveryInput, 'project_id' | 'client_id' | 'code'>>) => apiClient.patch<Delivery>(`${base}${id}/`, patch),
  /** Deliveries of one project, for the project tab (the list route ignores a project filter, CR-17). */
  ofProject: (projectId: string) => listFetcher<DeliveryRow>(`/api/organizations/projects/${projectId}/deliveries/`),

  // items: `version_id` of a published version of the delivery's project; the snapshot comes from the registry
  addVersion: (id: string, versionId: string) => post<Delivery>(id, 'add-version', { version_id: versionId }),
  removeVersion: (id: string, itemUid: string) => post<Delivery>(id, 'remove-version', { item_id: itemUid }),

  // working states (`delivery.update`)
  validate: (id: string) => post<ValidateResult>(id, 'validate'),
  retry: (id: string) => post<Delivery>(id, 'retry'),
  prepare: (id: string) => post<PrepareResult>(id, 'prepare'),
  complete: (id: string) => post<Delivery>(id, 'complete'),
  cancel: (id: string, reason?: string) => post<Delivery>(id, 'cancel', reason ? { reason } : {}),
  bulkCancel: (ids: string[], reason?: string) => apiClient.post<BulkCancelResult>(`${base}bulk-cancel/`, { ids, ...(reason ? { reason } : {}) }),

  // internal sign-off (`delivery.approve`) and sending / the client's answer (`delivery.send`)
  signOff: (id: string, notes?: string) => post<Delivery>(id, 'sign-off', notes ? { notes } : {}),
  reopen: (id: string) => post<Delivery>(id, 'reopen'),
  submit: (id: string, transferReference?: string) => post<SubmitResult>(id, 'submit', transferReference ? { transfer_reference: transferReference } : {}),
  approve: (id: string, notes?: string) => post<Delivery>(id, 'approve', notes ? { notes } : {}),
  reject: (id: string, reason: string) => post<Delivery>(id, 'reject', { reason }),
  revise: (id: string) => post<ReviseResult>(id, 'revise'),

  history: (id: string, signal?: AbortSignal) => apiClient.get<DeliveryStatusChange[]>(`${base}${id}/history/`, { signal }),
  qc: (id: string, signal?: AbortSignal) => apiClient.get<DeliveryQCCheck[]>(`${base}${id}/qc/`, { signal }),
  /** `delivery.view_secret`; every read is audited. */
  passcode: (id: string) => apiClient.get<{ passcode: string }>(`${base}${id}/passcode/`),
};

export const destinationsApi = resourceApi<DeliveryDestination, DestinationInput>('delivery-destinations', `${base}destinations/`);
