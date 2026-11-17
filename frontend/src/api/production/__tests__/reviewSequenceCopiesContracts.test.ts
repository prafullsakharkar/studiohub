import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { ReviewCopies, ReviewCopiesKept, ReviewCopiesRemade, ReviewMedia, Version } from '../review';
import * as K from '../reviewRowKeys';

/**
 * Sequence copies after a settings change (RP-16, docs/review-pipeline/CONTRACTS.md C-RP-41 to C-RP-43), pinned to the
 * capture made with a real ffmpeg: docs/sync/samples/production/_review_sequence_copies_flow.json.
 */
type Captured = { status: number; body: unknown };
/** A refusal: a sentence on `detail`, or one per id on `review_media_ids`. */
type Refusal = { detail?: string[]; review_media_ids?: string[] };
const flow = loadSample<Record<string, Captured>>('production/_review_sequence_copies_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const ids = flow.ids as unknown as Record<string, string>;
const on = flow.copies_switch_on.body as ReviewCopies;
const copiesOf = (key: string) => flow[key].body as ReviewCopies;
const refusal = (key: string) => flow[key].body as Refusal;
const queuedRow = flow.remake_kept_202.body as ReviewMedia;
const sequenceRow = (v: Captured) => (v.body as Version).review_media as NonNullable<Version['review_media']>;

describe('C-RP-41: kept frames', () => {
  it.each([
    ['ReviewMedia (frames kept)', sequenceRow(flow.version_frames_kept), K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (frames gone)', sequenceRow(flow.version_frames_gone), K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (sequence remake queued)', queuedRow, K.REVIEWMEDIA_KEYS],
    ['ReviewCopies', on, K.REVIEWCOPIES_KEYS],
    ['ReviewCopyDiffering', on.differing[0], K.REVIEWCOPYDIFFERING_KEYS],
    ['ReviewCopiesKept', flow.keep_200.body as ReviewCopiesKept, K.REVIEWCOPIESKEPT_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('a ready sequence says until when its frames are kept; once swept, null', () => {
    expect(sequenceRow(flow.version_frames_kept).frames_until).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(sequenceRow(flow.version_frames_gone).frames_until).toBeNull();
  });

  it('a kept sequence is remade from its frames, keeping their time; one whose frames are gone is refused', () => {
    expect(flow.remake_kept_202.status).toBe(202);
    expect(queuedRow).toMatchObject({ kind: 'sequence', status: 'queued', remake_of: ids.kept });
    const remade = sequenceRow(flow.version_sequence_remade);
    expect(remade.id).toBe(ids.remade);
    expect(remade.frames_until).toBe(sequenceRow(flow.version_frames_kept).frames_until);
    expect(remade.probe?.burn_ins).toBe(true);
    expect(flow.remake_gone_400.status).toBe(400);
    expect(refusal('remake_gone_400').detail).toEqual(['The frames of this sequence are no longer kept. Upload the frames again.']);
  });
});

describe('C-RP-42: which copies differ', () => {
  it('none before the switch; then all three, oldest first, with why and whether they can be remade', () => {
    expect(copiesOf('copies_switch_off').differing).toEqual([]);
    expect(copiesOf('copies_switch_off').differing_more).toBe(0);
    expect(on.differing.map((row) => [row.review_media_id, row.kind, row.remakable, row.why])).toEqual([
      [ids.gone, 'sequence', false, ['burn_ins']],
      [ids.kept, 'sequence', true, ['burn_ins']],
      [ids.movie, 'movie', true, ['burn_ins']],
    ]);
    expect(on.differing[0].version).toEqual({ id: ids.first, code: 'RPS_SH0010_COMP_V001' });
    expect(on.differing[0].record_code).toBe('RPS_SH0010');
    expect(on.differing[0].frames_until).toBeNull();
    expect(on.differing[1].frames_until).not.toBeNull();
    expect(on).toMatchObject({ out_of_date: 1, sequences_out_of_date: 2, differing_more: 0 });
    expect(flow.copies_by_artist.status).toBe(200);
  });
});

describe('C-RP-43: keep as they are', () => {
  it('refusals: no right, a copy that can be remade, no ids', () => {
    expect(flow.keep_by_artist_403.status).toBe(403);
    expect(flow.keep_remakable_400.status).toBe(400);
    expect(refusal('keep_remakable_400').review_media_ids?.[0]).toContain('this copy can be remade; remake it instead.');
    expect(flow.keep_empty_400.status).toBe(400);
    expect(refusal('keep_empty_400').review_media_ids).toBeTruthy();
  });

  it('a kept copy stops counting, and counts again once the view changes', () => {
    expect(flow.keep_200.body).toEqual({ kept: 1 });
    const after = copiesOf('copies_after_keep');
    expect(after.differing.map((row) => row.review_media_id)).not.toContain(ids.gone);
    const changed = copiesOf('copies_after_view_change');
    // it counts again with everything that differs, the burn-ins it was kept with as well
    expect(changed.differing.find((row) => row.review_media_id === ids.gone)?.why).toEqual(['burn_ins', 'colour']);
  });

  it('the project remake then remakes what it can and counts the sequence whose frames are gone', () => {
    expect((flow.remake_all_200.body as ReviewCopiesRemade).skipped_sequence).toBe(1);
    expect(copiesOf('copies_after_all').differing.map((row) => row.review_media_id)).toEqual([ids.gone]);
  });
});
