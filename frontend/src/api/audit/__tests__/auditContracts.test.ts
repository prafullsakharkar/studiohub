import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { CHANGE_LOG, API_REQUEST, BACKGROUND_JOB, ERROR_LOG } from '../auditRowKeys';
import type { ChangeLog } from '../audit';

/**
 * The hand-written audit row types must list EXACTLY the fields the real backend returned
 * (docs/sync/samples/audit/_audit_flow.json): `Record<keyof T, true>` fails to compile when the type has a
 * field the capture lacks or the capture has a field the type lacks.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('audit/_audit_flow.json');
const firstRow = (key: string): Record<string, unknown> => flow[key].body.results[0];


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
