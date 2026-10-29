import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { SHOT_KEYS, ASSET_KEYS, TASK_KEYS, TIMELOG_KEYS, TASKTEMPLATE_KEYS, SHOTASSETLINK_KEYS, ASSETSHOTLINK_KEYS, STATUSHISTORYROW_KEYS, TEMPLATEITEM_KEYS } from '../workRowKeys';
import { isAllowedMove, nextStatuses } from '../statusFlow';
import type { Asset, AssetShotLink, Shot, ShotAssetLink, StatusHistoryRow, Task, TaskTemplate, TemplateItem, Timelog } from '../work';

/**
 * The hand-written work row types list EXACTLY the fields the real backend returned
 * (docs/sync/samples/production/_work_flow.json): `Record<keyof T, true>` stops compiling when the type and the
 * capture disagree in either direction. The behaviour tests pin the rules the screens rely on.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_work_flow.json');
const firstRow = (key: string): Record<string, unknown> => {
  const body = flow[key].body;
  return body.results?.[0] ?? body.items?.[0] ?? body;
};
const count = (key: string): number => flow[key].body.count;


describe('work row types match the captured responses', () => {
  it.each([
    ['Shot', 'shots_list', SHOT_KEYS],
    ['Asset', 'assets_list', ASSET_KEYS],
    ['Task', 'tasks_list', TASK_KEYS],
    ['Timelog', 'timelogs_list_own', TIMELOG_KEYS],
    ['TaskTemplate', 'templates_list', TASKTEMPLATE_KEYS],
    ['ShotAssetLink', 'shots_assets', SHOTASSETLINK_KEYS],
    ['AssetShotLink', 'assets_shots', ASSETSHOTLINK_KEYS],
    ['StatusHistoryRow', 'shots_status_history', STATUSHISTORYROW_KEYS],
  ])('%s', (_label, sample, expected) => {
    expect(Object.keys(firstRow(sample)).sort()).toEqual(Object.keys(expected).sort());
  });

  it('TemplateItem', () => {
    expect(Object.keys(firstRow('templates_list').items[0]).sort()).toEqual(Object.keys(TEMPLATEITEM_KEYS).sort());
  });

  it('list and detail rows have the same shape for every resource', () => {
    for (const [list, detail] of [['shots_list', 'shots_detail'], ['assets_list', 'assets_detail'], ['tasks_list', 'tasks_detail'], ['timelogs_list_own', 'timelogs_detail']]) {
      expect(Object.keys(firstRow(list)).sort()).toEqual(Object.keys(flow[detail].body).sort());
    }
  });
});

describe('the rules the screens rely on', () => {
  it('a task is linked with entity_type + entity_id: a shot_id key on a write is silently dropped (General task)', () => {
    expect(flow.tasks_create.body).toMatchObject({ entity_type: 'Shot', entity_code: 'SH0015' });
    expect(flow.tasks_create_shot_id_ignored.status).toBe(201);
    expect(flow.tasks_create_shot_id_ignored.body).toMatchObject({ entity_type: 'General', entity_id: '' });
    expect(flow.tasks_detail.body.shot_id).toBe(flow.tasks_create.body.entity_id); // reads expose the link
    expect(flow.tasks_create_mismatched_link.body.entity_id).toEqual(['Unknown asset.']);
  });

  it('write responses are not read-shaped: re-read after saving', () => {
    expect(flow.tasks_create.body).not.toHaveProperty('task_type_id'); // a saved task_type_id is not echoed...
    expect(flow.tasks_detail.body.task_type_code).toBe('comp'); // ...but the detail has it
    expect(flow.tasks_create.body).toHaveProperty('assignee');
    expect(flow.tasks_detail.body).not.toHaveProperty('assignee');
  });

  it('timelog hours are numbers on reads and strings on writes; task hours are strings', () => {
    expect(typeof flow.timelogs_detail.body.duration_hours).toBe('number');
    expect(typeof flow.timelogs_create.body.duration_hours).toBe('string');
    expect(typeof flow.tasks_detail.body.logged_hours).toBe('string');
  });

  it('CR-14: an ordinary timelog accepts negative hours (the form must not send them)', () => {
    expect(flow.timelogs_create_future_or_bad.status).toBe(201);
    expect(flow.timelogs_create_future_or_bad.body.duration_hours).toBe('-1.00');
    expect(flow.timelogs_adjustment.body.adjustment_of).toBeTruthy();
  });

  it('time flows artist → lead: nobody approves their own, an approved log is final, a rejected one is resubmitted', () => {
    expect(flow.timelogs_create.body.status).toBe('Submitted');
    expect(flow.timelogs_artist_self_approve.status).toBe(403);
    expect(flow.timelogs_reject_empty.body.rejection_reason).toEqual(['This field is required.']);
    expect(flow.timelogs_reject.body).toMatchObject({ status: 'Rejected', rejection_reason: 'Wrong task' });
    expect(flow.timelogs_patch_rejected.status).toBe(200);
    expect(flow.timelogs_approve.body.status).toBe('Approved');
    expect(flow.timelogs_patch_approved.status).toBe(409);
    expect(flow.timelogs_create_for_other_denied.body.detail).toBe('Logging time for someone else requires timelog.manage.');
  });

  it('visibility: an artist sees only their own timelogs, a lead sees all, a stranger sees nothing', () => {
    expect(count('timelogs_other_artist_list')).toBe(0);
    expect(flow.timelogs_other_artist_detail.status).toBe(404);
    expect(count('timelogs_lead_list_all')).toBeGreaterThan(count('timelogs_other_artist_list'));
    expect(count('stranger_shots')).toBe(0);
    expect(flow.stranger_shot_detail.status).toBe(404);
  });

  it('the seeded roles: artists cannot create shots/assets/tasks, leads approve shots but cannot create them', () => {
    for (const key of ['artist_shot_create', 'artist_shot_patch', 'artist_shot_approve', 'artist_asset_create', 'artist_task_create', 'artist_task_delete', 'artist_rename_code', 'lead_shot_create', 'templates_lead_create']) {
      expect(flow[key].status, key).toBe(403);
    }
    expect(flow.artist_task_update.status).toBe(200); // task.update covers every task of the project
    expect(flow.lead_shot_approve.body.status).toBe('Approved');
    expect(flow.lead_task_create.status).toBe(201);
  });

  it('DELETE soft-archives shots, assets and tasks; an asset still linked to a shot refuses', () => {
    expect(flow.del_task_single.status).toBe(204);
    expect(flow.del_task_single_detail_after.status).toBe(404);
    expect(count('del_task_archived_after')).toBeGreaterThan(0);
    expect(flow.del_shot.status).toBe(204);
    expect(flow.del_asset.status).toBe(204);
    expect(flow.del_asset_in_use.status).toBe(400);
    expect(flow.del_asset_in_use.body.detail[0]).toMatch(/still used by 1 shot/);
  });

  it('bulk-delete takes task_ids (ids is an unknown field)', () => {
    expect(flow.del_task_bulk.body.ids).toEqual(['Unknown field.']);
    expect(flow.del_task_bulk_task_ids.body).toMatchObject({ success: true, deleted_count: 2 });
  });

  it('bulk shapes: mixin routes report processed/failed, bulk-status reports per-item ok/error with 207 on a partial failure', () => {
    expect(flow.shots_bulk_create.body).toMatchObject({ processed: 2, failed: 1, partial_success: true });
    expect(flow.tasks_bulk_status.status).toBe(200);
    expect(flow.tasks_bulk_status_forbidden_move.status).toBe(207);
    expect(flow.tasks_bulk_status_forbidden_move.body.results[0]).toMatchObject({ ok: false, error: 'invalid_transition' });
    expect(flow.tasks_bulk_assign_outsider.status).toBe(400);
  });

  it('templates: apply creates once, then reports the same tasks as existing; project copies are project-scoped', () => {
    expect(flow.templates_apply.status).toBe(201);
    expect(flow.templates_apply.body.created.map((t: { code: string }) => t.code)).toEqual(['SH0020_COMP', 'SH0020_ROTO']);
    expect(flow.templates_apply_again.status).toBe(200);
    expect(flow.templates_apply_again.body.created).toEqual([]);
    expect(flow.templates_apply_again.body.existing).toHaveLength(2);
    expect(flow.templates_copy_to_project.body.scope).toBe('project');
    expect(flow.templates_detail.body.scope).toBe('studio');
  });
});

describe('filters: each one was probed alone, an unknown one is ignored without an error', () => {
  const same = (probe: string, baseline: string) => expect(count(probe), probe).toBe(count(baseline));
  const narrows = (probe: string, baseline: string) => expect(count(probe), probe).toBeLessThan(count(baseline));

  it('shots', () => {
    for (const p of ['fp_shots_by_status_PendingR', 'fp_shots_by_code_SH0020', 'fp_shots_by_search_turn', 'fp_shots_by_sequence_SQ010', 'fp_shots_by_sequence_code_SQ010']) {
      const key = Object.keys(flow).find((k) => k.startsWith(p.slice(0, p.lastIndexOf('_')))) ?? p;
      narrows(key, 'fp_shots_baseline');
    }
    same(Object.keys(flow).find((k) => k.startsWith('fp_shots_by_assigned_artist'))!, 'fp_shots_baseline'); // not a filter
    same(Object.keys(flow).find((k) => k.startsWith('fp_shots_by_nonsense'))!, 'fp_shots_baseline');
  });

  it('assets: status/category/search narrow; code is not a filter', () => {
    for (const p of ['fp_assets_by_status', 'fp_assets_by_category', 'fp_assets_by_search']) narrows(Object.keys(flow).find((k) => k.startsWith(p))!, 'fp_assets_baseline');
    same(Object.keys(flow).find((k) => k.startsWith('fp_assets_by_code'))!, 'fp_assets_baseline');
  });

  it('tasks: link, assignee, priority, status narrow; code, reviewer and show_id do nothing', () => {
    for (const p of ['fp_tasks_by_asset_id', 'fp_tasks_by_assignee_id', 'fp_tasks_by_entity_type', 'fp_tasks_by_priority', 'fp_tasks_by_shot_id', 'fp_tasks_by_sequence_id', 'fp_tasks_by_status_Pending']) {
      narrows(Object.keys(flow).find((k) => k.startsWith(p))!, 'fp_tasks_baseline');
    }
    for (const p of ['fp_tasks_by_code', 'fp_tasks_by_reviewer', 'fp_tasks_by_show_id', 'fp_tasks_by_status_ALL']) same(Object.keys(flow).find((k) => k.startsWith(p))!, 'fp_tasks_baseline');
  });

  it('timelogs: status, person, date range and billable narrow', () => {
    for (const p of ['fp_timelogs_by_status_Approved', 'fp_timelogs_by_person', 'fp_timelogs_by_date', 'fp_timelogs_by_billable_false']) narrows(Object.keys(flow).find((k) => k.startsWith(p))!, 'fp_timelogs_baseline');
  });
});

describe('the status machine the UI offers matches what the server accepted and refused', () => {
  const ok = (key: string) => expect(flow[key].status, key).toBe(200);
  const refused = (key: string) => expect(flow[key].body.error.code, key).toBe('invalid_transition');

  it('shots', () => {
    ok('shots_patch_status_in_progress');
    expect(isAllowedMove('shot', 'Not Started', 'In Progress')).toBe(true);
    ok('shots_patch_status_review');
    expect(isAllowedMove('shot', 'In Progress', 'Pending Review')).toBe(true);
    refused('shots_approve_from_in_progress');
    expect(isAllowedMove('shot', 'In Progress', 'Approved')).toBe(false);
    ok('lead_shot_approve');
    expect(isAllowedMove('shot', 'Pending Review', 'Approved')).toBe(true);
    refused('lead_shot_leave_approved');
    expect(isAllowedMove('shot', 'Approved', 'In Progress')).toBe(false);
  });

  it('tasks', () => {
    ok('tasks_status_in_progress');
    refused('tasks_status_approved_direct');
    expect(isAllowedMove('task', 'In Progress', 'Approved')).toBe(false);
    ok('tasks_status_review');
    expect(isAllowedMove('task', 'Pending Review', 'Approved')).toBe(true);
    expect(isAllowedMove('task', 'In Progress', 'On Hold')).toBe(false); // On Hold is a shot-only state
  });

  it('assets: no transition table, any status may follow any other', () => {
    ok('assets_status_approved_direct');
    ok('assets_status_back_to_start');
    ok('assets_status_retake');
    expect(isAllowedMove('asset', 'Not Started', 'Approved')).toBe(true);
    expect(isAllowedMove('asset', 'Approved', 'Not Started')).toBe(true);
    expect(flow.assets_status_history.status).toBe(404); // and there is no status-history route for them
  });

  it('a code can be changed by PATCH until a version exists (then rename-code); a new code must be free', () => {
    expect(flow.shots_patch_code.body.code).toBe('SH7777');
    expect(flow.assets_patch_code.body.code).toBe('ZZZ_NEW');
    expect(flow.shots_rename_code.status).toBe(200);
    expect(flow.artist_rename_code.status).toBe(403);
  });

  it('timelogs', () => {
    expect(isAllowedMove('timelog', 'Submitted', 'Rejected')).toBe(true);
    expect(flow.timelogs_reject.body.status).toBe('Rejected');
    expect(isAllowedMove('timelog', 'Rejected', 'Submitted')).toBe(true);
    expect(isAllowedMove('timelog', 'Approved', 'Submitted')).toBe(false);
    expect(flow.timelogs_patch_approved.status).toBe(409);
  });

  it('only working states and Approved are offered; Archived is its own action', () => {
    expect(nextStatuses('shot', 'Pending Review')).toEqual(['Not Started', 'In Progress', 'Retake', 'On Hold', 'Approved']);
    expect(nextStatuses('task', 'Approved')).toEqual([]);
    expect(nextStatuses('shot', 'Some Legacy Status')).toContain('Approved'); // an unknown status is never trapped
  });
});
