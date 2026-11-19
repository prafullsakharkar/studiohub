import { describe, expect, it } from 'vitest';
import { normalizeApiError } from '@/api/errors/normalizeApiError';
import { loadSample } from '@/test/samples';
import type { Version } from '../review';
import { VERSION_KEYS } from '../reviewRowKeys';
import type { Task } from '../work';
import { TASK_KEYS } from '../workRowKeys';

/**
 * Waiting for my review (RP-24, docs/review-pipeline/CONTRACTS.md C-RP-58), pinned to the capture:
 * docs/sync/samples/production/_review_queue_flow.json.
 */
type Captured<T> = { status: number; body: T };
type Page<T> = { count: number; results: T[] };
interface Flow {
  me_supervisor: Captured<{ id: string }>;
  to_review_supervisor: Captured<Page<Version>>;
  to_review_lead: Captured<Page<Version>>;
  to_review_supervisor_project: Captured<Page<Version>>;
  to_review_supervisor_search: Captured<Page<Version>>;
  to_review_client: Captured<Page<Version>>;
  to_review_bad_value_400: Captured<Record<string, unknown>>;
  tasks_reviewed_by_supervisor: Captured<Page<Task>>;
  tasks_reviewer_unknown: Captured<Page<Task>>;
  tasks_reviewer_malformed: Captured<Page<Task>>;
  versions_all_supervisor: Captured<Page<Version>>;
}
const flow = loadSample<Flow>('production/_review_queue_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const codes = (c: Captured<Page<{ code: string }>>) => c.body.results.map((r) => r.code).sort();

describe('C-RP-58: versions/?to_review=mine', () => {
  it('rows are ordinary versions: the same keys, no field added', () => {
    expect(keys(flow.to_review_supervisor.body.results[0])).toEqual(keys(VERSION_KEYS));
  });

  it('only Pending Review, each reviewer their own, across projects', () => {
    const queue = flow.to_review_supervisor.body.results;
    expect(queue.length).toBe(2);
    expect(queue.every((v) => v.status === 'Pending Review')).toBe(true);
    expect(new Set(queue.map((v) => v.project_id)).size).toBe(2);
    expect(codes(flow.to_review_lead)).toEqual(['RRQ_SH0010_ROTO_V001']);
    expect(codes(flow.to_review_lead).some((c) => codes(flow.to_review_supervisor).includes(c))).toBe(false);
  });

  it('versions waiting nowhere: other statuses, no reviewer, no task, an archived task', () => {
    const all = codes(flow.versions_all_supervisor);
    const waiting = [...codes(flow.to_review_supervisor), ...codes(flow.to_review_lead)];
    const nobodys = all.filter((c) => !waiting.includes(c));
    expect(nobodys).toEqual(expect.arrayContaining(['RRQ_SH0010_COMP_V001', 'RRQ_SH0010_COMP_V003', 'RRQ_SH0010_PAINT_V001', 'RRQ_SH0010_PLATE_V001']));
  });

  it('combines with the project filter and search', () => {
    expect(codes(flow.to_review_supervisor_project)).toEqual(['RRQ_SH0010_COMP_V002']);
    expect(codes(flow.to_review_supervisor_search)).toEqual(['RRQB_SH0010_COMP_V001']);
  });

  it('a client member reviews no task, so nothing waits for them', () => {
    expect(flow.to_review_client.body).toMatchObject({ count: 0, results: [] });
  });

  it('only "mine": another value is refused on the field', () => {
    expect(flow.to_review_bad_value_400.status).toBe(400);
    const error = normalizeApiError(400, flow.to_review_bad_value_400.body);
    expect(error.fieldErrors.to_review).toEqual([`Select a valid choice. ${flow.me_supervisor.body.id} is not one of the available choices.`]);
  });
});

describe('C-RP-58: tasks/?reviewer_id=', () => {
  it('the tasks the person reviews; an unknown or malformed id gives none', () => {
    const rows = flow.tasks_reviewed_by_supervisor.body.results;
    expect(keys(rows[0])).toEqual(keys(TASK_KEYS));
    expect(rows.map((t) => t.code).sort()).toEqual(['RRQB_SH0010_COMP', 'RRQ_SH0010_COMP']);
    expect(rows.every((t) => t.reviewer_id === flow.me_supervisor.body.id)).toBe(true);
    expect(flow.tasks_reviewer_unknown).toMatchObject({ status: 200, body: { count: 0, results: [] } });
    expect(flow.tasks_reviewer_malformed).toMatchObject({ status: 200, body: { count: 0, results: [] } });
  });
});
