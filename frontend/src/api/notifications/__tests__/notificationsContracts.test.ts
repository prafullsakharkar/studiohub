import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectMember, ProjectNote } from '@/api/production/structure';
import { NOTEMENTION_KEYS, PROJECTNOTE_KEYS } from '@/api/production/structureRowKeys';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { NOTIFICATION_KINDS, NOTIFICATION_TARGET_TYPES, notificationsApi } from '../notifications';
import type { Notification } from '../notifications';
import { NOTIFICATION_KEYS, NOTIFICATIONACTOR_KEYS, NOTIFICATIONPROJECT_KEYS, NOTIFICATIONRECORD_KEYS, NOTIFICATIONTARGET_KEYS } from '../notificationsRowKeys';

/**
 * Review pipeline RP-6 (docs/review-pipeline/CONTRACTS.md C-RP-23 to C-RP-25), pinned to the responses captured in
 * docs/sync/samples/notifications/_notifications_flow.json (docs/sync/tools/test_capture_notifications.py).
 */
type Captured = { status: number; body: any; request: { method: string; path: string; body: unknown } };
const flow = loadSample<Record<string, Captured>>('notifications/_notifications_flow.json');
const rows = (key: string): Notification[] => flow[key].body.results;
const sorted = (o: object) => Object.keys(o).sort();

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('C-RP-23: the row shape', () => {
  it('every row, and its actor, project, target and record, has exactly the pinned keys', () => {
    const all = [...rows('artist_list'), ...rows('lead_list'), ...rows('supervisor_list')];
    expect(all.length).toBeGreaterThan(0);
    for (const n of all) {
      expect(sorted(n)).toEqual(sorted(NOTIFICATION_KEYS));
      expect(sorted(n.project)).toEqual(sorted(NOTIFICATIONPROJECT_KEYS));
      expect(sorted(n.target)).toEqual(sorted(NOTIFICATIONTARGET_KEYS));
      if (n.actor) expect(sorted(n.actor)).toEqual(sorted(NOTIFICATIONACTOR_KEYS));
      if (n.record) expect(sorted(n.record)).toEqual(sorted(NOTIFICATIONRECORD_KEYS));
    }
    expect(sorted(flow.artist_read_one.body)).toEqual(sorted(NOTIFICATION_KEYS));
  });

  it('the kinds and target types the frontend lists are the server’s, and every kind was captured', () => {
    const all = [...rows('artist_list'), ...rows('lead_list'), ...rows('supervisor_list')];
    for (const n of all) {
      expect(NOTIFICATION_KINDS).toContain(n.kind);
      expect(NOTIFICATION_TARGET_TYPES).toContain(n.target.type);
    }
    expect(new Set(all.map((n) => n.kind))).toEqual(new Set(NOTIFICATION_KINDS));
  });

  it('newest first; a review movie has no actor; a status row carries both statuses; a failure its code', () => {
    const list = rows('artist_list');
    const times = list.map((n) => Date.parse(n.created_at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const ready = list.find((n) => n.kind === 'review_media_ready') as Notification;
    expect([ready.actor, ready.target.type]).toEqual([null, 'version']);
    expect(list.find((n) => n.kind === 'review_media_failed')?.data).toEqual({ error_code: 'transcode_failed' });
    expect(list.find((n) => n.kind === 'version_status')?.data).toEqual({ from_status: 'Pending Review', to_status: 'Retake' });
    expect(list.find((n) => n.kind === 'task_assigned')?.data).toEqual({});
  });

  it('a note row names the thread by its subject and its record by the first link', () => {
    const note = rows('artist_list').find((n) => n.kind === 'note_created') as Notification;
    expect([note.target.type, note.target.name, note.target.code]).toEqual(['note', 'Edge is soft', '']);
    expect(note.record?.type).toBe('Version');
  });
});

describe('C-RP-23: the inbox routes', () => {
  it('filters by kind and project; an unknown kind gives nothing, not a 400', () => {
    expect(rows('artist_list_kind_version_status').map((n) => n.kind)).toEqual(['version_status']);
    expect(rows('artist_list_project')).toHaveLength(2);
    expect(flow.artist_list_project.body.count).toBe(flow.artist_list.body.count);
    expect([flow.artist_list_unknown_kind.status, flow.artist_list_unknown_kind.body.count]).toEqual([200, 0]);
  });

  it('read and unread answer the row; the count follows', () => {
    expect(flow.artist_read_one.body.read_at).not.toBeNull();
    expect(flow.artist_unread_one.body.read_at).toBeNull();
    expect(flow.artist_unread_count.body).toEqual({ count: flow.artist_list.body.count });
    expect(flow.artist_unread_count_after.body).toEqual({ count: 0 });
  });

  it('read-all stops at `before` and answers how many it changed; a bad `before` is a 400 on the field', () => {
    expect(flow.artist_read_all_before_oldest.body).toEqual({ updated: 1 });
    expect(flow.artist_read_all.body.updated).toBe(flow.artist_list.body.count - 1);
    expect(flow.read_all_bad_before_400.status).toBe(400);
    expect(flow.read_all_bad_before_400.body.before).toBeTruthy();
  });

  it('another person’s row and an unknown id are 404; signed out is 401', () => {
    expect(flow.lead_reads_artists_row_404.status).toBe(404);
    expect(flow.unknown_row_404.status).toBe(404);
    expect(flow.signed_out_401.status).toBe(401);
  });

  it('the client sends the captured paths and bodies', async () => {
    const { calls } = mockFetch((c) => {
      const path = new URL(c.url).pathname;
      if (path.endsWith('/unread-count/')) return { body: flow.artist_unread_count.body };
      if (path.endsWith('/read-all/')) return { body: flow.artist_read_all.body };
      if (path.endsWith('/read/') || path.endsWith('/unread/')) return { body: flow.artist_read_one.body };
      return { body: flow.artist_list.body };
    });
    const id = flow.artist_read_one.body.id;
    const before = (flow.artist_read_all_before_oldest.request.body as { before: string }).before;
    await notificationsApi.unreadCount();
    await notificationsApi.read(id);
    await notificationsApi.unread(id);
    await notificationsApi.readAll();
    await notificationsApi.readAll(before);
    await notificationsApi.list({ kind: 'version_status', unread: true, page: 1, page_size: 20 });
    const sent = calls.map((c) => [c.method, new URL(c.url).pathname, c.body ?? null]);
    expect(sent.slice(0, 5)).toEqual([
      ['GET', '/api/v1/notifications/unread-count/', null],
      ['POST', `/api/v1/notifications/${id}/read/`, {}],
      ['POST', `/api/v1/notifications/${id}/unread/`, {}],
      ['POST', flow.artist_read_all.request.path, flow.artist_read_all.request.body],
      ['POST', flow.artist_read_all_before_oldest.request.path, { before }],
    ]);
    const listed = new URL(calls[5].url);
    expect(listed.pathname).toBe('/api/v1/notifications/');
    expect([listed.searchParams.get('kind'), listed.searchParams.get('unread')]).toEqual(['version_status', 'true']);
  });
});

describe('C-RP-25: mentions on a note', () => {
  it('the note shape carries `mentions` as {id, name}', () => {
    const note = flow.note_create_with_mention.body as ProjectNote;
    expect(sorted(note)).toEqual(sorted(PROJECTNOTE_KEYS));
    expect(note.mentions).toHaveLength(1);
    expect(sorted(note.mentions[0])).toEqual(sorted(NOTEMENTION_KEYS));
  });

  it('an edit keeps the earlier mention and adds the new one, in the order sent', () => {
    const sent = (flow.note_patch_adds_mention.request.body as { mention_ids: string[] }).mention_ids;
    expect((flow.note_patch_adds_mention.body as ProjectNote).mentions.map((m) => m.id)).toEqual(sent);
  });

  it('someone outside, bound to a department or no longer a member is refused with one message', () => {
    for (const key of ['note_create_mention_refused_400', 'note_create_mention_narrowed_400', 'note_create_mention_former_400']) {
      expect(flow[key].status).toBe(400);
      expect(flow[key].body.mention_ids).toEqual(['One of these people cannot be mentioned on this note.']);
    }
  });

  it('the members route answers the fields the mention picker filters on', () => {
    const members = flow.members_list.body.results as ProjectMember[];
    for (const m of members) {
      for (const key of ['user_id', 'status', 'show_id', 'department', 'department_id', 'client_id', 'vendor_id', 'name', 'email', 'role'] as const) expect(m).toHaveProperty(key);
    }
  });
});
