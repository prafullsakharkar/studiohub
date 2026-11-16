import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectMember, ProjectNote } from '@/api/production/structure';
import { NOTEMENTION_KEYS, PROJECTNOTE_KEYS } from '@/api/production/structureRowKeys';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { NOTIFICATION_KINDS, NOTIFICATION_TARGET_TYPES, notificationsApi } from '../notifications';
import type { Notification } from '../notifications';
import { NOTIFICATION_KEYS, NOTIFICATIONACTOR_KEYS, NOTIFICATIONPREFERENCES_KEYS, NOTIFICATIONPROJECT_KEYS, NOTIFICATIONRECORD_KEYS, NOTIFICATIONTARGET_KEYS } from '../notificationsRowKeys';

/**
 * Review pipeline RP-6 (docs/review-pipeline/CONTRACTS.md C-RP-23 to C-RP-25), pinned to the responses captured in
 * docs/sync/samples/notifications/_notifications_flow.json (docs/sync/tools/test_capture_notifications.py).
 */
type Captured = { status: number; body: any; request: { method: string; path: string; body: unknown } };
const flow = loadSample<Record<string, Captured>>('notifications/_notifications_flow.json');
const rows = (key: string): Notification[] => flow[key].body.results;
/** RP-11 (C-RP-28 to C-RP-30): docs/sync/samples/notifications/_review_notifications_flow.json (test_capture_review_notifications.py). */
const reviewFlow = loadSample<Record<string, Captured>>('notifications/_review_notifications_flow.json');
const reviewRows = (key: string): Notification[] => reviewFlow[key].body.results;
/** RP-13 (C-RP-34 to C-RP-36): docs/sync/samples/notifications/_pipeline_notifications_flow.json (test_capture_pipeline_notifications.py). */
const pipelineFlow = loadSample<Record<string, Captured>>('notifications/_pipeline_notifications_flow.json');
const pipelineRows = (key: string): Notification[] => pipelineFlow[key].body.results;
const PIPELINE_LISTS = ['producer_list', 'supervisor_list', 'coordinator_list', 'td_list', 'artist_list'];
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
    const all = [...rows('artist_list'), ...rows('lead_list'), ...rows('supervisor_list'), ...reviewRows('artist_list'), ...reviewRows('lead_list'), ...reviewRows('supervisor_list'), ...reviewRows('client_list'), ...PIPELINE_LISTS.flatMap(pipelineRows)];
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

describe('C-RP-28: review rows', () => {
  const all = () => [...reviewRows('artist_list'), ...reviewRows('lead_list'), ...reviewRows('supervisor_list'), ...reviewRows('client_list')];

  it('every review row has the pinned keys and names the review by its code and title, its record by the shot', () => {
    expect(all().length).toBeGreaterThan(0);
    for (const n of all()) {
      expect(sorted(n)).toEqual(sorted(NOTIFICATION_KEYS));
      expect(sorted(n.target)).toEqual(sorted(NOTIFICATIONTARGET_KEYS));
      expect([n.target.type, n.target.code, n.target.name]).toEqual(['review', 'RPR_DAILIES', 'Dailies']);
      expect([n.record?.type, n.record?.code]).toEqual(['Shot', 'RPR_SH010']);
    }
  });

  it('each kind carries its data: the decision, the verdict, the version commented on; an invitation nothing', () => {
    const decision = reviewRows('artist_list_kind_review_decision');
    expect(decision.map((n) => [n.kind, n.data])).toEqual([['review_decision', { to_status: 'Approved' }]]);
    expect(reviewRows('lead_list').map((n) => [n.kind, n.data])).toEqual([['review_verdict', { verdict: 'Approved' }]]);
    expect(reviewRows('supervisor_list').map((n) => [n.kind, n.data])).toEqual([['review_invited', {}]]);
    const versionId = (reviewFlow.review_add_version.request.body as { version_id: string }).version_id;
    for (const n of reviewRows('artist_list').filter((r) => r.kind === 'review_comment')) expect(n.data).toEqual({ version_id: versionId });
  });

  it('the artist hears the decision and every comment on their version, internal ones too; the client no internal one', () => {
    expect(reviewRows('artist_list').map((n) => n.kind)).toEqual(['review_decision', 'review_comment', 'review_comment', 'review_comment', 'review_comment']);
    expect(reviewRows('client_list').map((n) => n.kind)).toEqual(['review_decision', 'review_comment', 'review_invited']);
  });
});

