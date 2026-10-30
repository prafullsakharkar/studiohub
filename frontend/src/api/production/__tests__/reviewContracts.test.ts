import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { isAllowedMove, nextStatuses, reviewActionsFrom } from '../statusFlow';
import * as K from '../reviewRowKeys';

/**
 * The hand-written review-side row types list EXACTLY the fields the real backend returned
 * (docs/sync/samples/production/_review_flow.json); the lists in reviewRowKeys.ts are compiled by tsc, this file
 * compares them with the capture. The behaviour tests pin the rules the screens rely on.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const firstRow = (key: string): any => {
  const body = flow[key].body;
  return body.results?.[0] ?? body.items?.[0] ?? body;
};
const count = (key: string): number => flow[key].body.count ?? flow[key].body._len;
const keys = (o: object) => Object.keys(o).sort();
const review = flow.reviews_detail_after_approve.body;

describe('review row types match the captured responses', () => {
  it.each([
    ['Version', firstRow('versions_list'), K.VERSION_KEYS],
    ['Review', firstRow('reviews_list'), K.REVIEW_KEYS],
    ['ReviewVersion', review.versions[0], K.REVIEWVERSION_KEYS],
    ['ReviewParticipant', review.reviewers[0], K.REVIEWPARTICIPANT_KEYS],
    ['ReviewComment', flow.reviews_comments_add.body, K.REVIEWCOMMENT_KEYS],
    ['ReviewReply (a comment without replies: replies never nest)', review.comments.find((c: any) => c.replies.length > 0).replies[0], K.REVIEWREPLY_KEYS],
    ['ReviewNote', review.notes[0], K.REVIEWNOTE_KEYS],
    ['ReviewAnnotation', review.annotations[0], K.REVIEWANNOTATION_KEYS],
    ['ReviewActivity', review.activity[0], K.REVIEWACTIVITY_KEYS],
    ['Playlist', firstRow('playlists_list'), K.PLAYLIST_KEYS],
    ['PlaylistEntry', flow.playlists_detail.body.entries.find((e: any) => 'version_number' in e), K.PLAYLISTENTRY_KEYS],
    ['Media', firstRow('media_list'), K.MEDIA_KEYS],
    ['Workflow', firstRow('workflows_list'), K.WORKFLOW_KEYS],
    ['AutomationRule', firstRow('automations_rules_after'), K.AUTOMATIONRULE_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row)).toEqual(keys(expected));
  });

  it('list and detail rows have the same shape', () => {
    for (const [list, detail] of [['versions_list', 'versions_detail'], ['reviews_list', 'reviews_detail'], ['playlists_list', 'playlists_detail'], ['workflows_list', 'workflows_detail']]) {
      expect(keys(firstRow(list)), list).toEqual(keys(flow[detail].body));
    }
  });

  it('media and automation lists are bare arrays; versions, reviews, playlists and workflows are paginated', () => {
    expect(flow.media_list.body._bare_list).toBe(true);
    expect(flow.automations_rules_after.body._bare_list).toBe(true);
    for (const key of ['versions_list', 'reviews_list', 'playlists_list', 'workflows_list']) expect(flow[key].body).toHaveProperty('count');
  });
});

describe('versions', () => {
  it('the server numbers them: a version_number sent on create is ignored', () => {
    expect(flow.versions_create_number_ignored.status).toBe(201);
    expect(flow.versions_create_number_ignored.body.version_number).toBe('v001');
    expect(flow.versions_create.body.code).toBe('SH0010_COMPOSITING_V001'); // a blank code is derived
  });

  it('about a shot or an asset, never both; project is required', () => {
    expect(flow.versions_create_both.body.asset).toEqual(['A version is about a shot or an asset, not both.']);
    expect(flow.versions_create_empty.body.project).toBeTruthy();
  });

  it('approving what you produced is 403 separation_of_duties on every path (status, promote); a plain approver is fine', () => {
    expect(flow.versions_admin_approves_own.status).toBe(403);
    expect(flow.versions_admin_approves_own.body.error.code).toBe('separation_of_duties');
    expect(flow.versions_admin_promotes_own.body.error.code).toBe('separation_of_duties');
    expect(flow.versions_lead_approves.status).toBe(200);
    expect(flow.versions_artist_approve_own.status).toBe(403); // an artist does not even hold version.publish
    expect(flow.versions_artist_patch.status).toBe(403);
  });

  it('publish needs an approved version, cannot repeat, freezes everything but notes and tags, and blocks archiving', () => {
    expect(flow.versions_publish_unapproved.body.status).toEqual(['Only an approved version can be published.']);
    expect(flow.versions_publish.status).toBe(200);
    expect(flow.versions_publish.body.is_published).toBe(true);
    expect(flow.versions_publish_twice.body.is_published).toEqual(['This version is already published.']);
    expect(flow.versions_published_edit.body.fields).toEqual(['department']);
    expect(flow.versions_published_notes_edit.status).toBe(200);
    expect(flow.versions_published_archive.status).toBe(400);
    expect(flow.versions_unpublish.status).toBe(200);
    expect(flow.versions_unpublish_twice.status).toBe(400);
    expect(flow.versions_publish_again.status).toBe(200);
    expect(flow.versions_artist_publish.status).toBe(403);
  });

  it('promote makes the hero', () => {
    expect(flow.versions_promote.status).toBe(200);
    expect(flow.versions_detail_after_promote.body.is_hero).toBe(true);
  });

  it('add-to-playlist takes an existing playlist or names a new one', () => {
    expect(flow.versions_add_to_playlist.status).toBe(200);
    expect(flow.versions_add_to_new_playlist.status).toBe(200);
  });

  it('only entity_type + entity_id (and status, department, is_published) filter; shot_id, task_id, asset_id, artist and is_hero are ignored', () => {
    const base = count('fp_versions_baseline');
    const by = (prefix: string) => count(Object.keys(flow).find((k) => k.startsWith(prefix))!);
    for (const p of ['fp_versions_by_status', 'fp_versions_by_department', 'fp_versions_by_entity_id', 'fp_versions_by_entity_type', 'fp_versions_by_is_published']) expect(by(p), p).toBeLessThan(base);
    for (const p of ['fp_versions_by_shot_id', 'fp_versions_by_task_id', 'fp_versions_by_asset_id', 'fp_versions_by_artist', 'fp_versions_by_is_hero', 'fp_versions_by_nonsense']) expect(by(p), p).toBe(base);
  });

  it('the status table: a version moves like a task and enters Approved only from Pending Review', () => {
    expect(isAllowedMove('version', 'Not Started', 'Approved')).toBe(false);
    expect(flow.versions_status_in_progress.status).toBe(200);
    expect(flow.versions_status_review.status).toBe(200);
    expect(isAllowedMove('version', 'Pending Review', 'Approved')).toBe(true);
    expect(nextStatuses('version', 'Pending Review')).toEqual(['Not Started', 'In Progress', 'Retake', 'Approved']);
  });
});

describe('reviews', () => {
  it('the status machine: what the server accepted and refused matches the table', () => {
    expect(flow.reviews_status_invalid_jump.body.error.code).toBe('invalid_transition'); // Pending Review → Approved
    expect(isAllowedMove('review', 'Pending Review', 'Approved')).toBe(false);
    expect(flow.reviews_submit.status).toBe(200);
    expect(flow.reviews_start_review.status).toBe(200);
    expect(flow.reviews_request_changes.status).toBe(200);
    expect(flow.reviews_resubmit.status).toBe(200);
    expect(isAllowedMove('review', 'Changes Requested', 'Submitted')).toBe(true);
    expect(flow.reviews_approve.status).toBe(200);
    expect(flow.reviews_close.status).toBe(200);
    expect(flow.reviews_two_reject.status).toBe(200);
    expect(flow.reviews_two_verdict.body.status).toEqual(["A review cannot move from 'Rejected' to 'Retake'."]);
    expect(isAllowedMove('review', 'Rejected', 'Retake')).toBe(false);
    expect(flow.reviews_three_retake_verdict.body.status).toBe('Retake'); // a decision by name
  });

  it('the actions a review offers follow its status', () => {
    expect(reviewActionsFrom('Pending Review').map((a) => a.action)).toEqual(['submit', 'startReview', 'close']);
    expect(reviewActionsFrom('In Review').map((a) => a.action)).toEqual(['approve', 'requestChanges', 'reject', 'retake', 'close']);
    expect(reviewActionsFrom('Approved').map((a) => a.action)).toEqual(['close']);
    expect(reviewActionsFrom('Closed')).toEqual([]);
  });

  it('decisions need review.approve and respect separation of duties: whoever submitted cannot approve', () => {
    expect(flow.reviews_lead_approve.status).toBe(403); // a lead does not hold review.approve
    expect(flow.reviews_artist_approve.status).toBe(403);
    expect(flow.reviews_two_self_approve.body.error.code).toBe('separation_of_duties'); // the supervisor submitted it
    expect(flow.reviews_approve.status).toBe(200); // the supervisor approving what a lead submitted
  });

  it('participants: members only, once each; a verdict from a participant who did not submit works and leaves the status alone', () => {
    expect(flow.reviews_participants_add.status).toBe(201);
    expect(flow.reviews_participants_add_again.status).toBe(400);
    expect(flow.reviews_participants_add_stranger.body.user_id).toEqual(['Unknown user.']);
    expect(flow.reviews_participant_verdict.body.error.code).toBe('separation_of_duties'); // this participant submitted the review
    expect(flow.reviews_participant_verdict_other_user.status).toBe(403); // another account may not answer for them
    expect(flow.reviews_three_participant_verdict.status).toBe(200);
    expect(flow.reviews_three_detail_after_participant.body.status).toBe('In Review');
    expect(flow.reviews_three_detail_after_participant.body.reviewers[0].verdict).toBe('Approved');
    expect(flow.reviews_three_remove_participant.status).toBe(200);
  });

  it('versions go on a review once; comments reply one level, resolve and reopen', () => {
    expect(flow.reviews_add_version.status).toBe(201);
    expect(flow.reviews_add_version_again.status).toBe(400);
    expect(flow.reviews_remove_version.status).toBe(200);
    expect(flow.reviews_comments_add.status).toBe(201);
    expect(flow.reviews_comments_reply.body.parent_id).toBeTruthy();
    const commentOf = (key: string) => flow[key].body.comments.find((c: any) => c.id === flow.reviews_comments_reply.body.parent_id); // resolve and reopen answer the whole review
    expect(commentOf('reviews_comments_resolve').is_resolved).toBe(true);
    expect(commentOf('reviews_comments_reopen').is_resolved).toBe(false);
  });

  it('CR-16: the server refuses an empty comment, any status but Pending Review on create and any verdict it does not know; a comment on a closed review is still accepted', () => {
    expect(flow.reviews_comments_empty.status).toBe(400);
    expect(flow.reviews_comments_empty.body.text).toEqual(['A comment needs some text.']);
    expect(flow.reviews_create_bad_status.status).toBe(400);
    expect(flow.reviews_create_second.body.status).toBe('Pending Review');
    expect(flow.reviews_three_verdict_bogus.status).toBe(400);
    expect(flow.reviews_three_participant_verdict_bogus.status).toBe(400);
    expect(flow.reviews_comment_on_closed.status).toBe(201); // D-30: not asked for
  });

  it('CR-15: archive on reviews needs review.delete (a supervisor) and restore brings it back; DELETE archives too', () => {
    expect(flow.reviews_two_archive.status).toBe(200);
    expect(flow.reviews_two_archive_restore.status).toBe(200);
    expect(flow.reviews_two_delete.status).toBe(204);
    expect(flow.reviews_two_restore.status).toBe(200);
  });

  it('an artist can read a review but not write to it; a stranger sees nothing', () => {
    expect(flow.reviews_artist_detail.status).toBe(200);
    expect(flow.reviews_artist_comment.status).toBe(403);
    expect(flow.stranger_review_detail.status).toBe(404);
    expect(flow.stranger_version_detail.status).toBe(404);
  });

  it('only status, entity_id, entity_type and search filter reviews', () => {
    const base = count('fp_reviews_baseline');
    expect(count(Object.keys(flow).find((k) => k.startsWith('fp_reviews_by_status'))!)).toBeLessThan(base);
    expect(count(Object.keys(flow).find((k) => k.startsWith('fp_reviews_by_search'))!)).toBeLessThan(base);
    expect(count(Object.keys(flow).find((k) => k.startsWith('fp_reviews_by_nonsense'))!)).toBe(base);
  });
});

describe('playlists', () => {
  it('entries are added, removed and reordered by action; PATCH of entries is refused', () => {
    expect(flow.playlists_add_entry.status).toBe(200);
    expect(flow.playlists_patch_entries_locked.body.entries[0]).toMatch(/Use add-entry, remove-entry and reorder/);
    expect(flow.playlists_reorder.status).toBe(200);
    expect(flow.playlists_reorder_unknown.body.entries).toEqual(['Unknown entry.']);
    expect(flow.playlists_remove_entry_unknown.status).toBe(200); // nothing changes
  });

  it('an empty add-entry makes a placeholder; entries on create must be versions of the project', () => {
    expect(flow.playlists_add_entry_empty.body.entries.some((e: any) => e.version_id === null)).toBe(true);
    expect(flow.playlists_create_with_entries.status).toBe(201);
    expect(flow.playlists_create_foreign_version.status).toBe(400);
  });

  it('share validates its keys; an empty share is a no-op that still answers 200', () => {
    expect(flow.playlists_share.status).toBe(200);
    expect(flow.playlists_share_bad_key.body.is_public).toEqual(['Must be a valid boolean.']);
    expect(flow.playlists_share_empty.status).toBe(200);
  });

  it('a lead builds playlists; an artist can only read them', () => {
    expect(flow.playlists_create.status).toBe(201);
    expect(flow.playlists_artist_create.status).toBe(403);
    expect(flow.playlists_artist_list.status).toBe(200);
    expect(flow.playlists_archive.status).toBe(200);
    expect(flow.playlists_restore.status).toBe(200);
  });
});

describe('media, workflows, automations', () => {
  it('media: any media_type is accepted (free text); an artist creates but cannot edit; a lead archives (media.update) but cannot delete', () => {
    expect(flow.media_create_bad_type.status).toBe(201);
    expect(flow.media_artist_patch.status).toBe(403);
    expect(flow.media_lead_patch.status).toBe(200);
    expect(flow.media_archive.status).toBe(200); // CR-15
    expect(flow.media_archive_restore.status).toBe(200);
    expect(flow.media_delete.status).toBe(403);
  });

  it('workflows: codes are not unique, a clone repeats its code, simulate is a stub that reports every node a success', () => {
    expect(flow.workflows_create_duplicate.status).toBe(201);
    expect(flow.workflows_clone.body.code).toBe('CF1-COPY');
    expect(flow.workflows_clone_again.body.code).toBe('CF1-COPY');
    expect(flow.workflows_clone.body.is_active).toBe(false);
    expect(flow.workflows_simulate.body.overall_status).toBe('success');
    expect(flow.workflows_simulate.body.steps.every((s: any) => s.status === 'success')).toBe(true);
    expect(flow.workflows_simulate.body.side_effects).toEqual([]);
  });

  it('workflows: a lead reads and simulates but cannot create', () => {
    expect(flow.workflows_lead_list.status).toBe(200);
    expect(flow.workflows_lead_simulate.status).toBe(200);
    expect(flow.workflows_lead_create.status).toBe(403);
  });

  it('automation rules are stored definitions that never ran; trigger is an object; non-admins need a project', () => {
    expect(flow.automations_rules_create.body.trigger).toEqual(['Must be an object.']);
    expect(flow.automations_rules_create_ok.status).toBe(201);
    expect(flow.automations_rules_create_ok.body.execution_count).toBe(0);
    expect(flow.automations_rules_after.body.items[0].trigger).toEqual({ event: 'status_changed', entity_type: 'Version', filters: { status: 'Approved' } });
    expect(flow.automations_audit_logs.body._len).toBe(0);
    expect(flow.automations_supervisor_create.body.project_id).toEqual(['A project is required.']);
    expect(flow.automations_artist_rules.status).toBe(403);
  });
});
