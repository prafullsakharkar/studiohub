import { apiClient } from '@/api/client/ApiClient';
import { getApiBaseUrl } from '@/api/client/config';
import { resourceApi } from '@/api/masterdata/resource';
import { createQueryKeys } from '@/shared/data/queryKeys';
import { listFetcher } from '@/shared/data/listing';
import type { StatusHistoryRow } from './work';

/**
 * Production review: versions, reviews, playlists, media, workflows and automation rules. Row types are pinned
 * to docs/sync/samples/production/_review_flow.json (see backend-change-requests.md, "Phase 7 notes").
 *
 * Rules the capture established:
 *  - a version carries no lists of what holds it (RP-1, C-RP-01): the reviews and playlists of a version are read
 *    with `version_id` on their own lists (C-RP-03, C-RP-04);
 *  - a comment, reply or annotation names the version of the review it is on, or null for the whole review
 *    (C-RP-05, C-RP-06); a reply is on its thread's version;
 *  - versions are filtered by `entity_type` + `entity_id` (`shot_id`, `task_id`, `asset_id`, `artist`, `is_hero` are ignored);
 *  - approving what you produced is 403 `separation_of_duties` on every path (D-04);
 *  - `simulate` on a workflow is a stub and nothing executes automation rules (§ Phase 7 notes).
 */
const V1 = '/api/v1';

export const REVIEW_STATUSES = ['Pending Review', 'Submitted', 'In Review', 'Approved', 'Rejected', 'Changes Requested', 'Retake', 'Closed'] as const;

// ---------------------------------------------------------------------------------------------- versions

