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
 * Per-shot grades on review copies (RP-20, docs/review-pipeline/CONTRACTS.md C-RP-52 to C-RP-54), pinned to the capture
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
    expect(normalizeApiError(400, flow.import_other_file_400.body).fieldErrors.file).toEqual(['Choose a .cc, .ccc or .cdl file.']);
    expect(flow.import_artist_403.status).toBe(403);
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
