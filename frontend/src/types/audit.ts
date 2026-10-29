import { BaseEntity } from './common';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical' | 'info' | 'warning' | 'error' | string;

export interface AuditLog extends Partial<BaseEntity> {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  description?: string;
  ip_address?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface FieldDiff {
  field: string;
  label?: string;
  before: any;
  after: any;
}

export interface ChangeLog extends Partial<BaseEntity> {
  id: string;
  uuid?: string;
  change_type: 'create' | 'update' | 'delete' | 'archive' | 'restore' | string;
  target_type: string;
  target_id: string;
  target_name?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  project_id?: string;
  project_name?: string;
  changed_fields?: string[];
  before_values?: Record<string, any>;
  after_values?: Record<string, any>;
  diffs?: FieldDiff[];
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ErrorLog extends Partial<BaseEntity> {
  id: string;
  uuid?: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'error' | 'warning' | string;
  error_type: string;
  error_code?: string;
  message: string;
  stack_trace?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  project_id?: string;
  project_name?: string;
  ip_address?: string;
  user_agent?: string;
  request_path?: string;
  request_method?: string;
  context_data?: Record<string, any>;
  resolved?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface BackgroundJob extends Partial<BaseEntity> {
  id: string;
  uuid?: string;
  job_id: string;
  job_type: string;
  status: 'pending' | 'queued' | 'progress' | 'completed' | 'failed' | 'cancelled' | string;
  progress: number;
  description?: string;
  project_id?: string;
  project_name?: string;
  queue_name?: string;
  worker_id?: string;
  started_at?: string;
  duration_seconds?: number;
  triggered_by?: string;
  retry_count?: number;
  max_retries?: number;
  result_data?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface APIRequest extends Partial<BaseEntity> {
  id: string;
  uuid?: string;
  method: string;
  path: string;
  full_path?: string;
  status_code: number;
  status_category?: '2xx' | '3xx' | '4xx' | '5xx' | string;
  response_time_ms: number;
  request_size_bytes?: number;
  response_size_bytes?: number;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
  api_version?: string;
  request_headers?: Record<string, string>;
  request_body?: any;
  response_headers?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface AuditTrack extends Partial<BaseEntity> {
  id: string;
  uuid?: string;
  event_type: string;
  event_name: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  session_id?: string;
  page_url?: string;
  page_title?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface LoginHistoryItem extends Partial<BaseEntity> {
  id: string;
  uuid?: string;
  login_type: 'login' | 'logout' | 'token_refresh' | 'failed_attempt' | string;
  login_method: string;
  status: 'success' | 'failed' | 'blocked' | string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
  location?: string;
  mfa_enabled?: boolean;
  mfa_type?: string;
  session_id?: string;
  device_name?: string;
  device_type?: string;
  browser?: string;
  browser_version?: string;
  operating_system?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from organization.ts (relocated activity types, org-free)
// ---------------------------------------------------------------------------

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'status_change'
  | 'assign'
  | 'unassign'
  | 'publish'
  | 'approve'
  | 'reject'
  | 'comment'
  | string;
export interface ActivityDiff {
  field: string;
  before?: any;
  after?: any;
  [key: string]: any;
}
export interface ActivityFilterOptions {
  entityType?: string;
  entityId?: string;
  projectId?: string;
  actionType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  [key: string]: any;
}
export interface ActivityLogItem {
  id: string;
  timestamp: string;
  action: ActivityActionType | string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  entity_code?: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  project_id?: string;
  project_name?: string;
  details?: string;
  diff?: ActivityDiff[];
  changes?: Record<string, { before: any; after: any }>;
  ip_address?: string;
  actor?: {
    id: string;
    name: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
    [key: string]: any;
  };
  entity?: {
    type?: string;
    id?: string;
    name?: string;
    [key: string]: any;
  };
  actionLabel?: string;
  description?: string;
  [key: string]: any;
}