describe('C-RP-29: comments a client member is served', () => {
  const texts = (key: string) => (reviewFlow[key].body.comments as { text: string; replies: { text: string }[] }[]).map((c) => [c.text, c.replies.map((r) => r.text)]);

  it('the client sees only client-visible threads and replies; the lead sees every comment', () => {
    expect(texts('review_detail_as_client')).toEqual([['Can the walk be slower?', ['Yes, in v002.']]]);
    expect(texts('review_detail_as_lead')).toEqual([
      ['Can the walk be slower?', ['Yes, in v002.', 'Budget is tight for this.']],
      ['Studio only: check the edge.', []],
    ]);
  });

  it('a client’s comment is stored client-visible though they asked for internal; a hidden comment is 404 to them', () => {
    expect(reviewFlow.client_comment_forced_visible.request.body).toMatchObject({ is_client_visible: false });
    expect(reviewFlow.client_comment_forced_visible.body.is_client_visible).toBe(true);
    expect(reviewFlow.lead_comment_internal.body.is_client_visible).toBe(false);
    expect(reviewFlow.client_resolves_internal_404.status).toBe(404);
    expect(reviewFlow.client_replies_internal_404.status).toBe(404);
  });
});

describe('C-RP-30: preferences', () => {
  it('the shape is exactly muted_kinds and mutable_kinds; mentions and verdict requests cannot be muted', () => {
    const prefs = reviewFlow.preferences_default.body;
    expect(sorted(prefs)).toEqual(sorted(NOTIFICATIONPREFERENCES_KEYS));
    expect(prefs.muted_kinds).toEqual([]);
    expect(prefs.mutable_kinds).toEqual(NOTIFICATION_KINDS.filter((k) => k !== 'note_mention' && k !== 'review_invited'));
  });

  it('a save answers the list in the kinds’ order, each once; a refused kind is a 400 on the field', () => {
    expect(reviewFlow.preferences_save.body.muted_kinds).toEqual(['task_status', 'review_comment']);
    expect(reviewFlow.preferences_after_save.body).toEqual(reviewFlow.preferences_save.body);
    expect([reviewFlow.preferences_unmutable_400.status, reviewFlow.preferences_unmutable_400.body.muted_kinds]).toEqual([400, ['note_mention cannot be muted.']]);
    expect([reviewFlow.preferences_unknown_400.status, reviewFlow.preferences_unknown_400.body.muted_kinds]).toEqual([400, ['Unknown kind: spaceship.']]);
    expect(reviewFlow.preferences_signed_out_401.status).toBe(401);
  });

  it('a muted kind is not written: the comment made after muting adds nothing to the count', () => {
    expect(reviewFlow.artist_unread_count_while_muted.body).toEqual({ count: reviewFlow.artist_list.body.count });
  });

  it('the client reads and replaces the preferences on the captured path and body', async () => {
    const { calls } = mockFetch(() => ({ body: reviewFlow.preferences_save.body }));
    await notificationsApi.preferences();
    const saved = await notificationsApi.savePreferences(['task_status', 'review_comment']);
    expect(calls.map((c) => [c.method, new URL(c.url).pathname, c.body ?? null])).toEqual([
      ['GET', reviewFlow.preferences_default.request.path, null],
      ['PUT', reviewFlow.preferences_save.request.path, { muted_kinds: ['task_status', 'review_comment'] }],
    ]);
    expect(saved).toEqual(reviewFlow.preferences_save.body);
  });
});

