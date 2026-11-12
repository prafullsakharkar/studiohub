import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { Project } from '../structure';
import { PROJECT_KEYS } from '../structureRowKeys';

/**
 * Review pipeline RP-3 (docs/review-pipeline/CONTRACTS.md C-RP-14, C-RP-15), pinned to the responses captured in
 * docs/sync/samples/production/_rollup_flow.json (docs/sync/tools/test_capture_production_rollup.py). The project
 * shape moved here from `_structure_flow.json`, whose capture predates RP-3.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_rollup_flow.json');
const ids = flow.ids as unknown as Record<string, string>;
const rows = (key: string): Project[] => flow[key].body.results;

describe('C-RP-14: the switch on the project', () => {
  it('a listed project has exactly the pinned keys', () => {
    for (const row of rows('projects_list')) expect(Object.keys(row).sort()).toEqual(Object.keys(PROJECT_KEYS).sort());
    expect(Object.keys(flow.project_detail.body).sort()).toEqual(Object.keys(PROJECT_KEYS).sort());
  });

  it('is off unless asked for, and written by whoever may edit the project', () => {
    expect([flow.create_project_on.body.approve_task_on_version_approval, flow.create_project_default.body.approve_task_on_version_approval]).toEqual([true, false]);
    expect(flow.patch_switch_off.body.approve_task_on_version_approval).toBe(false);
    expect(flow.patch_switch_by_artist_403.status).toBe(403);
    expect(flow.patch_switch_bad_400.status).toBe(400);
    expect(flow.patch_switch_bad_400.body.approve_task_on_version_approval).toEqual(['Must be a valid boolean.']);
  });
});

describe('C-RP-15: approving a version approves its task when the switch is on', () => {
  it('the approval answers as before', () => {
    for (const key of ['approve_version_on', 'approve_version_off']) expect([flow[key].status, flow[key].body.status]).toEqual([200, 'Approved']);
  });

  it('switch on: the task is Approved, and its history names the version', () => {
    expect([flow.task_on_after.body.id, flow.task_on_after.body.status]).toEqual([ids.task_on, 'Approved']);
    const [row] = flow.task_on_status_history.body;
    expect([row.from_status, row.to_status, row.reason]).toEqual(['In Progress', 'Approved', `Version ${flow.approve_version_on.body.code} approved`]);
    expect(flow.task_on_status_history.body).toHaveLength(1);
  });

  it('switch off: the task is left alone', () => {
    expect(flow.task_off_after.body.status).toBe('In Progress');
    expect(flow.task_off_status_history.body).toEqual([]);
  });
});
