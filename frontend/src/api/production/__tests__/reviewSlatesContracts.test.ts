import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { ReviewCopies, Version } from '../review';
import { REVIEWCOPIES_KEYS, REVIEWMEDIAPROBE_KEYS } from '../reviewRowKeys';
import type { Project } from '../structure';
import { PROJECT_KEYS } from '../structureRowKeys';

/**
 * Slates on downloaded copies (RP-25, docs/review-pipeline/CONTRACTS.md C-RP-59 and C-RP-60), pinned to the capture made
 * with a real ffmpeg: docs/sync/samples/production/_review_slates_flow.json.
 */
type Captured<T> = { status: number; body: T };
interface Facts {
  frames: number;
  duration_seconds: number;
  audio: boolean;
  first_frame_brightness: number;
  brightness_at_2s: number | null;
}
interface Files {
  copy: Facts;
  download: Facts;
}
interface Followed {
  status: number;
  headers: Record<string, string>;
  bytes: number;
}
interface Flow {
  project_default: Captured<Project>;
  project_slates_on_200: Captured<Project>;
  project_note_newline_400: Captured<Record<string, string[]>>;
  project_note_tab_400: Captured<Record<string, string[]>>;
  project_note_too_long_400: Captured<Record<string, string[]>>;
  project_note_only_200: Captured<Project>;
  project_slates_off_200: Captured<Project>;
  version_without_slate: Captured<Version>;
  version_remade_with_slate: Captured<Version>;
  version_silent_with_slate: Captured<Version>;
  version_sequence_with_slate: Captured<Version>;
  version_still: Captured<Version>;
  files_without_slate: Files;
  files_remade: Files;
  files_silent: Files;
  files_sequence: Files;
  copies_differing_slate: Captured<ReviewCopies>;
  copies_after_remake: Captured<ReviewCopies>;
  copies_after_note_only: Captured<ReviewCopies>;
  copies_after_off: Captured<ReviewCopies>;
  download_with_slate: Followed;
  play_copy: Followed;
  audit_of_download: Captured<{ results: { changes_diff: Record<string, unknown> }[] }>;
}
const flow = loadSample<Flow>('production/_review_slates_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const probe = (v: Captured<Version>) => {
  const p = v.body.review_media?.probe;
  if (!p) throw new Error(`${v.body.code} has no probe`);
  return p;
};

describe('C-RP-59: the project’s switch and line', () => {
  it('a project has the pinned keys; off and blank by default', () => {
    expect(keys(flow.project_default.body)).toEqual(keys(PROJECT_KEYS));
    expect(flow.project_default.body.review_slates).toBe(false);
    expect(flow.project_default.body.review_slate_note).toBe('');
  });

  it('the line is kept as written, quotes and % included', () => {
    expect(flow.project_slates_on_200.body).toMatchObject({ review_slates: true, review_slate_note: 'Confidential: 100% "internal" -- do not forward' });
  });

  it.each([
    ['project_note_newline_400', 'One line of text, without tabs or line breaks.'],
    ['project_note_tab_400', 'One line of text, without tabs or line breaks.'],
    ['project_note_too_long_400', 'Ensure this field has no more than 120 characters.'],
  ] as const)('%s is refused on its field', (name, message) => {
    expect(flow[name].status).toBe(400);
    expect(flow[name].body.review_slate_note).toEqual([message]);
  });
});

describe('C-RP-59: what a copy says, and what the download holds', () => {
  it('the probe has the pinned keys and says whether the download has a slate', () => {
    expect(keys(probe(flow.version_remade_with_slate))).toEqual(keys(REVIEWMEDIAPROBE_KEYS));
    expect(probe(flow.version_without_slate)).toMatchObject({ slate: false, slate_skipped: null });
    for (const v of [flow.version_remade_with_slate, flow.version_silent_with_slate, flow.version_sequence_with_slate]) {
      expect(probe(v)).toMatchObject({ slate: true, slate_skipped: null });
    }
    expect(probe(flow.version_still)).toMatchObject({ slate: false, slate_skipped: null });
  });

  it.each([
    ['files_remade', 48, true],
    ['files_silent', 48, false],
    ['files_sequence', 12, false],
  ] as const)('%s: the download is two seconds of black card, then the copy, which is unchanged', (name, frames, audio) => {
    const { copy, download } = flow[name];
    expect(copy.frames).toBe(frames);
    expect(download.frames).toBe(frames + 48);
    expect([copy.audio, download.audio]).toEqual([audio, audio]);
    expect(download.first_frame_brightness).toBeLessThan(30);
    expect(copy.first_frame_brightness).toBeGreaterThan(30);
    expect(download.brightness_at_2s).toBe(copy.first_frame_brightness);
  });

  it('without the switch the download is the copy itself', () => {
    expect(flow.files_without_slate.download).toEqual(flow.files_without_slate.copy);
  });

  it('the download saves the slated file under the version’s code; playback streams the copy', () => {
    expect(flow.download_with_slate.headers['Content-Disposition']).toBe('attachment; filename="RSL_SH0010_COMP_V001.mp4"');
    expect(flow.play_copy.headers['Content-Disposition']).toBe('inline; filename="proxy.mp4"');
    expect(flow.download_with_slate.bytes).toBeGreaterThan(flow.play_copy.bytes);
  });

  it('the audit row says the download had a slate', () => {
    expect(flow.audit_of_download.body.results).toHaveLength(1);
    expect(flow.audit_of_download.body.results[0]?.changes_diff).toMatchObject({ operation: 'download', slate: true });
  });
});

describe('C-RP-60: copies that differ in their slate', () => {
  it('the counts have the pinned keys', () => {
    expect(keys(flow.copies_differing_slate.body)).toEqual(keys(REVIEWCOPIES_KEYS));
  });

  it('a copy made before the switch differs, and remaking it adds the slate', () => {
    expect(flow.copies_differing_slate.body).toMatchObject({ review_slates: true, slate_out_of_date: 1, out_of_date: 1, sequences_out_of_date: 0 });
    expect(flow.copies_differing_slate.body.differing.map((row) => row.why)).toEqual([['slate']]);
    expect(flow.copies_after_remake.body).toMatchObject({ slate_out_of_date: 0, out_of_date: 0 });
  });

  it('the line alone never counts; turning the switch off counts the slated movies and the sequence', () => {
    expect(flow.copies_after_note_only.body.slate_out_of_date).toBe(0);
    expect(flow.copies_after_off.body).toMatchObject({ review_slates: false, slate_out_of_date: 3, out_of_date: 2, sequences_out_of_date: 1 });
    expect(flow.copies_after_off.body.differing.every((row) => row.why.join() === 'slate')).toBe(true);
  });
});
