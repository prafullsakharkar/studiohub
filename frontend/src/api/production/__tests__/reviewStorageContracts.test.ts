import { describe, expect, it } from 'vitest';
import type { PublishedFile } from '@/api/publishing/publishing';
import * as P from '@/api/publishing/publishingRowKeys';
import { loadSample } from '@/test/samples';
import type { ReviewCopies, ReviewCopiesRemade, ReviewMedia, Version } from '../review';
import * as K from '../reviewRowKeys';

/**
 * Review copies from studio storage (RP-17, docs/review-pipeline/CONTRACTS.md C-RP-44 to C-RP-46), pinned to the
 * capture made with a real ffmpeg on a temporary storage root: docs/sync/samples/production/_review_storage_copies_flow.json.
 */
type Captured = { status: number; body: unknown };
type Refusal = { detail?: string[]; error?: { code: string } } & Record<string, unknown>;
const flow = loadSample<Record<string, Captured>>('production/_review_storage_copies_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const ids = flow.ids as unknown as Record<string, string>;
const row = (key: string) => flow[key].body as ReviewMedia;
const shown = (key: string) => (flow[key].body as Version).review_media as ReviewMedia;
const file = (key: string) => flow[key].body as PublishedFile;
const refusal = (key: string) => flow[key].body as Refusal;

describe('C-RP-44: a copy from a published file', () => {
  it.each([
    ['ReviewMedia (sequence queued)', row('copy_sequence_202'), K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (movie ready)', shown('version_from_movie'), K.REVIEWMEDIA_KEYS],
    ['PublishedFile', file('file_sequence'), P.PUBLISHEDFILE_KEYS],
    ['PublishedFile (list row)', (flow.files_of_version.body as { results: PublishedFile[] }).results[0], P.PUBLISHEDFILE_KEYS],
    ['ReviewCopies', flow.copies_switch_on.body as ReviewCopies, K.REVIEWCOPIES_KEYS],
    ['ReviewCopyDiffering', (flow.copies_switch_on.body as ReviewCopies).differing[0], K.REVIEWCOPYDIFFERING_KEYS],
    ['ReviewCopiesRemade', flow.remake_all_200.body as ReviewCopiesRemade, K.REVIEWCOPIESREMADE_KEYS],
  ])('%s', (_label, value, expected) => {
    expect(keys(value as object)).toEqual(keys(expected));
  });

  it('is queued on the file’s version, names the file and carries no path or size', () => {
    expect(flow.copy_sequence_202.status).toBe(202);
    const queued = row('copy_sequence_202');
    expect(queued).toMatchObject({ status: 'queued', version_id: ids.first, published_file_id: ids.sequence_file, storage_readable: true, frames_until: null, source_size: 0 });
    expect(queued.source_name).toBe('rpt_sh010_comp_v001.%04d.exr [1001-1002]');
    expect(JSON.stringify(flow)).not.toMatch(/\/studio\/|\/tmp\//);
  });

  it('the file says why a copy cannot be read from it, or null', () => {
    expect(file('file_sequence').review_copy_refusal).toBeNull();
    expect(file('file_sidecar').review_copy_refusal).toBe('A review copy is made from a main or proxy file, not a thumbnail or sidecar.');
    expect(file('file_root_not_read').review_copy_refusal).toBe('The server does not read the storage root ARCHIVE.');
    expect(file('revoke_200').review_copy_refusal).toBe('This file was revoked; a review copy cannot be made from it.');
  });

  it('refusals: the same sentence on detail, 403 without the version’s right, 409 while busy, an unknown field by name', () => {
    expect([flow.copy_sidecar_400.status, refusal('copy_sidecar_400').detail]).toEqual([400, [file('file_sidecar').review_copy_refusal]]);
    expect([flow.copy_root_not_read_400.status, refusal('copy_root_not_read_400').detail]).toEqual([400, ['The server does not read the storage root ARCHIVE.']]);
    expect([flow.copy_revoked_400.status, refusal('copy_revoked_400').detail]).toEqual([400, ['This file was revoked; a review copy cannot be made from it.']]);
    expect(flow.copy_by_artist_403.status).toBe(403);
    expect([flow.copy_busy_409.status, refusal('copy_busy_409').error?.code]).toEqual([409, 'review_media_busy']);
    expect(flow.copy_unknown_field_400.status).toBe(400);
    expect(refusal('copy_unknown_field_400').path).toEqual(['Unknown field.']);
  });
});

describe('C-RP-45: the worker reads the file where it lies', () => {
  it('a sequence and a movie become ready copies; a path leading out of its root fails as storage_unreadable', () => {
    expect(shown('version_from_sequence')).toMatchObject({ status: 'ready', kind: 'sequence', published_file_id: ids.sequence_file, frames_until: null });
    expect(shown('version_from_movie')).toMatchObject({ status: 'ready', kind: 'movie', published_file_id: ids.movie_file });
    const job = (flow.version_escaping_failed.body as Version).review_media_job as ReviewMedia;
    expect(job).toMatchObject({ status: 'failed', error_code: 'storage_unreadable', error_message: 'The published file could not be read from studio storage.' });
  });
});

describe('C-RP-46: remaking and revoking', () => {
  it('copies from storage are remade by reading their files again', () => {
    expect((flow.copies_switch_on.body as ReviewCopies).differing.every((d) => d.remakable && d.published_file_id !== null)).toBe(true);
    expect(flow.remake_all_200.body).toEqual({ queued: 2, skipped_busy: 0, skipped_sequence: 0, skipped_missing: 0, skipped_storage: 0 });
  });

  it('revoking the file keeps the copy, which can no longer be remade, alone or with the project', () => {
    expect(shown('version_after_revoke')).toMatchObject({ status: 'ready', published_file_id: ids.sequence_file, storage_readable: false });
    expect([flow.remake_revoked_400.status, refusal('remake_revoked_400').detail]).toEqual([
      400,
      ['The published file of this copy can no longer be read: it was revoked, or the server no longer reads its storage root.'],
    ]);
    const after = flow.copies_after_revoke.body as ReviewCopies;
    expect(after.differing.map((d) => [d.kind, d.remakable])).toEqual([['sequence', false], ['movie', true]]);
    expect(flow.remake_after_revoke_200.body).toMatchObject({ queued: 1, skipped_storage: 1 });
    expect(flow.keep_200.body).toEqual({ kept: 1 });
    expect((flow.copies_after_keep.body as ReviewCopies).differing).toEqual([]);
  });
});
