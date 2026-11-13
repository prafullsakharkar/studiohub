import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { REVIEW_MEDIA_POLL_MS, reviewMediaInFlight, reviewMediaRefetchInterval, reviewMediaUrl, versionPlayback, versionThumbnail } from '../review';
import type { Version } from '../review';
import * as K from '../reviewRowKeys';

/**
 * Review media (RP-5, docs/review-pipeline/CONTRACTS.md C-RP-19 to C-RP-22), pinned to the capture made with a real
 * ffmpeg: docs/sync/samples/production/_review_media_flow.json. Its signed tokens are replaced with `SAMPLE`.
 */
type Captured = { status: number; body: any; headers?: Record<string, string> };
const flow = loadSample<Record<string, Captured>>('production/_review_media_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const ready = flow.version_ready.body as Version;
const still = flow.version_with_still.body as Version;
const failed = flow.version_with_failed_job.body as Version;
const queued = flow.version_with_queued_job.body as Version;
const none = flow.version_without_media.body as Version;

describe('the version and review media shapes', () => {
  it.each([
    ['Version (detail)', ready, K.VERSION_KEYS],
    ['Version (list row)', flow.versions_list.body.results[0], K.VERSION_KEYS],
    ['ReviewMedia (ready)', ready.review_media, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (failed job)', failed.review_media_job, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (upload answer)', flow.upload_movie_202.body, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (retry answer)', flow.retry_202.body, K.REVIEWMEDIA_KEYS],
    ['ReviewMedia (list row)', flow.review_media_list.body[0], K.REVIEWMEDIA_KEYS],
    ['ReviewMediaProbe', ready.review_media?.probe, K.REVIEWMEDIAPROBE_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('a version without an upload has two nulls; a queued upload is the job, not the movie', () => {
    expect(none.review_media).toBeNull();
    expect(none.review_media_job).toBeNull();
    expect(queued.review_media).toBeNull();
    expect(queued.review_media_job?.status).toBe('queued');
    expect(reviewMediaInFlight(queued.review_media_job)).toBe(true);
  });

  it('only a ready row has links, and they are relative, signed and expire', () => {
    const media = ready.review_media;
    expect(media?.status).toBe('ready');
    for (const link of [media?.proxy_url, media?.thumbnail_url, media?.filmstrip_url]) expect(link).toMatch(new RegExp(`^/api/v1/review-media/${media?.id}/(proxy|thumbnail|filmstrip)/\\?token=SAMPLE$`));
    expect(media?.links_expire_at).toBeTruthy();
    expect(media?.filmstrip_tiles).toBe(48);
    for (const row of [flow.upload_movie_202.body, failed.review_media_job]) {
      expect([row.proxy_url, row.thumbnail_url, row.filmstrip_url, row.links_expire_at]).toEqual([null, null, null, null]);
    }
    // A still has a proxy and a thumbnail and no filmstrip.
    expect(still.review_media?.kind).toBe('still');
    expect(still.review_media?.filmstrip_url).toBeNull();
  });

  it('a failure carries a fixed message of the server, never ffmpeg output', () => {
    const job = failed.review_media_job;
    expect(job?.status).toBe('failed');
    expect(job?.error_code).toBe('probe_failed');
    expect(job?.error_message).toBe('The file could not be read.');
    // The movie that was ready before keeps playing: a failure supersedes nothing.
    expect(failed.review_media?.status).toBe('ready');
    expect(failed.review_media?.id).toBe((flow.ids as unknown as { movie: string }).movie);
  });

  it('the list of a version is a bare array, newest first', () => {
    const rows = flow.review_media_list.body as Array<{ queued_at: string }>;
    expect(Array.isArray(rows)).toBe(true);
    expect([...rows].sort((a, b) => b.queued_at.localeCompare(a.queued_at))).toEqual(rows);
  });

  it('refusals: switched off and busy are 409 with a code, a refused file is a 400 on `file`, the artist is 403', () => {
    expect(flow.upload_disabled_409.status).toBe(409);
    expect(flow.upload_disabled_409.body.error.code).toBe('review_media_disabled');
    expect(flow.upload_busy_409.status).toBe(409);
    expect(flow.upload_busy_409.body.error.code).toBe('review_media_busy');
    expect(flow.upload_exr_400.body.file[0]).toMatch(/^Upload a movie or a still: /);
    expect(flow.upload_mismatch_400.body.file).toEqual(["The file's content does not match its extension."]);
    for (const key of ['upload_by_artist_403', 'retry_by_artist_403', 'remove_by_artist_403']) expect(flow[key].status).toBe(403);
    expect(flow.retry_not_failed_400.body.detail).toEqual(['Only a failed upload can be retried.']);
    expect(flow.remove_again_400.body.detail).toEqual(['Only a ready movie or still can be removed.']);
    expect(flow.remove_204.status).toBe(204);
  });

  it('the stream answers the file with fixed headers, ranges, and a 404 for a bad token', () => {
    expect(flow.stream_proxy.status).toBe(200);
    expect(flow.stream_proxy.headers).toMatchObject({ 'Content-Type': 'video/mp4', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes' });
    expect(flow.stream_proxy_range.status).toBe(206);
    expect(flow.stream_proxy_range.headers?.['Content-Range']).toMatch(/^bytes 0-99\/\d+$/);
    expect(flow.stream_thumbnail.headers?.['Content-Type']).toBe('image/jpeg');
    expect(flow.stream_bad_token_404.status).toBe(404);
  });
});

describe('what the players show', () => {
  it('a ready movie: the proxy, its thumbnail as poster, the probe frame rate; links made absolute', () => {
    const shown = versionPlayback(ready);
    expect(shown.generated).toBe(true);
    expect(shown.src).toBe(`http://api.test${ready.review_media?.proxy_url}`);
    expect(shown.poster).toBe(`http://api.test${ready.review_media?.thumbnail_url}`);
    expect(shown.fps).toBe(ready.review_media?.probe?.fps);
  });

  it('a ready still: no video, the proxy is the picture', () => {
    const shown = versionPlayback(still);
    expect(shown.src).toBeUndefined();
    expect(shown.poster).toBe(`http://api.test${still.review_media?.proxy_url}`);
  });

  it('no review copy: the version’s own links', () => {
    const own = { ...none, video_url: 'https://cdn.example.com/a.mp4', thumbnail_url: 'https://cdn.example.com/a.jpg' };
    expect(versionPlayback(own)).toEqual({ src: own.video_url, poster: own.thumbnail_url, fps: own.fps, generated: false });
    expect(versionPlayback({ ...failed, review_media: null }).generated).toBe(false);
  });

  it('a card keeps the version’s own thumbnail and falls back to the generated one', () => {
    expect(versionThumbnail({ ...ready, thumbnail_url: 'https://cdn.example.com/own.jpg' })).toBe('https://cdn.example.com/own.jpg');
    expect(versionThumbnail({ ...ready, thumbnail_url: '' })).toBe(`http://api.test${ready.review_media?.thumbnail_url}`);
    expect(versionThumbnail({ ...none, thumbnail_url: '' })).toBeUndefined();
  });

  it('only http(s) links are made', () => {
    expect(reviewMediaUrl('javascript:alert(1)')).toBeUndefined();
    expect(reviewMediaUrl('')).toBeUndefined();
    expect(reviewMediaUrl(null)).toBeUndefined();
  });
});

describe('refetching', () => {
  const expiry = Date.parse(ready.review_media?.links_expire_at ?? '');

  it('every 5 seconds while a job is queued or processing', () => {
    expect(reviewMediaRefetchInterval([queued])).toBe(REVIEW_MEDIA_POLL_MS);
    expect(reviewMediaRefetchInterval([ready, queued])).toBe(REVIEW_MEDIA_POLL_MS);
  });

  it('a minute before the first link expires, otherwise never', () => {
    expect(reviewMediaRefetchInterval([ready], expiry - 10 * 60_000)).toBe(9 * 60_000);
    expect(reviewMediaRefetchInterval([ready], expiry)).toBe(REVIEW_MEDIA_POLL_MS);
    expect(reviewMediaRefetchInterval([none, { ...failed, review_media: null }, undefined])).toBe(false);
  });
});