export interface Version {
  id: string;
  uuid: string;
  code: string;
  /** Numbered by the server (`v001`…); a number sent on create is ignored. */
  version_number: string;
  version_index: number;
  status: string;
  department: string;
  notes: string;
  changelog: string;
  tags: string[];
  is_published: boolean;
  is_hero: boolean;
  is_archived: boolean;
  published_at: string | null;
  published_by_id: string | null;
  publishing_info: Record<string, unknown>;
  artist_id: string | null;
  artist_name: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  shot_id: string | null;
  asset_id: string | null;
  task_id: string | null;
  frame_range: string;
  start_frame: number | null;
  end_frame: number | null;
  resolution: string;
  fps: string;
  color_space: string;
  file_path: string;
  file_size_mb: string;
  source_file_url: string;
  video_url: string;
  thumbnail_url: string;
  project_id: string;
  project_code: string;
  /** The movie or still the server made from an upload (RP-5, C-RP-21): the `ready` row, or null. */
  review_media: ReviewMedia | null;
  /** The newest upload that is not ready: uploading (a sequence still arriving), queued, processing or failed (with its message), or null. */
  review_media_job: ReviewMedia | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------------------ review media

/** What ffprobe read from the upload. A still reports 1 frame at 1 fps. */
export interface ReviewMediaProbe {
  width: number;
  height: number;
  fps: number;
  frames: number;
  duration_seconds: number;
  video_codec: string;
  has_audio: boolean;
  /** A sequence's own frame range; null for a movie or still (RP-12, C-RP-32). */
  first_frame: number | null;
  last_frame: number | null;
  /**
   * How the picture was shown: through the studio's OpenColorIO view (`ocio`, RP-15, C-RP-40, with `ocio` saying how),
   * an EXR turned from linear light to sRGB (RP-12's rule, `srgb_from_linear`), or as stored.
   */
  colour: 'ocio' | 'srgb_from_linear' | 'as_stored';
  /** Whether the copy carries the project's burn-ins (C-RP-33). */
  burn_ins: boolean;
  /** The colour transform the copy was made with (RP-15), or null when nothing was transformed. */
  ocio: ReviewMediaColour | null;
  /** Why a transform that was due was left out: the copy was then made by RP-12's rule. Null otherwise. */
  colour_skipped: 'unknown_colour_space' | 'colour_config_unavailable' | null;
}

/** How a copy's colour was made (C-RP-40): names from the studio's OpenColorIO config, never a server path. */
export interface ReviewMediaColour {
  config: string;
  input: string;
  display: string;
  view: string;
  /** Blank when no look was applied. */
  look: string;
}

export type ReviewMediaStatus = 'uploading' | 'queued' | 'processing' | 'ready' | 'failed' | 'superseded' | 'removed';

/** An image sequence as it was opened, and how many of its frames have arrived (RP-12, C-RP-31). */
export interface ReviewMediaSequence {
  name: string;
  extension: string;
  first_frame: number;
  last_frame: number;
  frames_received: number;
}

/** The answer to one part of a sequence's frames (C-RP-31). */
export interface ReviewMediaFramesResult {
  frames_received: number;
  frames_expected: number;
  /** The first 50 frame numbers still missing. */
  missing_frames: number[];
}

/**
 * A movie or still uploaded to a version and what the media worker made from it (C-RP-19 to C-RP-22), pinned to
 * docs/sync/samples/production/_review_media_flow.json. The links are signed for the caller and work without the
 * API token (`<video src>`); they are relative and stop working at `links_expire_at`; they are null until `ready`.
 * A failure carries a fixed `error_message` of the server's, never ffmpeg's output.
 */
export interface ReviewMedia {
  id: string;
  version_id: string;
  kind: 'movie' | 'still' | 'sequence';
  status: ReviewMediaStatus;
  source_name: string;
  source_size: number;
  probe: ReviewMediaProbe | null;
  /** Set for a sequence, null otherwise. */
  sequence: ReviewMediaSequence | null;
  proxy_url: string | null;
  thumbnail_url: string | null;
  filmstrip_url: string | null;
  filmstrip_tiles: number;
  links_expire_at: string | null;
  error_code: string;
  error_message: string;
  attempts: number;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_by: { id: string; name: string } | null;
  /** The copy this row remakes (RP-14, C-RP-37), or null: a remake keeps that copy shown until it is ready. */
  remake_of: string | null;
  /** The colour space the upload named (RP-15, C-RP-40), in the config's spelling; blank when it named none. */
  color_space: string;
}

/**
 * A project's review copies against its burn-in switch (RP-14, C-RP-38), pinned to
 * docs/sync/samples/production/_review_remake_flow.json. `out_of_date` counts the movies that can be remade; a sequence's
 * frames are gone once its copy is ready, so `sequences_out_of_date` can only be fixed by uploading the frames again.
 */
export interface ReviewCopies {
  review_burn_ins: boolean;
  out_of_date: number;
  sequences_out_of_date: number;
  /** How many of them (sequences included) were made with other colour settings than the project has now (RP-15). */
  colour_out_of_date: number;
}

/**
 * What the studio's OpenColorIO config offers a project (RP-15, C-RP-39), pinned to
 * docs/sync/samples/production/_review_colour_flow.json. `available` is false (and everything empty) when the server
 * cannot read the config; colour settings cannot be changed then.
 */
export interface ReviewColourOptions {
  available: boolean;
  config: string | null;
  /** The sRGB display copies are made for (the browser shows sRGB). */
  display: string | null;
  /** What a blank `review_view` means. */
  default_view: string | null;
  views: string[];
  looks: string[];
  color_spaces: ReviewColourSpace[];
}

/** A scene-referred colour space of the config; any alias names it too (the server stores the name). */
export interface ReviewColourSpace {
  name: string;
  family: string;
  encoding: string;
  aliases: string[];
}

/** What `POST projects/{id}/review-copies/remake/` did (C-RP-38). */
export interface ReviewCopiesRemade {
  queued: number;
  skipped_busy: number;
  skipped_sequence: number;
  skipped_missing: number;
}

/** A job the worker has not finished: the version is refetched while one exists. */
export const reviewMediaInFlight = (row: ReviewMedia | null | undefined): boolean => row?.status === 'queued' || row?.status === 'processing';

/** How often a version query is refetched while the worker runs a job of one of the versions. */
export const REVIEW_MEDIA_POLL_MS = 5000;
/** Links are fetched again this long before they expire, so a player never asks with a dead token. */
const LINK_REFRESH_MARGIN_MS = 60_000;

/**
 * The `refetchInterval` of a query holding these versions: every 5 seconds while a job is queued or processing,
 * else shortly before the first signed link expires, else never.
 */
export function reviewMediaRefetchInterval(versions: ReadonlyArray<Pick<Version, 'review_media' | 'review_media_job'> | null | undefined>, now: number = Date.now()): number | false {
  const rows = versions.filter((v): v is Pick<Version, 'review_media' | 'review_media_job'> => Boolean(v));
  if (rows.some((v) => reviewMediaInFlight(v.review_media_job))) return REVIEW_MEDIA_POLL_MS;
  const expiries = rows.map((v) => Date.parse(v.review_media?.links_expire_at ?? '')).filter((t) => Number.isFinite(t));
  if (expiries.length === 0) return false;
  return Math.max(REVIEW_MEDIA_POLL_MS, Math.min(...expiries) - LINK_REFRESH_MARGIN_MS - now);
}

/** The server's relative link made absolute against the API's origin (the players only take http(s) addresses). */
export function reviewMediaUrl(link: string | null | undefined): string | undefined {
  if (!link) return undefined;
  const base = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
  try {
    const url = new URL(link, `${base}/`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export interface VersionPlayback {
  src?: string | null;
  poster?: string | null;
  /** The probe's rate when the server made the movie; otherwise the version's own `fps`. */
  fps: number | string | null;
  /** True when the picture is the server's review copy. */
  generated: boolean;
  /** The review copy's id: a player keyed on it keeps its place when only the signed link is renewed (RP-10). */
  sourceId?: string;
}

/**
 * What a player shows for a version: the server's review copy when there is one (a movie: the proxy with its
 * thumbnail as poster; a still: the proxy as the picture), else the version's own `video_url` and `thumbnail_url`.
 */
export function versionPlayback(version: Pick<Version, 'review_media' | 'video_url' | 'thumbnail_url' | 'fps'> | null | undefined): VersionPlayback {
  const media = version?.review_media;
  if (media && media.status === 'ready') {
    if (media.kind === 'still') return { src: undefined, poster: reviewMediaUrl(media.proxy_url), fps: version?.fps ?? null, generated: true, sourceId: media.id };
    return { src: reviewMediaUrl(media.proxy_url), poster: reviewMediaUrl(media.thumbnail_url), fps: media.probe?.fps ?? version?.fps ?? null, generated: true, sourceId: media.id };
  }
  return { src: version?.video_url, poster: version?.thumbnail_url, fps: version?.fps ?? null, generated: false };
}

/** A card's picture: the version's own thumbnail, else the generated one. */
export function versionThumbnail(version: Pick<Version, 'review_media' | 'thumbnail_url'>): string | undefined {
  const own = (version.thumbnail_url ?? '').trim();
  if (own) return own;
  return reviewMediaUrl(version.review_media?.thumbnail_url);
}

/** A generous ceiling for one upload (the client's default is 30 seconds; a 2 GB movie takes minutes). */
const UPLOAD_TIMEOUT_MS = 60 * 60 * 1000;

export const reviewMediaApi = {
  /** Every row of a version, newest first (a bare array). */
  list: (versionId: string, signal?: AbortSignal) => apiClient.get<ReviewMedia[]>(`${V1}/versions/${versionId}/review-media/`, { signal }),
  /**
   * Needs `version.update`, or being the version's artist with `version.create` (C-RP-26). 202 with the queued row; 409 `review_media_disabled` when the studio has not switched it on,
   * 409 `review_media_busy` while another upload of the version is processed, 400 on `file` for a refused file.
   * `colorSpace` (RP-15, C-RP-40) names the movie's or still's colour space when it is not display-ready; 400 on
   * `color_space` when the studio's config does not know it.
   */
  upload: (versionId: string, file: File, colorSpace = '') => {
    const form = new FormData();
    form.append('file', file);
    if (colorSpace) form.append('color_space', colorSpace);
    return apiClient.upload<ReviewMedia>(`${V1}/versions/${versionId}/review-media/`, form, { timeout: UPLOAD_TIMEOUT_MS });
  },
  /** A failed row, at most three attempts in all (400 after that, or when it is not failed). */
  retry: (id: string) => apiClient.post<ReviewMedia>(`${V1}/review-media/${id}/retry/`, {}),
  /** A ready row, or a sequence still arriving (cancelled); 400 otherwise. Its files are deleted. 204. */
  remove: (id: string) => apiClient.delete<void>(`${V1}/review-media/${id}/`),
  /**
   * Open an image sequence upload (RP-12, C-RP-31): the same rights and 409s as `upload`; 400 on a field (the name,
   * the extension, the range, more frames than the studio allows; `color_space`, RP-15, one the config does not know).
   * 201 with the row, `status: 'uploading'`. Without `color_space` an EXR takes the project's, other frames none.
   */
  openSequence: (versionId: string, body: { name: string; extension: string; first_frame: number; last_frame: number; color_space?: string }) =>
    apiClient.post<ReviewMedia>(`${V1}/versions/${versionId}/review-media/sequence/`, body),
  /** One part of the frames, at most 50 files; a bad frame refuses the whole part (400 on `frames`). */
  sendFrames: (id: string, files: readonly File[]) => {
    const form = new FormData();
    for (const file of files) form.append('frames', file);
    return apiClient.upload<ReviewMediaFramesResult>(`${V1}/review-media/${id}/frames/`, form, { timeout: UPLOAD_TIMEOUT_MS });
  },
  /** Queue the sequence once every frame is in (202); 400 naming the missing frames otherwise. */
  complete: (id: string) => apiClient.post<ReviewMedia>(`${V1}/review-media/${id}/complete/`, {}),
  /**
   * Remake a ready movie or still from its kept upload (RP-14, C-RP-37): the rights of `upload`; 202 with a new queued
   * row (`remake_of` set) while the copy stays shown; 400 for a sequence, a row that is not ready or an upload that is
   * gone (the reason in `detail`); 409 `review_media_busy` / `review_media_disabled`.
   */
  remake: (id: string) => apiClient.post<ReviewMedia>(`${V1}/review-media/${id}/remake/`, {}),
  /** What the studio's colour config offers (RP-15, C-RP-39): `project.view`. */
  colourOptions: (signal?: AbortSignal) => apiClient.get<ReviewColourOptions>(`${V1}/review-media/colour/`, { signal }),
  colourOptionsKey: ['production', 'review-colour'] as const,
};

/** A project's review copies against its burn-in switch (RP-14, C-RP-38). */
export const reviewCopiesApi = {
  keys: { all: ['production', 'review-copies'] as const, of: (projectId: string) => ['production', 'review-copies', projectId] as const },
  /** `project.view` with full internal access (404 otherwise). */
  get: (projectId: string, signal?: AbortSignal) => apiClient.get<ReviewCopies>(`${V1}/projects/${projectId}/review-copies/`, { signal }),
  /** `project.update`: remakes every movie that differs, each on its own; 200 with what it did. */
  remake: (projectId: string) => apiClient.post<ReviewCopiesRemade>(`${V1}/projects/${projectId}/review-copies/remake/`, {}),
};

export interface VersionInput {
  project: string;
  /** About a shot or an asset, not both (400). A task alone takes the task's shot or asset. */
  shot?: string | null;
  asset?: string | null;
  task?: string | null;
  code?: string;
  department?: string;
  artist?: string | null;
  notes?: string;
  changelog?: string;
  tags?: string[];
  resolution?: string;
  fps?: string | number;
  start_frame?: number | null;
  end_frame?: number | null;
  color_space?: string;
  file_path?: string;
  source_file_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  status?: string;
}

export const versionsApi = {
  ...resourceApi<Version, VersionInput>('versions', `${V1}/versions/`),
  /** Versions have no bulk routes. Archiving a published version is a 400: unpublish first. */
  archive: (id: string) => apiClient.post<Version>(`${V1}/versions/${id}/archive/`, {}),
  restoreOne: (id: string) => apiClient.post<Version>(`${V1}/versions/${id}/restore/`, {}),
  archived: listFetcher<Version>(`${V1}/versions/archived/`),
  /** Needs an approved version (400 otherwise) and `version.publish`. The body is merged into `publishing_info`. */
  publish: (id: string, publishingInfo: Record<string, unknown> = {}) => apiClient.post<Version>(`${V1}/versions/${id}/publish/`, publishingInfo),
  unpublish: (id: string) => apiClient.post<Version>(`${V1}/versions/${id}/unpublish/`, {}),
  /** Makes it the hero of its shot or asset (demoting the previous one) and approves it, so separation of duties applies. */
  promote: (id: string, overrideReason?: string) => apiClient.post<Version>(`${V1}/versions/${id}/promote/`, overrideReason ? { override_reason: overrideReason } : {}),
  /** An existing playlist (`playlist_id`) or a new one (`playlist_name`); answers the version. */
  addToPlaylist: (id: string, target: { playlist_id?: string; playlist_name?: string }) => apiClient.post<Version>(`${V1}/versions/${id}/add-to-playlist/`, target),
  statusHistory: (id: string, signal?: AbortSignal) => apiClient.get<StatusHistoryRow[]>(`${V1}/versions/${id}/status-history/`, { signal }),
};

// ----------------------------------------------------------------------------------------------- reviews

export interface ReviewVersion {
  /** The version's id; `item_id` is the row that puts it on this review. */
  id: string;
  item_id: string;
  code: string;
  version_number: string;
  status: string;
  order: number;
}
export interface ReviewParticipant {
  id: string;
  legacy_id: string;
  /** Null for a person who only has a name (converted old data). */
  user_id: string | null;
  name: string;
  role: string;
  verdict: string;
  verdict_date: string | null;
  verdict_notes: string;
}
/** A reply: a comment without `replies` (a reply to a reply is a 400, so replies never nest). */
export interface ReviewReply {
  id: string;
  author: string;
  author_id: string | null;
  text: string;
  frame_number: number | null;
  timecode: string | null;
  tags: string[];
  is_client_visible: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by_id: string | null;
  parent_id: string | null;
  /** The version of the review it is on; null for the whole review. A reply has its thread's. */
  version_id: string | null;
  created_at: string;
}
export interface ReviewComment extends ReviewReply {
  replies: ReviewReply[];
}
export interface ReviewNote {
  id: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  category: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}
export interface ReviewAnnotation {
  id: string;
  author_id: string | null;
  author_name: string;
  comment: string;
  frame_number: number | null;
  timecode: string | null;
  drawing_coordinates: Record<string, unknown> | null;
  /** The version of the review it is on; null for the whole review. */
  version_id: string | null;
  created_at: string;
}
export interface ReviewActivity {
  id: string;
  action: string;
  user: string;
  notes: string;
  timestamp: string;
}
export interface Review {
  id: string;
  uuid: string;
  code: string;
  title: string;
  description: string;
  status: string;
  supervisor_verdict: string;
  lead_reviewer_name: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  thumbnail_url: string;
  video_url: string;
  client: Record<string, unknown>;
  vendor: Record<string, unknown>;
  versions: ReviewVersion[];
  /** The review's participants. */
  reviewers: ReviewParticipant[];
  comments: ReviewComment[];
  notes: ReviewNote[];
  annotations: ReviewAnnotation[];
  activity: ReviewActivity[];
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface ReviewInput {
  project: string;
  title: string;
  code: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  thumbnail_url?: string;
  video_url?: string;
}

const reviewBase = `${V1}/reviews/`;
const reviewPost = (id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<Review>(`${reviewBase}${id}/${action}/`, body);

export const reviewsApi = {
  ...resourceApi<Review, ReviewInput>('reviews', reviewBase),
  archived: listFetcher<Review>(`${reviewBase}archived/`),
  /** Needs `review.delete` (CR-15), like DELETE. */
  archive: (id: string) => reviewPost(id, 'archive'),
  restoreOne: (id: string) => reviewPost(id, 'restore'),
  // status machine (see statusFlow.ts); the decisions need `review.approve`, the rest `review.update`
  submit: (id: string) => reviewPost(id, 'submit'),
  startReview: (id: string) => reviewPost(id, 'start-review'),
  approve: (id: string, notes?: string) => reviewPost(id, 'approve', notes ? { notes } : {}),
  reject: (id: string, notes?: string) => reviewPost(id, 'reject', notes ? { notes } : {}),
  requestChanges: (id: string, notes?: string) => reviewPost(id, 'request-changes', notes ? { notes } : {}),
  /** A decision by name, e.g. `Retake`; the same transition table applies. */
  verdict: (id: string, verdict: string, notes?: string) => reviewPost(id, 'verdict', { verdict, ...(notes ? { notes } : {}) }),
  close: (id: string) => reviewPost(id, 'close'),
  statusHistory: (id: string, signal?: AbortSignal) => apiClient.get<StatusHistoryRow[]>(`${reviewBase}${id}/status-history/`, { signal }),
  // the parts: adding a version or participant and resolving or reopening a comment answer the whole review;
  // adding a comment, note or annotation answers the new part
  addVersion: (id: string, versionId: string) => reviewPost(id, 'versions', { version_id: versionId }),
  removeVersion: (id: string, versionId: string) => apiClient.delete<Review>(`${reviewBase}${id}/versions/${versionId}/`),
  /** The user must be an active member of the project; a user once per review. */
  addParticipant: (id: string, input: { user_id: string; role?: string }) => reviewPost(id, 'participants', input),
  removeParticipant: (id: string, participantId: string) => apiClient.delete<Review>(`${reviewBase}${id}/participants/${participantId}/`),
  /** Accepted only from the participant's own account; an approving verdict is subject to separation of duties. */
  participantVerdict: (id: string, input: { participant_id: string; verdict: string; notes?: string }) => reviewPost(id, 'participant-verdict', input),
  /** `version_id` must be a version on this review (400 otherwise); a reply takes its thread's, and naming another is a 400. */
  addComment: (id: string, input: { text: string; frame_number?: number | null; timecode?: string | null; tags?: string[]; is_client_visible?: boolean; parent_id?: string | null; version_id?: string | null }) => apiClient.post<ReviewComment>(`${reviewBase}${id}/comments/`, input),
  resolveComment: (id: string, commentId: string) => apiClient.post<Review>(`${reviewBase}${id}/comments/${commentId}/resolve/`, {}),
  reopenComment: (id: string, commentId: string) => apiClient.post<Review>(`${reviewBase}${id}/comments/${commentId}/reopen/`, {}),
  addNote: (id: string, input: { content: string; category?: string; is_pinned?: boolean }) => apiClient.post<ReviewNote>(`${reviewBase}${id}/notes/`, input),
  /** `version_id` must be a version on this review (400 otherwise). */
  addAnnotation: (id: string, input: { comment?: string; frame_number?: number | null; timecode?: string | null; drawing_coordinates?: Record<string, unknown> | null; version_id?: string | null }) => apiClient.post<ReviewAnnotation>(`${reviewBase}${id}/annotations/`, input),
};

// ----------------------------------------------------------------------------------------------- playlists

export interface PlaylistEntry {
  id: string;
  /** Null for a placeholder entry (an empty `add-entry`). */
  version_id: string | null;
  version_number?: string;
  item_order: number;
  legacy_id: string;
}
export interface PlaylistShareSettings {
  is_public?: boolean;
  allow_client_approval?: boolean;
  require_passcode?: boolean;
  client_id?: string;
  expires_at?: string | null;
}
export interface Playlist {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  status: string;
  client_only: boolean;
  is_archived: boolean;
  entries: PlaylistEntry[];
  share_settings: PlaylistShareSettings;
  activity: unknown[];
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface PlaylistInput {
  project: string;
  name: string;
  code: string;
  description?: string;
  client_only?: boolean;
  /** Entries are set on create only; afterwards use add-entry, remove-entry and reorder (400 otherwise). */
  entries?: Array<{ version_id: string }>;
  share_settings?: PlaylistShareSettings;
}

const playlistBase = `${V1}/playlists/`;
export const playlistsApi = {
  ...resourceApi<Playlist, PlaylistInput>('playlists', playlistBase),
  archive: (id: string) => apiClient.post<Playlist>(`${playlistBase}${id}/archive/`, {}),
  restoreOne: (id: string) => apiClient.post<Playlist>(`${playlistBase}${id}/restore/`, {}),
  archived: listFetcher<Playlist>(`${playlistBase}archived/`),
  /** A version of the playlist's project, or none (a placeholder entry). The same version may be added twice. */
  addEntry: (id: string, input: { version_id?: string } = {}) => apiClient.post<Playlist>(`${playlistBase}${id}/add-entry/`, input),
  /** Unknown id: 200 and nothing changes. */
  removeEntry: (id: string, entryId: string) => apiClient.post<Playlist>(`${playlistBase}${id}/remove-entry/`, { entry_id: entryId }),
  /** The listed entries come first in this order; unlisted ones follow in their old order. */
  reorder: (id: string, entryIds: string[]) => apiClient.post<Playlist>(`${playlistBase}${id}/reorder/`, { entries: entryIds.map((entryId) => ({ id: entryId })) }),
  share: (id: string, settings: PlaylistShareSettings) => apiClient.post<Playlist>(`${playlistBase}${id}/share/`, settings),
};

// --------------------------------------------------------------------------------------------------- media

export interface Media {
  id: string;
  uuid: string;
  code: string;
  name: string;
  title: string;
  file_name: string;
  media_type: string;
  category: string;
  file_format: string;
  storage_tier: string;
  source_url: string;
  preview_url: string;
  thumbnail_url: string;
  file_size_mb: string;
  resolution: string;
  entity_type: string;
  entity_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface MediaInput {
  project: string;
  entity_type: string;
  entity_id: string;
  /** Free text on the server (default `image`); it accepts any value. */
  media_type: string;
  category?: string;
  file_format?: string;
  storage_tier?: string;
  source_url?: string;
  preview_url?: string;
  thumbnail_url?: string;
  file_size_mb?: number | string;
  resolution?: string;
}

const mediaBase = `${V1}/media/`;
export const mediaApi = {
  /** The list is a bare array. `archive` needs `media.update` (CR-15); DELETE (`media.delete`) archives too. */
  ...resourceApi<Media, MediaInput>('media', mediaBase),
  archive: (id: string) => apiClient.post<Media>(`${mediaBase}${id}/archive/`, {}),
  archived: listFetcher<Media>(`${mediaBase}archived/`),
  restoreOne: (id: string) => apiClient.post<Media>(`${mediaBase}${id}/restore/`, {}),
};

// ----------------------------------------------------------------------------------------------- workflows

export interface Workflow {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  category: string;
  department: string;
  is_active: boolean;
  is_archived: boolean;
  nodes: Array<Record<string, unknown>>;
  transitions: Array<Record<string, unknown>>;
  automation_rules: unknown[];
  execution_stats: Record<string, unknown>;
  project_id: string;
  created_at: string;
  updated_at: string;
}
export interface WorkflowInput {
  project: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  department?: string;
  is_active?: boolean;
  nodes?: Array<Record<string, unknown>>;
  transitions?: Array<Record<string, unknown>>;
  automation_rules?: unknown[];
}
/** A stub: every node of the stored graph is reported as a success; nothing is evaluated. */
export interface WorkflowSimulation {
  simulation_id: string;
  overall_status: string;
  steps: Array<{ node: string; status: string }>;
  side_effects: unknown[];
  audit_entry: Record<string, unknown>;
}

const workflowBase = `${V1}/workflows/`;
export const workflowsApi = {
  ...resourceApi<Workflow, WorkflowInput>('workflows', workflowBase),
  archive: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/archive/`, {}),
  restoreOne: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/restore/`, {}),
  archived: listFetcher<Workflow>(`${workflowBase}archived/`),
  activate: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/activate/`, {}),
  deactivate: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/deactivate/`, {}),
  /** An inactive copy named "<name> (Copy)" with code "<code>-COPY"; codes are not unique, so a second clone repeats it. */
  clone: (id: string) => apiClient.post<Workflow>(`${workflowBase}${id}/clone/`, {}),
  simulate: (id: string) => apiClient.post<WorkflowSimulation>(`${workflowBase}${id}/simulate/`, {}),
};

// --------------------------------------------------------------------------------------------- automations

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: { event: string; entity_type: string; filters: Record<string, unknown> };
  conditions: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  is_active: boolean;
  required_role: string;
  workflow_id: string | null;
  execution_count: number;
  last_triggered_at: string | null;
  last_status: string;
  created_at: string;
  updated_at: string;
}
export interface AutomationRuleInput {
  name: string;
  description?: string;
  /** An object (a bare string is a 400). */
  trigger: { event: string; entity_type?: string; filters?: Record<string, unknown> };
  conditions?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  is_active?: boolean;
  required_role?: string;
  /** Required for anyone but a platform administrator; a rule without a project is a studio-wide rule. */
  project_id?: string;
}

export const automationKeys = createQueryKeys('automation-rules');
const ruleBase = `${V1}/automations/rules/`;
/** Rules are stored definitions: nothing in the backend fires them yet (`execution_count` stays 0). */
export const automationsApi = {
  rules: listFetcher<AutomationRule>(ruleBase),
  get: (id: string, signal?: AbortSignal) => apiClient.get<AutomationRule>(`${ruleBase}${id}/`, { signal }),
  create: (input: AutomationRuleInput) => apiClient.post<AutomationRule>(ruleBase, input),
  update: (id: string, patch: Partial<AutomationRuleInput>) => apiClient.patch<AutomationRule>(`${ruleBase}${id}/`, patch),
  remove: (id: string) => apiClient.delete<void>(`${ruleBase}${id}/`),
  auditLogs: listFetcher<Record<string, unknown>>(`${V1}/automations/audit-logs/`),
};

