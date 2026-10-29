import { apiClient } from '@/api/client/ApiClient';
import { listFetcher } from '@/shared/data/listing';
import { createQueryKeys } from '@/shared/data/queryKeys';

/**
 * The audit routes (`/api/v1/audit/*`), all read-only and gated by `audit.view`; the two actions
 * (cancel/retry a background job, resolve an error) need `audit.update`. Rows below are typed from the
 * captures in docs/sync/samples/audit (the generated OpenAPI types omit several response fields).
 *
 * Filters, from the viewsets' filtersets: `created_at__gte|lte|exact` on every log, plus
 * change-logs `change_type`, `target_type`, `target_id`, `user`; api-requests `method`, `status_code`,
 * `user`; background-jobs `job_type`, `status`; error-logs `severity`, `error_type`, `user`;
 * tracks `event_type`, `user`. An unknown `ordering` is ignored (200), not rejected.
 */
export const auditKeys = createQueryKeys('audit');

/** `target_type` is the model class name ("Department", "Team", "Person", …), not a route name. */
export interface ChangeLog {
  id: string;
  uuid: string;
  change_type: 'create' | 'update' | 'delete' | string;
  target_type: string;
  target_id: string;
  target_name: string;
  description: string;
  /** Names of the fields that differ. */
  changed_fields: string[];
  /** Field -> value as strings; empty for a create's `before_values`. */
  before_values: Record<string, string>;
  after_values: Record<string, string>;
  user: string | null;
  user_email: string;
  user_name: string;
  created_at: string;
  updated_at: string;
}

/** `/audit/` (frontend-compat shape of AuditLog); search also matches `target_id` (the workaround for CR-03). */
export interface AuditLogEntry {
  id: string;
  uuid: string;
  user_id: string | null;
  user_name: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  description: string;
  ip_address: string | null;
  [field: string]: unknown;
}

/** `/audit/activity/` (frontend-compat feed). */
export interface ActivityEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_email: string;
  action: string;
  description: string;
  metadata?: unknown;
  [field: string]: unknown;
}

export interface ApiRequestLog {
  id: string;
  uuid: string;
  updated_at: string;
  method: string;
  path: string;
  full_path: string;
  status_code: number;
  status_category: string;
  response_time_ms: number;
  request_size_bytes: number;
  response_size_bytes: number;
  user: string | null;
  user_email: string;
  user_name: string;
  ip_address: string | null;
  user_agent: string;
  api_version: string;
  error_message: string;
  request_headers: Record<string, unknown>;
  request_body: unknown;
  response_headers: Record<string, unknown>;
  response_body: unknown;
  created_at: string;
}

export interface BackgroundJob {
  id: string;
  uuid: string;
  updated_at: string;
  job_id: string;
  job_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  progress: number;
  description: string;
  queue_name: string;
  worker_id: string;
  error_message: string;
  result_data: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ErrorLog {
  id: string;
  uuid: string;
  updated_at: string;
  user_agent: string;
  severity: string;
  error_type: string;
  error_code: string;
  message: string;
  stack_trace: string;
  request_method: string;
  request_path: string;
  context_data: unknown;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  user: string | null;
  user_email: string;
  user_name: string;
  ip_address: string | null;
  created_at: string;
}

export interface TrackEvent {
  id: string;
  event_type: string;
  event_name: string;
  user: string | null;
  user_email: string;
  user_name: string;
  session_id: string;
  page_url: string;
  page_title: string;
  element_id: string;
  element_text: string;
  metadata: unknown;
  created_at: string;
}

const root = '/api/v1/audit';
const detail = <T>(base: string) => (id: string, signal?: AbortSignal) => apiClient.get<T>(`${base}${id}/`, { signal });

export const auditApi = {
  changeLogs: { list: listFetcher<ChangeLog>(`${root}/change-logs/`), get: detail<ChangeLog>(`${root}/change-logs/`) },
  auditLogs: { list: listFetcher<AuditLogEntry>(`${root}/`), get: detail<AuditLogEntry>(`${root}/`) },
  activity: { list: listFetcher<ActivityEntry>(`${root}/activity/`) },
  apiRequests: { list: listFetcher<ApiRequestLog>(`${root}/api-requests/`), get: detail<ApiRequestLog>(`${root}/api-requests/`) },
  tracks: { list: listFetcher<TrackEvent>(`${root}/tracks/`) },
  backgroundJobs: {
    list: listFetcher<BackgroundJob>(`${root}/background-jobs/`),
    cancel: (id: string) => apiClient.post<BackgroundJob>(`${root}/background-jobs/${id}/cancel/`, {}),
    retry: (id: string) => apiClient.post<BackgroundJob>(`${root}/background-jobs/${id}/retry/`, {}),
  },
  errorLogs: {
    list: listFetcher<ErrorLog>(`${root}/error-logs/`),
    get: detail<ErrorLog>(`${root}/error-logs/`),
    resolve: (id: string) => apiClient.post<{ status: 'resolved' }>(`${root}/error-logs/${id}/resolve/`, {}),
  },
};

/** The history of one record: its ChangeLog rows, newest first (the API's default order). */
export const changeLogsFor = (targetType: string, targetId: string, params: { page?: number; page_size?: number } = {}) =>
  auditApi.changeLogs.list({ target_type: targetType, target_id: targetId, ...params });
