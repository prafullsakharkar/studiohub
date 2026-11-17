import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { reviewMediaInFlight } from '../review';
import type { Version } from '../review';
import * as K from '../reviewRowKeys';

/**
 * Remaking review copies (RP-14, docs/review-pipeline/CONTRACTS.md C-RP-37 and C-RP-38), pinned to the capture made
 * with a real ffmpeg: docs/sync/samples/production/_review_remake_flow.json.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_remake_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const remaking = flow.version_remaking.body as Version;
const remade = flow.version_remade.body as Version;

describe('C-RP-37: remaking one copy', () => {
  it.each([
    ['ReviewMedia (remake queued)', flow.remake_202.body, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (remade, ready)', remade.review_media, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (the copy shown while remaking)', remaking.review_media, K.REVIEWMEDIA_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('a remake is a new queued row naming the copy it remakes; that copy stays the version’s copy meanwhile', () => {
    expect(flow.remake_202.status).toBe(202);
    expect(flow.remake_202.body).toMatchObject({ status: 'queued', kind: 'movie', remake_of: (flow.ids as any).old });
    expect(remaking.review_media?.id).toBe((flow.ids as any).old);
    expect(remaking.review_media?.status).toBe('ready');
    expect(remaking.review_media_job?.id).toBe(flow.remake_202.body.id);
    expect(reviewMediaInFlight(remaking.review_media_job)).toBe(true);
  });

  it('once ready it is the version’s copy, with burn-ins, and there is no job', () => {
    expect(remade.review_media?.id).toBe(flow.remake_202.body.id);
    expect(remade.review_media?.remake_of).toBe((flow.ids as any).old);
    expect(remade.review_media?.probe?.burn_ins).toBe(true);
    expect(remade.review_media_job).toBeNull();
    expect(remaking.review_media?.remake_of).toBeNull();
  });

  it('refusals: a sequence, a copy that is no longer ready, busy, switched off, no right', () => {
    expect(flow.remake_sequence_400.body.detail).toEqual(['The frames of a sequence are not kept once its copy is ready. Upload the frames again.']);
    expect(flow.remake_old_not_ready_400.body.detail).toEqual(['Only a ready review copy can be remade.']);
    expect(flow.remake_busy_409.body.error.code).toBe('review_media_busy');
    expect(flow.remake_disabled_409.body.error.code).toBe('review_media_disabled');
    expect(flow.remake_by_artist_403.status).toBe(403);
  });
});

describe('C-RP-38: a project’s copies', () => {
  it.each([
    ['ReviewCopies', flow.copies_switch_on.body, K.REVIEWCOPIES_KEYS],
    ['ReviewCopiesRemade', flow.remake_all_200.body, K.REVIEWCOPIESREMADE_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('counts the movies and the sequences that differ from the switch, before and after remaking', () => {
    expect(flow.copies_switch_off.body).toEqual({ review_burn_ins: false, out_of_date: 0, sequences_out_of_date: 0, colour_out_of_date: 0 });
    expect(flow.copies_switch_on.body).toEqual({ review_burn_ins: true, out_of_date: 2, sequences_out_of_date: 1, colour_out_of_date: 0 });
    expect(flow.copies_after_one.body.out_of_date).toBe(1);
    expect(flow.copies_after_all.body).toEqual({ review_burn_ins: true, out_of_date: 0, sequences_out_of_date: 1, colour_out_of_date: 0 });
  });

  it('remakes the movies, counts the sequence, and is for project writers only (an artist reads the counts)', () => {
    expect(flow.remake_all_200.body).toEqual({ queued: 1, skipped_busy: 0, skipped_sequence: 1, skipped_missing: 0 });
    expect(flow.copies_by_artist.status).toBe(200);
    expect(flow.remake_all_by_artist_403.status).toBe(403);
    expect((flow.version_two_remade.body as Version).review_media?.remake_of).not.toBeNull();
  });
});
