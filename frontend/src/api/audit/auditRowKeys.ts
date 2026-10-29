/**
 * Exhaustive field lists for the hand-written row types in `audit.ts`. They live here, outside `__tests__`,
 * because tsconfig excludes tests from `tsc`: `Record<keyof T, true>` only fails to compile when this file is
 * compiled. The tests then compare these lists with the captured responses, so the type, this list and the
 * real backend must all agree.
 */
import type { ApiRequestLog, BackgroundJob, ChangeLog, ErrorLog } from './audit';

export const CHANGE_LOG: Record<keyof ChangeLog, true> = { after_values: true, before_values: true, change_type: true, changed_fields: true, created_at: true, description: true, id: true, target_id: true, target_name: true, target_type: true, updated_at: true, user: true, user_email: true, user_name: true, uuid: true };
export const API_REQUEST: Record<keyof ApiRequestLog, true> = { api_version: true, created_at: true, error_message: true, full_path: true, id: true, ip_address: true, method: true, path: true, request_body: true, request_headers: true, request_size_bytes: true, response_body: true, response_headers: true, response_size_bytes: true, response_time_ms: true, status_category: true, status_code: true, updated_at: true, user: true, user_agent: true, user_email: true, user_name: true, uuid: true };
export const BACKGROUND_JOB: Record<keyof BackgroundJob, true> = { completed_at: true, created_at: true, description: true, error_message: true, id: true, job_id: true, job_type: true, progress: true, queue_name: true, result_data: true, started_at: true, status: true, updated_at: true, uuid: true, worker_id: true };
export const ERROR_LOG: Record<keyof ErrorLog, true> = { context_data: true, created_at: true, error_code: true, error_type: true, id: true, ip_address: true, message: true, request_method: true, request_path: true, resolved: true, resolved_at: true, resolved_by: true, severity: true, stack_trace: true, updated_at: true, user: true, user_agent: true, user_email: true, user_name: true, uuid: true };
