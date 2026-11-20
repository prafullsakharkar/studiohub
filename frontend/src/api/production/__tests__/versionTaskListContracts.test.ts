import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import type { Version } from '../review';
import { VERSION_KEYS } from '../reviewRowKeys';

/**
 * The task on the Versions list (RP-26, docs/review-pipeline/CONTRACTS.md C-RP-61), pinned to the capture:
 * docs/sync/samples/production/_version_task_list_flow.json.
 */
type Captured<T> = { status: number; body: T };
type Page<T> = { count: number; results: T[] };
type Flow = Record<string, Captured<Page<Version>>> & {
  version_as_supervisor: Captured<Version>;
  version_on_archived_task: Captured<Version>;
  version_as_client: Captured<Version>;
  me_supervisor: Captured<User>;
  me_without_version_view: Captured<User>;
};
const flow = loadSample<Flow>('production/_version_task_list_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const tasks = (c: Captured<Page<Version>>) => Object.fromEntries(c.body.results.map((v) => [v.code, [v.task_code, v.task_title]]));
const codes = (c: Captured<Page<Version>>) => c.body.results.map((v) => v.code).sort();

describe('C-RP-61: the task on a version row', () => {
  it('rows and the detail carry task_code and task_title beside task_id, nothing else added', () => {
    expect(keys(flow.list_as_supervisor.body.results[0])).toEqual(keys(VERSION_KEYS));
    expect(keys(flow.version_as_supervisor.body)).toEqual(keys(VERSION_KEYS));
    expect(keys(flow.project_scoped_list.body.results[0])).toEqual(keys(VERSION_KEYS));
  });

  it('the studio sees each task; null without a task and for an archived task', () => {
    expect(tasks(flow.list_as_supervisor)).toEqual({
      RVL_SH0010_COMP_V001: ['RVL_SH0010_COMP', 'Comp'],
      RVL_SH0010_COMP_V002: ['RVL_SH0010_COMP', 'Comp'],
      RVL_SH0010_LIGHT_V001: ['RVL_SH0010_LIGHT', 'Lighting'],
      RVL_SH0010_PLATE_V001: [null, null],
      RVL_SH0010_ROTO_V001: [null, null],
    });
    expect(flow.version_on_archived_task.body.task_id).not.toBeNull();
  });

  it('a vendor member sees their vendor’s task', () => {
    expect(tasks(flow.list_as_vendor)).toEqual({ RVL_SH0010_COMP_V001: ['RVL_SH0010_COMP', 'Comp'], RVL_SH0010_COMP_V002: ['RVL_SH0010_COMP', 'Comp'] });
  });

  it('a client member and a role without task.view get the rows without their tasks; task_id is still given', () => {
    expect(tasks(flow.list_as_client)).toEqual({ RVL_SH0010_COMP_V001: [null, null] });
    expect(flow.version_as_client.body.task_code).toBeNull();
    expect(flow.version_as_client.body.task_id).toBe(flow.version_as_supervisor.body.task_id);
    const without = flow.list_without_task_view.body.results;
    expect(without.length).toBe(5);
    expect(without.every((v) => v.task_code === null && v.task_title === null)).toBe(true);
  });
});

describe('C-RP-61: versions/?task_id=', () => {
  it('one task’s versions', () => {
    expect(codes(flow.task_filter)).toEqual(['RVL_SH0010_COMP_V001', 'RVL_SH0010_COMP_V002']);
    expect(flow.task_filter.body.results.every((v) => v.task_id === flow.version_as_supervisor.body.task_id)).toBe(true);
  });

  it('an unknown or a malformed id is no rows, never a 400', () => {
    for (const c of [flow.task_filter_unknown, flow.task_filter_malformed]) {
      expect(c.status).toBe(200);
      expect(c.body).toMatchObject({ count: 0, results: [] });
    }
  });

  it('combines with the queue and the project; never more than the caller reads', () => {
    expect(codes(flow.task_filter_with_queue)).toEqual(['RVL_SH0010_LIGHT_V001']);
    expect(flow.task_filter_other_project.body.count).toBe(0);
    expect(flow.task_filter_as_client.body.count).toBe(0);
  });

  it('the queue rows now say which task waits', () => {
    expect(tasks(flow.queue_as_supervisor)).toEqual({ RVL_SH0010_COMP_V001: ['RVL_SH0010_COMP', 'Comp'], RVL_SH0010_LIGHT_V001: ['RVL_SH0010_LIGHT', 'Lighting'] });
  });

  it('the task page’s readers: the supervisor holds version.view, the tasks-only role does not', () => {
    expect(flow.me_supervisor.body.permissions).toContain('version.view');
    expect(flow.me_without_version_view.body.permissions).toContain('task.view');
    expect(flow.me_without_version_view.body.permissions).not.toContain('version.view');
  });
});
