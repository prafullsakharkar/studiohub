import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { PROJECT_KEYS, SHOW_KEYS, EPISODE_KEYS, SEQUENCE_KEYS, EDITORIALTRACK_KEYS, PROJECTMEMBER_KEYS, PROJECTNOTE_KEYS, COUNT_KEYS } from '../structureRowKeys';
import type { EditorialTrack, Episode, Project, ProjectMember, ProjectNote, Sequence, Show } from '../structure';

/**
 * The hand-written production row types list EXACTLY the fields the real backend returned
 * (docs/sync/samples/production/_structure_flow.json): `Record<keyof T, true>` stops compiling when the
 * type and the capture disagree in either direction.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const firstRow = (key: string): Record<string, unknown> => flow[key].body.results[0];


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

  it('CR-13 (applied): POST archive/ works for projects and shows, and has the same effect as DELETE; the existence checks stay refused (not implemented)', () => {
    expect(flow.projects_archive.status).toBe(200);
    expect(flow.shows_archive.status).toBe(200);
    expect(flow.projects_archived_list_after_archive.body.count).toBe(1);
    expect(flow.projects_restore_after_archive.status).toBe(200);
    expect(flow.projects_destroy.status).toBe(204);
    expect(flow.projects_archived_list.body.count).toBe(1);
    expect(flow.projects_detail_archived.status).toBe(404);
    expect(flow.projects_restore.status).toBe(200);
    expect(flow.projects_check_existence.status).toBe(403); // mapped, they would answer 500: the viewsets do not implement them
    expect(flow.shows_check_existence.status).toBe(403);
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
