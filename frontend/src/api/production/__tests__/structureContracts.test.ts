import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { EditorialTrack, Episode, Project, ProjectCounts, ProjectMember, ProjectNote, Sequence, Show } from '../structure';

/**
 * The hand-written production row types list EXACTLY the fields the real backend returned
 * (docs/sync/samples/production/_structure_flow.json): `Record<keyof T, true>` stops compiling when the
 * type and the capture disagree in either direction.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const firstRow = (key: string): Record<string, unknown> => flow[key].body.results[0];

const PROJECT_KEYS: Record<keyof Project, true> = { approved_shots: true, aspect_ratio: true, budget_usd: true, client_contact_id: true, client_contact_name: true, client_id: true, client_name: true, code: true, color_space: true, coordinator_id: true, coordinator_name: true, created_at: true, delivery_date: true, description: true, fps: true, id: true, in_progress_shots: true, name: true, project_code: true, resolution: true, start_date: true, status: true, supervisor_id: true, supervisor_name: true, thumbnail_url: true, total_assets: true, total_shots: true, type: true, updated_at: true, uuid: true, vendor_ids: true, vendor_names: true, vendor_team_ids: true, workflow_type: true };
const SHOW_KEYS: Record<keyof Show, true> = { code: true, created_at: true, delivery_date: true, description: true, id: true, is_primary: true, name: true, project_code: true, project_id: true, season: true, start_date: true, status: true, thumbnail_url: true, type: true, updated_at: true, uuid: true };
const EPISODE_KEYS: Record<keyof Episode, true> = { air_date: true, code: true, created_at: true, deleted_at: true, delivery_date: true, description: true, duration_frames: true, episode_number: true, frame_in: true, frame_out: true, id: true, is_deleted: true, metadata: true, name: true, project_code: true, project_id: true, project_name: true, season_number: true, show_id: true, status: true, updated_at: true, uuid: true };
const SEQUENCE_KEYS: Record<keyof Sequence, true> = { code: true, created_at: true, deleted_at: true, department: true, description: true, episode_id: true, frame_in: true, frame_out: true, id: true, is_deleted: true, lead_artist: true, lead_artist_id: true, lead_artist_name: true, metadata: true, name: true, project_code: true, project_id: true, project_name: true, shots_count: true, show_id: true, status: true, tags: true, updated_at: true, uuid: true };
const EDITORIALTRACK_KEYS: Record<keyof EditorialTrack, true> = { clip_count: true, cut_id: true, cut_name: true, end_tc: true, id: true, name: true, project_code: true, project_id: true, start_tc: true, status: true, track_number: true, track_type: true, updated_at: true, uuid: true };
const PROJECTMEMBER_KEYS: Record<keyof ProjectMember, true> = { avatar_url: true, client_id: true, created_at: true, department: true, department_id: true, email: true, id: true, name: true, projectId: true, project_code: true, project_id: true, project_name: true, role: true, role_id: true, roles: true, scope: true, status: true, team_id: true, updated_at: true, userId: true, user_id: true, vendor_id: true };
const PROJECTNOTE_KEYS: Record<keyof ProjectNote, true> = { addressed_at: true, addressed_by: true, author_avatar: true, author_id: true, author_name: true, author_role: true, body: true, category: true, created_at: true, entity_code: true, entity_id: true, entity_name: true, entity_type: true, frame_number: true, id: true, priority: true, project_code: true, project_id: true, status: true, subject: true, tags: true, timecode_ref: true, updated_at: true };
const COUNT_KEYS: Record<keyof ProjectCounts, true> = { approved_shots: true, assets: true, completed_tasks: true, deliveries: true, editorial: true, in_progress_shots: true, notes: true, reviews: true, sequences: true, shots: true, tasks: true, versions: true };

describe('production row types match the captured responses', () => {
  it.each([
    ['Project', 'projects_list', PROJECT_KEYS],
    ['Show', 'shows_list', SHOW_KEYS],
    ['Episode', 'episodes_list', EPISODE_KEYS],
    ['Sequence', 'sequences_list_after_bulk', SEQUENCE_KEYS],
    ['EditorialTrack', 'tracks_list', EDITORIALTRACK_KEYS],
    ['ProjectMember', 'members_get', PROJECTMEMBER_KEYS],
    ['ProjectNote', 'scoped_notes_after', PROJECTNOTE_KEYS],
  ])('%s', (_label, sample, expected) => {
    expect(Object.keys(firstRow(sample)).sort()).toEqual(Object.keys(expected).sort());
  });

  it('statistics and summary counts have the same keys', () => {
    expect(Object.keys(flow.projects_statistics.body).sort()).toEqual(Object.keys(COUNT_KEYS).sort());
    expect(Object.keys(flow.scoped_summary.body.counts).sort()).toEqual(Object.keys(COUNT_KEYS).sort());
  });

  it('reads name the parent `project_id` while writes take `project` (the form payload differs from the row)', () => {
    expect(firstRow('shows_list')).toHaveProperty('project_id');
    expect(firstRow('shows_list')).not.toHaveProperty('project');
  });

  it('CR-13: archive and check-existence on projects and shows are refused even for a superuser; DELETE archives', () => {
    expect(flow.projects_archive.status).toBe(403);
    expect(flow.projects_check_existence.status).toBe(403);
    expect(flow.shows_archive.status).toBe(403);
    expect(flow.shows_check_existence.status).toBe(403);
    expect(flow.projects_destroy.status).toBe(204);
    expect(flow.projects_archived_list.body.count).toBe(1);
    expect(flow.projects_restore.status).toBe(200);
  });

  it('an episodic project starts with its first episode and requires an episode for sequences', () => {
    expect(flow.episodes_list_bootstrapped.body.results.map((e: { code: string }) => e.code)).toEqual(['EP101']);
    expect(flow.sequences_bulk_create.body.results[0].error).toEqual({ episode_id: ['An episode is required for sequences on episodic projects.'] });
    expect(flow.sequences_bulk_create.status).toBe(200); // bulk answers 200 even when every item failed
  });

  it('membership: 201 new, 200 already a member, 404 unknown user; a non-member cannot list projects, a member only theirs', () => {
    expect([flow.members_add.status, flow.members_add_again.status, flow.members_add_unknown.status]).toEqual([201, 200, 404]);
    expect(flow.stranger_projects_list.status).toBe(403);
    expect(flow.member_projects_list.body.count).toBe(1);
    expect(flow.member_project_patch.status).toBe(403);
  });
});