describe('C-RP-34 and C-RP-35: delivery, publishing and milestone rows', () => {
  const all = PIPELINE_LISTS.flatMap(pipelineRows);
  const find = (key: string, kind: Notification['kind'], pick: (n: Notification) => boolean = () => true) => pipelineRows(key).find((n) => n.kind === kind && pick(n)) as Notification;

  it('every row has the pinned keys, one of the new target types, and no record', () => {
    expect(all.length).toBeGreaterThan(0);
    for (const n of all) {
      expect(sorted(n)).toEqual(sorted(NOTIFICATION_KEYS));
      expect(sorted(n.target)).toEqual(sorted(NOTIFICATIONTARGET_KEYS));
      expect(['delivery', 'publish_job', 'published_file', 'milestone']).toContain(n.target.type);
      expect(n.record).toBeNull();
    }
  });

  it('labels: a delivery and a job by code and name, a file by its version and file name, a milestone by name', () => {
    const delivery = find('producer_list', 'delivery_status');
    expect([delivery.target.code, delivery.target.name]).toEqual(['RPP_DEL_002', 'Turnover 2']);
    const job = find('td_list', 'publish_finished');
    expect([job.target.type, job.target.code, job.target.name]).toEqual(['publish_job', 'RPP_PUB_002', 'Comp export']);
    const file = find('producer_list', 'published_file_revoked');
    expect([file.target.type, file.target.code, file.target.name]).toEqual(['published_file', 'RPP_SH020_V001', 'plate_main.exr']);
    const milestone = find('producer_list', 'milestone_completed');
    expect([milestone.target.type, milestone.target.code, milestone.target.name]).toEqual(['milestone', '', 'Picture lock']);
  });

  it('each kind carries its data and nothing typed by a person', () => {
    expect(find('producer_list', 'delivery_status', (n) => n.data.to_status === 'Submitted').data).toEqual({ from_status: 'Signed Off', to_status: 'Submitted' });
    expect(find('coordinator_list', 'delivery_client_answer').data).toEqual({ client_status: 'Approved' });
    expect(pipelineRows('td_list').map((n) => n.data.status)).toEqual(['Failed', 'Exported']);
    expect(find('producer_list', 'published_file_revoked').data).toEqual({});
    expect(find('producer_list', 'milestone_completed').data).toEqual({});
    expect(pipelineRows('producer_list_kind_milestone_due').map((n) => n.data.stage)).toEqual(['due', 'overdue']);
    for (const n of pipelineRows('producer_list_kind_milestone_due')) expect(n.data.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(all)).not.toMatch(/Wrong grade|ran out of disk|rpp\//);
  });

  it('the platform’s reopen and a reminder have no actor; the client’s answer is told once, not also as a move', () => {
    const reopen = find('supervisor_list', 'delivery_status', (n) => n.data.to_status === 'Prepared');
    expect([reopen.actor, reopen.data.from_status]).toEqual([null, 'Signed Off']);
    for (const n of pipelineRows('producer_list_kind_milestone_due')) expect(n.actor).toBeNull();
    expect(pipelineRows('coordinator_list').filter((n) => n.data.to_status === 'Approved')).toEqual([]);
  });

  it('an artist without delivery.view hears of publish jobs but of no delivery (CR-53)', () => {
    expect(pipelineRows('artist_list').map((n) => n.target.type)).toEqual(['publish_job', 'publish_job']);
  });

  it('every new kind can be muted (C-RP-30)', () => {
    const { mutable_kinds } = pipelineFlow.producer_preferences.body;
    for (const kind of ['delivery_status', 'delivery_client_answer', 'publish_finished', 'published_file_revoked', 'milestone_due', 'milestone_completed']) expect(mutable_kinds).toContain(kind);
    expect(pipelineFlow.producer_mute_delivery_status.body.muted_kinds).toEqual(['delivery_status', 'milestone_due']);
  });
});
