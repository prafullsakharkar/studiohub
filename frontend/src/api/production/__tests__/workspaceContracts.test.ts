import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { shotsApi } from '../work';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_workspaces_flow.json');

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('what the shot and asset workspaces rely on (captured from the running backend)', () => {
  it('an artist who is not a member of the project is refused, on a shot and on an asset (CR-34)', () => {
    for (const name of ['shot_assign_non_member_400', 'asset_assign_non_member_400']) {
      expect(flow[name].status).toBe(400);
      expect(flow[name].body.assigned_artist).toEqual(['Unknown user.']);
    }
    expect(flow.shot_assign.status).toBe(200);
    expect(flow.shot_assign_member_again.status).toBe(200);
    expect(flow.asset_assign.status).toBe(200);
  });

  it('a record is approved only from Pending Review, and an archived or deleted one can no longer be opened', () => {
    expect(flow.shot_approve_from_not_started_400.body.error.code).toBe('invalid_transition');
    expect(flow.shot_approve.status).toBe(200);
    expect(flow.shot_detail_after_archive.status).toBe(404);
    expect(flow.asset_detail_after_archive.status).toBe(404);
    // DELETE is the same soft delete as the archive route: there is no permanent delete.
    expect(flow.shot_delete.status).toBe(204);
    expect(flow.shots_archived_after_delete.body.results.map((s: any) => s.id)).toContain(flow.ids.shot);
  });

  it('a note names its record, and searching by the code also finds notes that only mention it', () => {
    const rows = flow.notes_search_shot.body.results as Array<{ entity_type: string; entity_id: string; subject: string }>;
    expect(rows.filter((n) => n.entity_id === flow.ids.shot).map((n) => n.subject)).toEqual(['Match the plate']);
    expect(rows.length).toBeGreaterThan(1); // the note that merely says "SH0010" is found too: the list is narrowed by entity_id
    expect(flow.notes_search_asset.body.results.map((n: any) => n.entity_id)).toEqual([flow.ids.asset]);
    expect(flow.note_empty_400.body.subject).toEqual(['This field is required.']);
  });

  it('bulk-update applies fields wrapped in data and fields beside the id, and refuses an item with nothing to update (CR-35)', () => {
    expect(flow.shot_after_bulk_wrapped.body.description).toBe('Wrapped');
    expect(flow.shot_after_bulk_flat.body.description).toBe('Flat');
    const nothing = flow.bulk_update_nothing_to_update.body;
    expect(nothing.failed).toBe(1);
    expect(nothing.results[0].error.non_field_errors).toEqual(['The item has no field that can be updated.']);
  });
});

describe('the typed bulkUpdate', () => {
  it('sends the fields beside the id, the shape every version of the route applies', async () => {
    const { calls } = mockFetch(() => ({ body: { successful: 1, failed: 0, results: [] } }));
    await shotsApi.bulkUpdate([{ id: 'a', data: { description: 'x' } }, { id: 'b', data: { status: 'In Progress' } }]);
    expect(calls[0].body).toEqual({ items: [{ id: 'a', description: 'x' }, { id: 'b', status: 'In Progress' }] });
  });
});

describe('what the project workspace relies on (captured from the running backend)', () => {
  it('"Completed" is not a project status, and a PATCH to "Archived" does not archive: the project stays live and listed', () => {
    expect(flow.project_patch_completed.status).toBe(400);
    expect(flow.project_patch_completed.body.status).toEqual(['"Completed" is not a valid choice.']);
    for (const status of ['project_patch_on_hold', 'project_patch_approved']) expect(flow[status].status).toBe(200);
    expect(flow.project_patch_archived.status).toBe(200);
    expect(flow.project_detail_after_status_archived.status).toBe(200);
    expect(flow.projects_archived_after_status_archived.body.results.map((p: any) => p.id)).not.toContain(flow.project_detail.body.id);
  });

  it('archiving soft-deletes: the project can no longer be opened, is listed as archived, and DELETE is the same soft delete', () => {
    expect(flow.project_archive.status).toBe(200);
    expect(flow.project_detail_after_archive.status).toBe(404);
    expect(flow.projects_archived.body.results.map((p: any) => p.id)).toContain(flow.project_detail.body.id);
    expect(flow.project_restore.status).toBe(200);
    expect(flow.project_delete.status).toBe(204);
    expect(flow.projects_archived_after_delete.body.results.map((p: any) => p.id)).toContain(flow.project_detail.body.id);
  });

  it('a duplicate is created from the settings alone; the server ignores the other fields of a whole project it is sent', () => {
    const settings = flow.project_clone_settings;
    expect(settings.status).toBe(201);
    expect(Object.keys((settings as any).request.body).sort()).toEqual(['aspect_ratio', 'code', 'color_space', 'description', 'fps', 'name', 'resolution', 'type', 'workflow_type']);
    expect(settings.body.id).not.toBe(flow.project_detail.body.id);
    expect(flow.project_clone_whole_object.status).toBe(201);
    expect(flow.project_clone_whole_object.body.id).not.toBe(flow.project_detail.body.id);
  });
});
