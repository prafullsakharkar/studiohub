import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { ReviewCopies, ReviewCopiesRemade, ReviewMedia, Version } from '../review';
import * as K from '../reviewRowKeys';
import type { Project } from '../structure';
import { PROJECT_KEYS } from '../structureRowKeys';

/**
 * Review copies before approval, read by path from the project's review folder (RP-18, docs/review-pipeline/CONTRACTS.md
 * C-RP-47 to C-RP-49), pinned to the capture made with a real ffmpeg on a temporary storage root:
 * docs/sync/samples/production/_review_folder_flow.json.
 */
type Captured = { status: number; body: unknown };
type Refusal = { detail?: string[]; error?: { code: string } } & Record<string, unknown>;
const flow = loadSample<Record<string, Captured>>('production/_review_folder_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const ids = flow.ids as unknown as Record<string, string>;
const row = (key: string) => flow[key].body as ReviewMedia;
const shown = (key: string) => (flow[key].body as Version).review_media as ReviewMedia;
const job = (key: string) => (flow[key].body as Version).review_media_job as ReviewMedia;
const refusal = (key: string) => flow[key].body as Refusal;
const project = (key: string) => flow[key].body as Project;
const FOLDER_KEYS = ['review_source_folder', 'review_source_root'];
/** The fields a 400 names, without the error envelope every error carries. */
const fieldsOf = (key: string) => Object.keys(refusal(key)).filter((k) => k !== 'error');
/** What the server answered, without the requests (which name the paths sent). */
const answers = () => JSON.stringify(Object.values(flow).map((c) => (c as Captured).body));

describe('C-RP-47: the project’s review folder', () => {
  it('those who may change the project read every key; others do not see the folder', () => {
    // the production-admin role also holds project.view_budget (CR-55); the artist holds neither
    expect(keys(project('project_as_producer'))).toEqual(keys(PROJECT_KEYS));
    expect(keys(project('project_as_artist'))).toEqual(keys(PROJECT_KEYS).filter((k) => k !== 'budget_usd' && !FOLDER_KEYS.includes(k)));
  });

  it('is upper-cased and normalized when set, and cleared by blanks', () => {
    expect(flow.folder_set_200.status).toBe(200);
    expect(project('folder_set_200')).toMatchObject({ review_source_root: 'STUDIO', review_source_folder: 'shows/rpf/renders' });
    expect(project('project_as_producer')).toMatchObject({ review_source_root: 'STUDIO', review_source_folder: 'shows/rpf/renders' });
    expect(project('folder_cleared_200')).toMatchObject({ review_source_root: '', review_source_folder: '' });
  });

  it('refuses a root the server does not read and an unsafe folder, on their fields', () => {
    expect([flow.folder_unlisted_root_400.status, refusal('folder_unlisted_root_400').review_source_root]).toEqual([400, ['The server does not read this storage root.']]);
    expect([flow.folder_unsafe_400.status, fieldsOf('folder_unsafe_400')]).toEqual([400, ['review_source_folder']]);
  });
});

describe('C-RP-48: a copy of a version still in review, read by path', () => {
  it.each([
    ['ReviewMedia (sequence queued)', row('from_storage_sequence_202'), K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (ready)', shown('version_from_path'), K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (list row)', (flow.review_media_list.body as ReviewMedia[])[0], K.REVIEWMEDIA_KEYS],
    ['ReviewCopies', flow.copies_switch_on.body as ReviewCopies, K.REVIEWCOPIES_KEYS],
    ['ReviewCopyDiffering', (flow.copies_switch_on.body as ReviewCopies).differing[0], K.REVIEWCOPYDIFFERING_KEYS],
    ['ReviewCopiesRemade', flow.remake_all_200.body as ReviewCopiesRemade, K.REVIEWCOPIESREMADE_KEYS],
  ])('%s', (_label, value, expected) => {
    expect(keys(value as object)).toEqual(keys(expected));
  });

  it('is queued on the version, says where it is read from, and carries no path', () => {
    expect(flow.from_storage_sequence_202.status).toBe(202);
    expect(row('from_storage_sequence_202')).toMatchObject({ status: 'queued', version_id: ids.first, source: 'storage_path', published_file_id: null, source_size: 0, frames_until: null });
    expect(row('from_storage_sequence_202').source_name).toBe('rpf_sh010_comp_v003.%04d.exr [1001-1002]');
    expect(shown('version_from_path')).toMatchObject({ status: 'ready', source: 'storage_path', storage_readable: true });
    expect((flow.version_from_path.body as Version).status).toBe('Pending Review');
    expect(answers()).not.toMatch(/\/studio\/|\/tmp\/|shows\/other|secret/);
    // the folder is in the project's shape for its editors, never in a review-media answer
    expect(JSON.stringify(flow.version_from_path.body)).not.toMatch(/shows\/rpf|sh010\/comp/);
  });

  it('refusals name their field in one sentence; the version’s other rules hold', () => {
    expect([flow.from_storage_no_folder_400.status, refusal('from_storage_no_folder_400').path]).toEqual([400, ['This project has no review folder on studio storage.']]);
    expect([flow.from_storage_pattern_no_range_400.status, fieldsOf('from_storage_pattern_no_range_400')]).toEqual([400, ['first_frame']]);
    expect([flow.from_storage_range_on_movie_400.status, fieldsOf('from_storage_range_on_movie_400')]).toEqual([400, ['path']]);
    expect([flow.from_storage_leaves_folder_400.status, fieldsOf('from_storage_leaves_folder_400')]).toEqual([400, ['path']]);
    expect([flow.from_storage_not_media_400.status, fieldsOf('from_storage_not_media_400')]).toEqual([400, ['path']]);
    expect([flow.from_storage_unknown_field_400.status, refusal('from_storage_unknown_field_400').storage_root]).toEqual([400, ['Unknown field.']]);
    expect([flow.from_storage_busy_409.status, refusal('from_storage_busy_409').error?.code]).toEqual([409, 'review_media_busy']);
  });

  it('a link that leaves the folder fails with render_unreadable', () => {
    expect(job('version_escaping_failed')).toMatchObject({
      status: 'failed',
      source: 'storage_path',
      error_code: 'render_unreadable',
      error_message: "The render could not be read from the project's review folder on studio storage.",
    });
  });
});

describe('C-RP-49: remaking a path copy', () => {
  it('is listed with its source and remade while the render is in the folder', () => {
    const entry = (flow.copies_switch_on.body as ReviewCopies).differing.find((d) => d.version.id === ids.first);
    expect(entry).toMatchObject({ source: 'storage_path', published_file_id: null, remakable: true });
    expect((flow.remake_all_200.body as ReviewCopiesRemade).skipped_storage).toBe(0);
    expect((flow.remake_all_200.body as ReviewCopiesRemade).queued).toBeGreaterThan(0);
  });

  it('once the folder moves it stays shown but cannot be remade', () => {
    expect(shown('version_after_move')).toMatchObject({ source: 'storage_path', storage_readable: false });
    expect([flow.remake_moved_400.status, refusal('remake_moved_400').detail]).toEqual([
      400,
      ["The render of this copy can no longer be read: it is not in the project's review folder any more, or the server no longer reads its storage root."],
    ]);
    const moved = (flow.copies_after_move.body as ReviewCopies).differing.filter((d) => d.source === 'storage_path');
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.every((d) => !d.remakable)).toBe(true);
    expect((flow.remake_after_move_200.body as ReviewCopiesRemade).skipped_storage).toBe(moved.length);
  });
});
