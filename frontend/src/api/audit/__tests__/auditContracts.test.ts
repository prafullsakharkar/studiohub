import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { ApiRequestLog, BackgroundJob, ChangeLog, ErrorLog } from '../audit';

/**
 * The hand-written audit row types must list EXACTLY the fields the real backend returned
 * (docs/sync/samples/audit/_audit_flow.json): `Record<keyof T, true>` fails to compile when the type has a
 * field the capture lacks or the capture has a field the type lacks.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('audit/_audit_flow.json');
const firstRow = (key: string): Record<string, unknown> => flow[key].body.results[0];

const CHANGE_LOG: Record<keyof ChangeLog, true> = { after_values: true, before_values: true, change_type: true, changed_fields: true, created_at: true, description: true, id: true, target_id: true, target_name: true, target_type: true, updated_at: true, user: true, user_email: true, user_name: true, uuid: true };
const API_REQUEST: Record<keyof ApiRequestLog, true> = { api_version: true, created_at: true, error_message: true, full_path: true, id: true, ip_address: true, method: true, path: true, request_body: true, request_headers: true, request_size_bytes: true, response_body: true, response_headers: true, response_size_bytes: true, response_time_ms: true, status_category: true, status_code: true, updated_at: true, user: true, user_agent: true, user_email: true, user_name: true, uuid: true };
const BACKGROUND_JOB: Record<keyof BackgroundJob, true> = { completed_at: true, created_at: true, description: true, error_message: true, id: true, job_id: true, job_type: true, progress: true, queue_name: true, result_data: true, started_at: true, status: true, updated_at: true, uuid: true, worker_id: true };
const ERROR_LOG: Record<keyof ErrorLog, true> = { context_data: true, created_at: true, error_code: true, error_type: true, id: true, ip_address: true, message: true, request_method: true, request_path: true, resolved: true, resolved_at: true, resolved_by: true, severity: true, stack_trace: true, updated_at: true, user: true, user_agent: true, user_email: true, user_name: true, uuid: true };

describe('audit row types match the captured responses', () => {
  it.each([
    ['change log', 'changelogs_for_dept', CHANGE_LOG],
    ['api request', 'api_requests', API_REQUEST],
    ['background job', 'jobs_list', BACKGROUND_JOB],
    ['error log', 'errors_list', ERROR_LOG],
  ])('%s', (_label, sample, expected) => {
    expect(Object.keys(firstRow(sample)).sort()).toEqual(Object.keys(expected).sort());
  });

  it('a change log detail has the same fields as the list row', () => {
    expect(Object.keys(flow.changelog_detail.body).sort()).toEqual(Object.keys(CHANGE_LOG).sort());
  });

  it('history of one record: the API returns newest first, create has an empty before_values', () => {
    const rows = flow.changelogs_for_dept.body.results as ChangeLog[];
    expect(rows.map((r) => r.change_type)).toEqual(['update', 'update', 'create']);
    expect(rows.every((r) => r.target_type === 'Department' && r.target_id === rows[0].target_id)).toBe(true);
    expect(rows[2].before_values).toEqual({});
    expect(rows[0].changed_fields).toEqual(['color']);
  });

  it('audit/activity are reachable only with audit.view: a signed-in artist gets 403 on every read and action', () => {
    expect(flow.artist_changelogs.status).toBe(403);
    expect(flow.artist_audit.status).toBe(403);
    expect(flow.artist_job_cancel.status).toBe(403);
  });
});
