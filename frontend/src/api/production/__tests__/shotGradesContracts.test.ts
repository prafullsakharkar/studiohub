import { describe, expect, it } from 'vitest';
import { normalizeApiError } from '@/api/errors/normalizeApiError';
import { loadSample } from '@/test/samples';
import type { ReviewCopies, ReviewCopiesRemade, Version } from '../review';
import * as R from '../reviewRowKeys';
import type { Project } from '../structure';
import { PROJECT_KEYS } from '../structureRowKeys';
import type { GradeImport, Shot } from '../work';
import * as K from '../workRowKeys';

/**
 * Per-shot grades on review copies (RP-20, docs/review-pipeline/CONTRACTS.md C-RP-52 to C-RP-54; RP-22, C-RP-55), pinned to the capture
 * made with a real ffmpeg and the pinned ACES 2.0 config: docs/sync/samples/production/_shot_grades_flow.json.
 */
/** The capture's responses, typed by what each one is. */
type Captured<T> = { status: number; body: T };
type Refusal = Record<string, string[]>;
interface Flow {
  project_default: Captured<Project>;
  project_switch_on_200: Captured<Project>;
  shot_no_grade: Captured<Shot>;
  shot_grade_200: Captured<Shot>;
  shot_typed: Captured<Shot>;
  shot_imported: Captured<Shot>;
  shot_grade_bad_400: Captured<Refusal>;
  import_dry_run_200: Captured<GradeImport>;
  import_apply_200: Captured<GradeImport>;
  import_again_200: Captured<GradeImport>;
  import_doctype_400: Captured<Refusal>;
  import_other_file_400: Captured<Refusal>;
  import_artist_403: Captured<unknown>;
  import_edl_dry_run_200: Captured<GradeImport>;
  import_edl_apply_200: Captured<GradeImport>;
  import_ale_dry_run_200: Captured<GradeImport>;
  import_edl_no_event_400: Captured<Refusal>;
  import_ale_no_grade_column_400: Captured<Refusal>;
  shot_from_edl: Captured<Shot>;
  version_sequence_graded: Captured<Version>;
  version_movie_not_graded: Captured<Version>;
  version_sequence_regraded: Captured<Version>;
  version_sequence_no_grading_space: Captured<Version>;
  copies_matching: Captured<ReviewCopies>;
  copies_other_grade: Captured<ReviewCopies>;
  copies_after_remake: Captured<ReviewCopies>;
  remake_all_200: Captured<ReviewCopiesRemade>;
}
const flow = loadSample<Flow>('production/_shot_grades_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const dryRun = flow.import_dry_run_200.body;
const applied = flow.import_apply_200.body;
const graded = flow.version_sequence_graded.body;
const WARM = { slope: [1.1, 1, 0.9], offset: [0.01, 0, -0.01], power: [1, 1, 1.05], saturation: 0.9 };

describe('C-RP-52: a shot’s grade', () => {
  it.each([
    ['Shot (no grade)', flow.shot_no_grade.body, K.SHOT_KEYS],
    ['Shot (typed)', flow.shot_typed.body, K.SHOT_KEYS],
    ['ShotGrade', flow.shot_typed.body.grade as object, K.SHOTGRADE_KEYS],
    ['Project', flow.project_default.body, PROJECT_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('starts without one; a typed grade has no source and a date', () => {
    expect(flow.shot_no_grade.body).toMatchObject({ grade: null, grade_source: '', grade_updated_at: null });
    // the update answers the written grade; the read shape adds where it came from and when
    expect(flow.shot_grade_200.body.grade).toEqual(flow.shot_typed.body.grade);
    const typed = flow.shot_typed.body;
    expect(typed.grade).toEqual({ slope: [0.95, 1, 1.08], offset: [0, 0, 0.005], power: [1, 1, 1], saturation: 1.1 });
    expect(typed.grade_source).toBe('');
    expect(typed.grade_updated_at).not.toBeNull();
  });

  it('a bad grade is refused on its field, naming the part', () => {
    const error = normalizeApiError(400, flow.shot_grade_bad_400.body);
    expect(error.fieldErrors.grade).toEqual(['slope must be three numbers: red, green and blue.']);
  });

  it('the project’s switch is off by default', () => {
    expect(flow.project_default.body.review_grades).toBe(false);
    expect(flow.project_switch_on_200.body.review_grades).toBe(true);
  });
});

describe('C-RP-54: the import', () => {
  it.each([
    ['GradeImport (dry run)', dryRun, K.GRADEIMPORT_KEYS],
    ['GradeImport (applied)', applied, K.GRADEIMPORT_KEYS],
    ['GradeImportMatch', dryRun.matched[0], K.GRADEIMPORTMATCH_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('a dry run says what would change and writes nothing', () => {
    expect(dryRun).toMatchObject({ dry_run: true, file_name: 'reel1.ccc', corrections: 5, applied: 0 });
    // SH0010 is RPG_SH0010 without the project's code; RPG_SH0020 is the code itself
    expect(dryRun.matched.map((m) => [m.id, m.shot.code, m.old])).toEqual([
      ['SH0010', 'RPG_SH0010', null],
      ['RPG_SH0020', 'RPG_SH0020', null],
    ]);
    expect(dryRun.matched[0].new).toEqual(WARM);
    expect(dryRun.unchanged.map((u) => u.shot.code)).toEqual(['RPG_SH0030']); // typed above with the same values
    expect(dryRun.unmatched).toEqual(['SH9990']);
    expect(dryRun.invalid).toEqual([{ id: 'RPG_SH0040', field: 'saturation', message: 'saturation must be from 0 up to 10.' }]);
  });

  it('applying writes the matched shots, with their source; the same file again changes nothing', () => {
    expect(applied).toMatchObject({ dry_run: false, applied: 2 });
    expect(flow.shot_imported.body).toMatchObject({ grade: WARM, grade_source: 'reel1.ccc (SH0010)' });
    expect(flow.import_again_200.body).toMatchObject({ applied: 0, matched: [] });
    expect(flow.import_again_200.body.unchanged).toHaveLength(3);
  });

  it('refusals: a document type, another kind of file, no shot.update', () => {
    expect(normalizeApiError(400, flow.import_doctype_400.body).fieldErrors.file).toEqual(['The file declares a document type, which CDL files never need.']);
    expect(normalizeApiError(400, flow.import_other_file_400.body).fieldErrors.file).toEqual(['Choose a .cc, .ccc, .cdl, .edl or .ale file.']);
    expect(flow.import_artist_403.status).toBe(403);
  });
});

describe('C-RP-55: grades from an EDL and an ALE (RP-22)', () => {
  const edl = flow.import_edl_dry_run_200.body;
  const ale = flow.import_ale_dry_run_200.body;

  it('the answer has the same keys, with the events or rows without a grade counted', () => {
    for (const answer of [edl, ale, flow.import_edl_apply_200.body]) expect(keys(answer)).toEqual(keys(K.GRADEIMPORT_KEYS));
    expect(edl).toMatchObject({ file_name: 'cut4.edl', corrections: 7, ungraded: 2, applied: 0 });
    expect(ale).toMatchObject({ file_name: 'dailies.ale', corrections: 2, ungraded: 1 });
    expect(dryRun.ungraded).toBe(0); // a CDL file has none
  });

  it('each event’s names are tried in turn: a locator names the shot, a camera clip name matches nothing', () => {
    // event 4 is SH0010 again with the same grade: one correction (Q-RP-103)
    expect(edl.matched.map((m) => [m.id, m.shot.code])).toEqual([['event 2: SH0010', 'RPG_SH0010']]);
    expect(edl.unchanged.map((u) => [u.id, u.shot.code])).toEqual([['event 3: SH0020', 'RPG_SH0020']]);
    expect(edl.unmatched).toEqual(['event 7: SH9990, A004']); // every name tried
    expect(ale.matched.map((m) => m.id)).toEqual(['row 1: SH0010']);
    expect(ale.unmatched).toEqual(['row 3: SH9990, A005C001']);
  });

  it('two names for two shots, and two grades for one shot, are refused, not guessed', () => {
    expect(edl.invalid).toEqual([
      { id: 'event 8: SH0010', field: 'id', message: 'The event names two shots: RPG_SH0010 and RPG_SH0020.' },
      { id: 'event 5: SH0030', field: 'id', message: 'Events 5 and 6 give shot RPG_SH0030 different grades.' },
      { id: 'event 6: SH0030', field: 'id', message: 'Events 5 and 6 give shot RPG_SH0030 different grades.' },
    ]);
  });

  it('applying writes the shot with the event as its source', () => {
    expect(flow.import_edl_apply_200.body).toMatchObject({ dry_run: false, applied: 1 });
    expect(flow.shot_from_edl.body.grade_source).toBe('cut4.edl (event 2: SH0010)');
  });

  it('a file that is not what its name says is refused on file', () => {
    expect(normalizeApiError(400, flow.import_edl_no_event_400.body).fieldErrors.file).toEqual(['The file is not an EDL: it holds no event.']);
    expect(normalizeApiError(400, flow.import_ale_no_grade_column_400.body).fieldErrors.file).toEqual(['The ALE has no ASC_SOP or ASC_SAT column.']);
  });
});

describe('C-RP-53: copies made with the grade', () => {
  it.each([
    ['ReviewMediaProbe (graded)', graded.review_media?.probe, R.REVIEWMEDIAPROBE_KEYS],
    ['ReviewMediaProbe (movie)', flow.version_movie_not_graded.body.review_media?.probe, R.REVIEWMEDIAPROBE_KEYS],
    ['ReviewCopies', flow.copies_other_grade.body, R.REVIEWCOPIES_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('an EXR sequence carries its shot’s grade and where it came from; the transform is the project’s', () => {
    expect(graded.review_media?.probe).toMatchObject({ colour: 'ocio', grade: WARM, grade_source: 'reel1.ccc (SH0010)', grade_skipped: null });
    expect(graded.review_media?.probe?.ocio).toMatchObject({ input: 'ACEScg', look: '' });
  });

  it('a display-ready movie is never graded', () => {
    expect(flow.version_movie_not_graded.body.review_media?.probe).toMatchObject({ ocio: null, grade: null, grade_source: '', grade_skipped: null });
  });

  it('a changed grade is counted with its reason, and the remake applies the new one', () => {
    expect(flow.copies_matching.body).toMatchObject({ review_grades: true, grade_out_of_date: 0, sequences_out_of_date: 0 });
    const other = flow.copies_other_grade.body;
    expect(other).toMatchObject({ grade_out_of_date: 1, sequences_out_of_date: 1, colour_out_of_date: 0 });
    expect(other.differing.map((d) => d.why)).toEqual([['grade']]);
    expect(flow.remake_all_200.body.queued).toBe(1);
    expect(flow.copies_after_remake.body).toMatchObject({ grade_out_of_date: 0, sequences_out_of_date: 0 });
    expect(flow.version_sequence_regraded.body.review_media?.probe).toMatchObject({
      grade: { slope: [1.2, 1, 0.85], offset: [0.02, 0, -0.02], power: [1, 1, 1.1], saturation: 0.85 },
      grade_source: '',
    });
  });

  it('a config without a grading space makes the copy without the grade, saying why', () => {
    expect(flow.version_sequence_no_grading_space.body.review_media?.probe).toMatchObject({ colour: 'ocio', grade: null, grade_skipped: 'no_grading_space' });
  });
});
