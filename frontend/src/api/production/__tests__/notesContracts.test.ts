import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { NOTE_LINK_TYPES, NOTE_STATUSES } from '../structure';
import type { ProjectNote, ProjectNoteThread } from '../structure';
import { NOTELINK_KEYS, PROJECTNOTE_KEYS, PROJECTNOTETHREAD_KEYS } from '../structureRowKeys';

/**
 * Review pipeline RP-2 (docs/review-pipeline/CONTRACTS.md C-RP-07 to C-RP-13), pinned to the responses captured in
 * docs/sync/samples/production/_notes_flow.json (docs/sync/tools/test_capture_production_notes.py). The note shape
 * moved here from `_structure_flow.json`, whose capture predates RP-2.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_notes_flow.json');
const ids = flow.ids as unknown as Record<string, string>;
const rows = (key: string): ProjectNote[] => flow[key].body.results;
const sorted = (o: object) => Object.keys(o).sort();
const fieldError = (key: string, field: string) => flow[key].body[field];

describe('note shapes match the captured responses', () => {
  it('a listed thread, a reply, a detail and a link have exactly the pinned keys', () => {
    expect(sorted(rows('list')[0])).toEqual(sorted(PROJECTNOTE_KEYS));
    expect(sorted(flow.reply_by_artist.body)).toEqual(sorted(PROJECTNOTE_KEYS));
    expect(sorted(flow.detail.body)).toEqual(sorted(PROJECTNOTETHREAD_KEYS));
    expect(sorted(flow.detail.body.replies[0])).toEqual(sorted(PROJECTNOTE_KEYS));
    expect(sorted(flow.create_thread.body.links[0])).toEqual(sorted(NOTELINK_KEYS));
  });

  it('the link types and statuses the frontend lists are the server’s', () => {
    const thread = flow.patch_by_author.body as ProjectNote;
    for (const link of thread.links) expect(NOTE_LINK_TYPES).toContain(link.entity_type);
    const seen = ['create_thread', 'status_by_assignee', 'status_closed_by_supervisor'].map((k) => flow[k].body.status);
    expect(seen).toEqual(['Open', 'Addressed', 'Closed']);
    for (const s of seen) expect(NOTE_STATUSES).toContain(s);
  });
});

describe('C-RP-07: a new thread', () => {
  it('links the records in the order sent, with their codes, and the task; ignores the code and status sent', () => {
    const note = flow.create_thread.body as ProjectNote;
    expect(note.links.map((l) => [l.entity_type, l.entity_id])).toEqual([
      ['Shot', ids.shot],
      ['Version', ids.version],
    ]);
    expect(note.links[0].code).toBe('RPN_SH0010');
    expect([note.entity_type, note.entity_id, note.entity_code]).toEqual(['Shot', ids.shot, 'RPN_SH0010']);
    expect([note.task_id, note.task_code, note.status, note.parent_id, note.reply_count]).toEqual([ids.task, 'RPN_T_COMP', 'Open', null, 0]);
  });

  it('the old single-record body still works, and a note on the project has no link', () => {
    expect(flow.create_old_body.body.links.map((l: { entity_id: string }) => l.entity_id)).toEqual([ids.asset]);
    expect([flow.create_on_project.body.entity_type, flow.create_on_project.body.links]).toEqual(['Project', []]);
  });

  it('refuses with one message whatever is wrong with a record', () => {
    for (const key of ['create_other_project_400', 'create_bad_id_400']) {
      expect(flow[key].status).toBe(400);
      expect(fieldError(key, 'links')).toEqual(['One of these records is not in the project.']);
    }
    expect(fieldError('create_too_many_400', 'links')).toEqual(['A note links to at most 20 records.']);
    expect(fieldError('create_task_elsewhere_400', 'task_id')).toEqual(['This task is not in the project.']);
    expect(fieldError('create_empty_400', 'subject')).toBeTruthy();
  });
});

describe('C-RP-09 to C-RP-11: threads and replies', () => {
  it('lists threads only, with their live reply count', () => {
    const listed = rows('list');
    expect(listed.every((n) => n.parent_id === null)).toBe(true);
    expect(listed.find((n) => n.id === flow.create_thread.body.id)?.reply_count).toBe(3);
  });

  it('filters by any link, by the task, by status; an unknown type gives nothing', () => {
    const thread = flow.create_thread.body.id;
    expect(rows('list_by_shot').map((n) => n.id)).toEqual([thread]);
    expect(rows('list_by_version').map((n) => n.id)).toEqual([thread]);
    expect(rows('list_by_asset').map((n) => n.id)).toEqual([flow.create_old_body.body.id]);
    expect(rows('list_by_other_shot')).toEqual([]);
    expect(rows('list_by_task').map((n) => n.id)).toEqual([thread]);
    expect(rows('list_unknown_type')).toEqual([]);
    expect(flow.list_unknown_type.status).toBe(200);
  });

  it('a thread answers its replies oldest first; a reply to a reply is on the root; a reply’s id answers with its thread', () => {
    const detail = flow.detail.body as ProjectNoteThread;
    expect(detail.replies.map((r) => r.id)).toEqual([flow.reply_by_artist.body.id, flow.reply_by_lead.body.id, flow.reply_to_reply.body.id]);
    expect(flow.reply_to_reply.body.parent_id).toBe(detail.id);
    expect(flow.reply_by_artist.body.links).toEqual([]);
    expect(flow.detail_by_reply_id.body.id).toBe(detail.id);
    expect(flow.reply_blank_400.status).toBe(400);
    expect(flow.detail_unknown_404.status).toBe(404);
  });
});

describe('C-RP-12, C-RP-13: who may edit, set the status and delete', () => {
  it('the author edits; someone else without note.update is 403; a reply takes only its body', () => {
    expect(flow.patch_by_author.body.links.map((l: { entity_type: string }) => l.entity_type)).toEqual(['Shot', 'Version', 'Asset']);
    expect(flow.patch_by_other_403.status).toBe(403);
    expect(flow.patch_task_cleared.body.task_id).toBeNull();
    expect(flow.patch_reply_body.status).toBe(200);
    expect(fieldError('patch_reply_links_400', 'detail')).toEqual(['A reply takes only its body.']);
  });

  it('the task’s assignee addresses it; Closed keeps the stamp and Open clears it; a reply has no status', () => {
    const addressed = flow.status_by_assignee.body as ProjectNote;
    expect(addressed.addressed_at).toBeTruthy();
    expect(addressed.addressed_by).toBeTruthy();
    expect(flow.status_closed_by_supervisor.body.addressed_at).toBe(addressed.addressed_at);
    expect([flow.status_reopened.body.addressed_at, flow.status_reopened.body.addressed_by]).toEqual([null, '']);
    expect(flow.status_by_other_403.status).toBe(403);
    expect(fieldError('status_reply_400', 'status')).toEqual(['A reply has no status of its own.']);
  });

  it('the author may not delete once others replied; note.delete may; a deleted thread is gone', () => {
    expect(flow.delete_by_author_after_others_replied_403.status).toBe(403);
    expect([flow.delete_reply_by_author.status, flow.delete_own_note.status, flow.delete_by_supervisor.status]).toEqual([204, 204, 204]);
    expect(flow.detail_after_delete_404.status).toBe(404);
    expect(rows('list_after_deletes').map((n) => n.id)).toEqual([flow.create_on_project.body.id]);
  });

  it('a member bound to a show does not reach the notes routes', () => {
    expect(flow.show_bound_list_404.status).toBe(404);
  });
});
