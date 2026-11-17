import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { reviewMediaInFlight, versionPlayback } from '../review';
import type { Version } from '../review';
import { PROJECT_KEYS } from '../structureRowKeys';
import * as K from '../reviewRowKeys';

/**
 * Image sequences and burn-ins (RP-12, docs/review-pipeline/CONTRACTS.md C-RP-31 to C-RP-33), pinned to the capture
 * made with a real ffmpeg: docs/sync/samples/production/_review_sequence_flow.json.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_sequence_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const uploading = flow.version_uploading.body as Version;
const ready = flow.version_ready.body as Version;
const burnt = flow.version_ready_with_burn_ins.body as Version;

describe('C-RP-31: opening, parts and completion', () => {
  it.each([
    ['ReviewMedia (opened)', flow.open_201.body, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (completed)', flow.complete_202.body, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (ready sequence)', ready.review_media, K.REVIEWMEDIA_KEYS],
    ['ReviewMediaSequence', flow.open_201.body.sequence, K.REVIEWMEDIASEQUENCE_KEYS],
    ['ReviewMediaFramesResult', flow.frames_part1_200.body, K.REVIEWMEDIAFRAMESRESULT_KEYS],
    ['ReviewMediaProbe (sequence)', ready.review_media?.probe, K.REVIEWMEDIAPROBE_KEYS],
    ['Project (with the switch)', flow.project_default.body, PROJECT_KEYS],
    ['Project (switch on)', flow.project_with_burn_ins.body, PROJECT_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('an opened sequence is uploading, shows its range, and is the version’s job (not in the worker yet)', () => {
    expect(flow.open_201.status).toBe(201);
    expect(flow.open_201.body).toMatchObject({ kind: 'sequence', status: 'uploading', source_name: 'rps_sh0010_comp.[1001-1008].exr' });
    expect(flow.open_201.body.sequence).toEqual({ name: 'rps_sh0010_comp', extension: 'exr', first_frame: 1001, last_frame: 1008, frames_received: 0 });
    expect(uploading.review_media_job?.status).toBe('uploading');
    expect(reviewMediaInFlight(uploading.review_media_job)).toBe(false);
  });

  it('each part answers what has arrived and what is missing (numbers)', () => {
    expect(flow.frames_part1_200.body).toEqual({ frames_received: 4, frames_expected: 8, missing_frames: [1005, 1006, 1007, 1008] });
    expect(flow.frames_part2_200.body).toEqual({ frames_received: 8, frames_expected: 8, missing_frames: [] });
  });

  it('refusals: a bad part names each file; a gap on completion lists the missing frames (as strings)', () => {
    expect(flow.frames_bad_400.body.frames).toEqual([
      'rps_sh0010_plate.1006.exr: not a frame of rps_sh0010_comp.[1001-1008].exr.',
      'rps_sh0010_comp.1009.exr: frame 1009 is outside 1001-1008.',
      'rps_sh0010_comp.1001.exr: frame 1001 was already sent.',
    ]);
    expect(flow.frames_not_exr_400.body.frames).toEqual(['rps_sh0010_comp.1005.exr: the content is not EXR.']);
    expect(flow.complete_gap_400.body.detail).toEqual(['4 frames are missing: 1005, 1006, 1007, 1008.']);
    expect(flow.complete_gap_400.body.missing_frames).toEqual(['1005', '1006', '1007', '1008']);
    expect(flow.frames_after_complete_400.body.detail).toEqual(['This upload is not taking frames.']);
  });

  it('refusals on opening: switched off, no right, busy, bad fields, too many frames', () => {
    expect(flow.open_disabled_409.body.error.code).toBe('review_media_disabled');
    expect(flow.open_by_artist_403.status).toBe(403);
    expect(flow.open_busy_409.body.error.code).toBe('review_media_busy');
    expect(keys(flow.open_bad_400.body).filter((k) => k !== 'error')).toEqual(['extension', 'name']);
    expect(flow.open_too_many_400.body.last_frame).toEqual(['A sequence has at most 2000 frames.']);
  });

  it('a cancelled upload leaves the version without a job', () => {
    expect(flow.cancel_204.status).toBe(204);
    expect((flow.version_after_cancel.body as Version).review_media_job).toBeNull();
  });
});

describe('C-RP-32: the processed sequence', () => {
  it('is played like a movie, at the version’s rate; the probe carries the range and the colour rule', () => {
    const media = ready.review_media;
    expect(media?.kind).toBe('sequence');
    // RP-15: the project's colour space (ACEScg) sends EXR frames through the studio's view
    expect(media?.probe).toMatchObject({ first_frame: 1001, last_frame: 1008, frames: 8, colour: 'ocio', burn_ins: false, fps: 24, colour_skipped: null });
    expect(media?.probe?.ocio).toMatchObject({ input: 'ACEScg', display: 'sRGB - Display' });
    const playback = versionPlayback(ready);
    expect(playback.generated).toBe(true);
    expect(playback.src).toMatch(/\/proxy\/\?token=SAMPLE$/);
  });

  it('the version’s empty range was filled from the frames', () => {
    expect([ready.start_frame, ready.end_frame]).toEqual([1001, 1008]);
  });
});

describe('C-RP-33: the burn-in switch', () => {
  it('is off by default, written with the project, and a copy made afterwards says it has them', () => {
    expect(flow.project_default.body.review_burn_ins).toBe(false);
    expect(flow.project_switch_on.body.review_burn_ins).toBe(true);
    expect(flow.project_with_burn_ins.body.review_burn_ins).toBe(true);
    expect(flow.project_switch_bad_400.body.review_burn_ins).toEqual(['Must be a valid boolean.']);
    expect(burnt.review_media?.probe?.burn_ins).toBe(true);
  });
});
