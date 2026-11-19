import { describe, expect, it } from 'vitest';
import { normalizeApiError } from '@/api/errors/normalizeApiError';
import { loadSample } from '@/test/samples';
import type { Version } from '../review';
import { REVIEWMEDIA_KEYS } from '../reviewRowKeys';
import { REVIEW_DOWNLOADS } from '../structure';
import type { Project } from '../structure';
import { PROJECT_KEYS } from '../structureRowKeys';

/**
 * Downloading a review copy (RP-23, docs/review-pipeline/CONTRACTS.md C-RP-56 and C-RP-57), pinned to the capture made
 * with a real ffmpeg: docs/sync/samples/production/_review_download_flow.json.
 */
type Captured<T> = { status: number; body: T };
interface Followed {
  status: number;
  headers: Record<string, string>;
  bytes: number;
}
interface AuditRow {
  action: string;
  entity_type: string;
  entity_code: string;
  description: string;
  ip_address: string;
  user_name: string;
  changes_diff: Record<string, string>;
}
interface Flow {
  project_default: Captured<Project>;
  project_everyone_200: Captured<Project>;
  project_nobody_200: Captured<Project>;
  project_bad_value_400: Captured<Record<string, string[]>>;
  version_as_studio: Captured<Version>;
  version_as_client: Captured<Version>;
  version_as_client_everyone: Captured<Version>;
  version_as_studio_nobody: Captured<Version>;
  version_still_as_studio: Captured<Version>;
  download_movie: Followed;
  download_still: Followed;
  download_as_client: Followed;
  play_movie: Followed;
  download_with_playback_token_404: Followed;
  download_after_nobody_404: Followed;
  audit_of_download: Captured<{ count: number; results: AuditRow[] }>;
}
const flow = loadSample<Flow>('production/_review_download_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const copyOf = (v: Version) => {
  if (!v.review_media) throw new Error(`${v.code} has no review copy`);
  return v.review_media;
};

describe('C-RP-56: the project’s switch', () => {
  it('a project has the pinned keys, internal by default, and the three choices are the server’s', () => {
    expect(keys(flow.project_default.body)).toEqual(keys(PROJECT_KEYS));
    expect(flow.project_default.body.review_downloads).toBe('internal');
    expect(flow.project_everyone_200.body.review_downloads).toBe('everyone');
    expect(flow.project_nobody_200.body.review_downloads).toBe('nobody');
    expect(REVIEW_DOWNLOADS.map((c) => c.value)).toEqual(['internal', 'everyone', 'nobody']);
    expect(normalizeApiError(400, flow.project_bad_value_400.body).fieldErrors.review_downloads).toEqual(['"clients" is not a valid choice.']);
  });
});

describe('C-RP-56: who is given a download link', () => {
  it('the copy has the pinned keys', () => {
    expect(keys(copyOf(flow.version_as_studio.body))).toEqual(keys(REVIEWMEDIA_KEYS));
  });

  it('a studio member under internal; a client only under everyone; nobody under nobody, while playback stays', () => {
    expect(copyOf(flow.version_as_studio.body).download_url).toMatch(/^\/api\/v1\/review-media\/[^/]+\/download\/\?token=/);
    expect(copyOf(flow.version_as_client.body)).toMatchObject({ download_url: null, proxy_url: expect.stringContaining('/proxy/') });
    expect(copyOf(flow.version_as_client_everyone.body).download_url).toContain('/download/?token=');
    expect(copyOf(flow.version_as_studio_nobody.body)).toMatchObject({ download_url: null, proxy_url: expect.stringContaining('/proxy/') });
  });
});

describe('C-RP-56: the download', () => {
  it('a movie is an attachment named after the version; a still is its JPEG', () => {
    expect(flow.download_movie).toMatchObject({
      status: 200,
      headers: { 'Content-Type': 'video/mp4', 'Content-Disposition': `attachment; filename="${flow.version_as_studio.body.code}.mp4"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
    expect(flow.download_movie.bytes).toBeGreaterThan(0);
    expect(flow.download_still.headers).toMatchObject({ 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${flow.version_still_as_studio.body.code}.jpg"` });
    expect(flow.download_as_client.status).toBe(200);
  });

  it('playback stays inline; a playback token is not a download; a link given before nobody is refused', () => {
    expect(flow.play_movie.status).toBe(206);
    expect(flow.play_movie.headers['Content-Disposition']).toBeUndefined();
    expect(flow.download_with_playback_token_404.status).toBe(404);
    expect(flow.download_after_nobody_404.status).toBe(404);
  });
});

describe('C-RP-57: each download is recorded', () => {
  it('one audit row: who, the version, the file and from where', () => {
    const { count, results } = flow.audit_of_download.body;
    expect(count).toBe(1); // playing the movie is not a download
    expect(results[0]).toMatchObject({
      action: 'export',
      entity_type: 'version',
      entity_code: flow.version_as_studio.body.code,
      description: `Downloaded the review copy ${flow.version_as_studio.body.code}.mp4.`,
      ip_address: '10.20.30.40',
      user_name: 'Supervisor Example',
    });
    expect(results[0].changes_diff).toMatchObject({ operation: 'download', kind: 'movie', file_name: `${flow.version_as_studio.body.code}.mp4` });
  });
});
