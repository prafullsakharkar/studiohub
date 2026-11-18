import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewMediaApi, reviewMediaInFlight, versionsApi } from '@/api/production/review';
import type { ReviewMedia, Version } from '@/api/production/review';
import { serverMessage } from '@/api/errors/serverMessage';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { formatDateTime, formatNumber } from '@/core/locale/studioLocale';
import { useCan } from '@/core/permissions/useCan';
import { notify } from '@/core/notifications/notify';
import { Button } from '@/shared/components/Button';
import { choicesOf } from './ReviewColourSelect';
import { ReviewFromPublishedFile } from './ReviewFromPublishedFile';
import { ReviewFromStorage } from './ReviewFromStorage';
import { partsOf, planSequence, SEQUENCE_EXTENSIONS } from './sequenceFrames';

/** What the file picker offers; the server decides (by the first bytes and the extension) and answers 400 on `file`. */
const ACCEPT = '.mov,.mp4,.m4v,.mkv,.webm,.mxf,.avi,.jpg,.jpeg,.png,.tif,.tiff';
/** The first attempt and two retries (C-RP-20); after that the file has to be uploaded again. */
const MAX_ATTEMPTS = 3;
/** What the frames picker offers (RP-12, C-RP-31). */
const FRAMES_ACCEPT = SEQUENCE_EXTENSIONS.map((e) => `.${e}`).join(',');
/** A folder picker: not in React's input attributes, so it is passed as a plain attribute. */
const FOLDER_PICKER = { webkitdirectory: '', directory: '' } as Record<string, string>;

function sizeText(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${formatNumber(Math.round(mb * 10) / 10)} MB` : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

function probeText(media: ReviewMedia): string {
  const p = media.probe;
  if (!p) return '';
  const size = `${p.width}×${p.height}`;
  if (media.kind === 'still') return `${size} · ${p.video_codec}`;
  if (media.kind === 'sequence') {
    const range = p.first_frame !== null && p.last_frame !== null ? `frames ${p.first_frame}–${p.last_frame}` : `${formatNumber(p.frames)} frames`;
    return [size, `${formatNumber(p.fps)} fps`, range, p.video_codec.toUpperCase()].join(' · ');
  }
  return [size, `${formatNumber(p.fps)} fps`, `${formatNumber(p.frames)} frames`, p.video_codec, p.has_audio ? 'with sound' : 'no sound'].join(' · ');
}

/** Why a colour transform that was due was left out (RP-15, C-RP-40). */
const COLOUR_SKIPPED: Record<NonNullable<NonNullable<ReviewMedia['probe']>['colour_skipped']>, string> = {
  unknown_colour_space: "colour not managed: its colour space, view or look is not in the studio's colour config",
  colour_config_unavailable: "colour not managed: the studio's colour config could not be read",
};

/** Why a shot's grade that was due was left out (RP-20, C-RP-53). */
const GRADE_SKIPPED: Record<NonNullable<NonNullable<ReviewMedia['probe']>['grade_skipped']>, string> = {
  no_grading_space: "not graded: the studio's colour config has no grading space (color_timing)",
  colour_config_unavailable: "not graded: the shot's grade could not be applied with the studio's colour config",
};

/** How a copy's colour was made (RP-15, C-RP-40), e.g. `ACEScg → sRGB - Display, ACES 2.0 - SDR 100 nits (Rec.709)`. */
export function colourText(media: ReviewMedia): string | null {
  const o = media.probe?.ocio;
  if (!o) return null;
  return `${o.input} → ${o.display}, ${o.view}${o.look ? ` with ${o.look}` : ''}`;
}

/** The colour rule and burn-ins of a copy (C-RP-32, C-RP-33, C-RP-40); empty when there is nothing to say. */
export function copyNotes(media: ReviewMedia): string[] {
  const notes: string[] = [];
  const colour = colourText(media);
  if (colour) notes.push(colour);
  if (media.probe?.colour_skipped) notes.push(COLOUR_SKIPPED[media.probe.colour_skipped]);
  // RP-20 (C-RP-53): the shot's grade, applied in the grading space before the view
  if (media.probe?.grade) notes.push(media.probe.grade_source ? `Graded with the shot's CDL from ${media.probe.grade_source}` : "Graded with the shot's CDL");
  if (media.probe?.grade_skipped) notes.push(GRADE_SKIPPED[media.probe.grade_skipped]);
  if (media.probe?.colour === 'srgb_from_linear') notes.push('EXR shown as sRGB from linear light; not for colour approval');
  if (media.probe?.burn_ins) notes.push('With burn-ins');
  return notes;
}

/**
 * Whether a ready copy can be remade: from its upload, a sequence from its frames while they are kept (RP-16, C-RP-41),
 * a copy read from a published file while that file can still be read (RP-17, C-RP-46), a copy read by path while its
 * render is still in the project's review folder (RP-18, C-RP-49).
 */
export function canRemake(media: ReviewMedia): boolean {
  if (media.source !== 'upload') return media.storage_readable;
  return media.kind !== 'sequence' || media.frames_until !== null;
}

/** Where a remake reads from, for its button's title. */
function remakeSource(media: ReviewMedia): string {
  if (media.source === 'published_file') return 'published file on studio storage';
  if (media.source === 'storage_path') return "render in the project's review folder";
  return media.kind === 'sequence' ? 'kept frames' : 'uploaded file';
}

/** A copy read from studio storage (RP-17, C-RP-44, C-RP-46; RP-18, C-RP-49); null for an upload. */
export function storageText(media: ReviewMedia): string | null {
  if (media.source === 'upload') return null;
  if (media.source === 'storage_path') {
    return media.storage_readable
      ? "Read from the project's review folder on studio storage; it can be remade while the render is there"
      : "Its render is no longer in the project's review folder, or the server no longer reads its storage root";
  }
  return media.storage_readable
    ? 'Read from its published file on studio storage; it can be remade at any time'
    : 'Its published file can no longer be read: it was revoked, or the server no longer reads its storage root';
}

/** How long a sequence's frames are kept (C-RP-41); null for a movie or still, and for a copy read from studio storage. */
export function framesText(media: ReviewMedia): string | null {
  if (media.kind !== 'sequence' || media.source !== 'upload') return null;
  return media.frames_until ? `Frames kept until ${formatDateTime(media.frames_until)}` : 'Frames no longer kept';
}

const KIND_TEXT: Record<ReviewMedia['kind'], string> = { movie: 'A movie', still: 'A still', sequence: 'A movie' };

const JOB_TEXT: Partial<Record<ReviewMedia['status'], string>> = {
  queued: 'Waiting for the media worker…',
  processing: 'Making the review copy…',
};
/** A remake (RP-14, C-RP-37): the copy it remakes stays shown until it is ready. */
const REMAKE_TEXT: Partial<Record<ReviewMedia['status'], string>> = {
  queued: 'Waiting for the media worker to remake the copy. The current copy stays until then.',
  processing: 'Remaking the review copy. The current copy stays until it is ready.',
};

/**
 * The version's review movie (RP-5, C-RP-19 to C-RP-22): upload a movie or still, follow the worker's job, retry a
 * failure, replace or remove the copy, remake a copy from its kept upload (RP-14, C-RP-37) or a sequence from its kept frames (RP-16, C-RP-41). Uploading, retrying and removing need `version.update`, or being the version's
 * artist with `version.create` (RP-10, C-RP-26); reading needs only the version. The version is refetched while a job runs (`VersionWorkspace`), so this panel shows what the server says.
 */
export const ReviewMoviePanel: React.FC<{ version: Version }> = ({ version }) => {
  const canUpdate = useCan('version.update');
  const canCreate = useCan('version.create');
  const { user } = useCurrentUser();
  const canManage = canUpdate || (canCreate && Boolean(user?.id) && version.artist_id === user?.id);
  // RP-17 (C-RP-44): reading the version's published files needs publishing.view
  const canReadFiles = useCan('publishing.view');
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const framesInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  // RP-15 (C-RP-40): the colour space the next upload names; blank = the project's rule (EXR only)
  const [colorSpace, setColorSpace] = useState('');
  const { data: colourOptions } = useQuery({
    queryKey: reviewMediaApi.colourOptionsKey,
    queryFn: ({ signal }) => reviewMediaApi.colourOptions(signal),
    staleTime: 5 * 60_000,
    enabled: canManage,
  });
  const current = version.review_media;
  const job = version.review_media_job;
  const running = reviewMediaInFlight(job);
  const unfinished = job?.status === 'uploading' ? job : null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: versionsApi.keys.all });

  const act = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setProblem(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setProblem(serverMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    void act('Uploading…', async () => {
      await reviewMediaApi.upload(version.id, file, colorSpace);
      notify.success(`${file.name} uploaded. The review copy is being made.`);
    });
  };

  // An image sequence (RP-12, C-RP-31): checked here first, then opened, sent in parts, and completed.
  const uploadSequence = (files: FileList | null) => {
    const planned = planSequence(Array.from(files ?? []));
    if ('message' in planned) {
      setProblem(planned.message);
      return;
    }
    const { plan } = planned;
    void act('Sending frames…', async () => {
      const row = await reviewMediaApi.openSequence(version.id, {
        name: plan.name,
        extension: plan.extension,
        first_frame: plan.first,
        last_frame: plan.last,
        ...(colorSpace ? { color_space: colorSpace } : {}),
      });
      let sent = 0;
      for (const part of partsOf(plan.frames)) {
        setBusy(`Sending frames ${formatNumber(sent + 1)}–${formatNumber(sent + part.length)} of ${formatNumber(plan.frames.length)}…`);
        await reviewMediaApi.sendFrames(row.id, part.map((f) => f.file));
        sent += part.length;
      }
      await reviewMediaApi.complete(row.id);
      notify.success(`${formatNumber(plan.frames.length)} frames of ${plan.name} uploaded. The review copy is being made.`);
    });
  };

  return (
    <section aria-label="Review movie" className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Review movie</h2>
          <p className="text-[11px] text-slate-500">
            {current && current.published_file_id !== null ? (
              <>
                {KIND_TEXT[current.kind]} made by the server from the published file{' '}
                {canReadFiles ? (
                  <Link to={`/publishing/files/${current.published_file_id}`} className="text-cyan-300 hover:underline">
                    {current.source_name}
                  </Link>
                ) : (
                  current.source_name
                )}
                .
              </>
            ) : current && current.source === 'storage_path' ? (
              `${KIND_TEXT[current.kind]} made by the server from ${current.source_name}, read from studio storage.`
            ) : current ? (
              `${KIND_TEXT[current.kind]} made by the server from ${current.source_name} (${sizeText(current.source_size)}).`
            ) : (
              'Upload a movie, a still or an image sequence (EXR, DPX, TIFF, PNG, JPEG), or read one the version published: the server makes a copy every browser can play.'
            )}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={input} type="file" accept={ACCEPT} aria-label="Movie or still to upload" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={folderInput} type="file" multiple {...FOLDER_PICKER} aria-label="Folder of frames to upload" className="hidden" onChange={(e) => { uploadSequence(e.target.files); e.target.value = ''; }} />
            <input ref={framesInput} type="file" multiple accept={FRAMES_ACCEPT} aria-label="Frames to upload" className="hidden" onChange={(e) => { uploadSequence(e.target.files); e.target.value = ''; }} />
            {colourOptions?.available && (
              <select
                aria-label="Colour space of the upload"
                title="The colour space of what you upload next. Leave it at the project's rule for display-ready movies; EXR frames take the project's colour space."
                value={colorSpace}
                disabled={busy !== null}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                onChange={(e) => setColorSpace(e.target.value)}
              >
                <option value="">Colour: the project's rule</option>
                {choicesOf('color_space', colourOptions).map(({ group, names }) => (
                  <optgroup key={group} label={group}>
                    {names.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            <Button size="sm" variant={current ? 'outline' : 'primary'} disabled={busy !== null || running || unfinished !== null} onClick={() => input.current?.click()}>
              {busy === 'Uploading…' ? 'Uploading…' : current ? 'Replace' : 'Upload'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null || running || unfinished !== null} onClick={() => folderInput.current?.click()}>
              Upload a sequence
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null || running || unfinished !== null} onClick={() => framesInput.current?.click()}>
              Choose frames
            </Button>
            {canReadFiles && <ReviewFromPublishedFile versionId={version.id} colorSpace={colorSpace} disabled={busy !== null || running || unfinished !== null} run={act} />}
            <ReviewFromStorage version={version} colorSpace={colorSpace} disabled={busy !== null || running || unfinished !== null} run={act} />
            {current && canRemake(current) && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || running || unfinished !== null}
                title={`Make the copy again from the ${remakeSource(current)}, with the project's burn-in and colour settings`}
                onClick={() =>
                  void act('Remaking…', async () => {
                    await reviewMediaApi.remake(current.id);
                    notify.success('The review copy is being remade. The current one stays until the new one is ready.');
                  })
                }
              >
                Remake
              </Button>
            )}
            {current && (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRemoving(true)}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>

      {current && (
        <dl aria-label="Review copy" className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-300">
          <div>
            <dt className="sr-only">Picture</dt>
            <dd>{probeText(current) || '—'}</dd>
          </div>
          {copyNotes(current).length > 0 && (
            <div>
              <dt className="sr-only">Notes</dt>
              <dd className="text-slate-400">{copyNotes(current).join(' · ')}</dd>
            </div>
          )}
          {storageText(current) && (
            <div>
              <dt className="sr-only">Source</dt>
              <dd className="text-slate-400">{storageText(current)}</dd>
            </div>
          )}
          {framesText(current) && (
            <div>
              <dt className="sr-only">Frames</dt>
              <dd className="text-slate-400">{framesText(current)}</dd>
            </div>
          )}
          <div>
            <dt className="sr-only">Made</dt>
            <dd className="text-slate-400">
              {current.created_by?.name ? `${current.created_by.name} · ` : ''}
              {formatDateTime(current.finished_at, '')}
            </dd>
          </div>
        </dl>
      )}

      {busy?.startsWith('Sending frames') && (
        <p role="status" className="text-xs text-cyan-300">
          {busy}
        </p>
      )}
      {unfinished && busy === null && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
          <span>
            {unfinished.source_name}: {formatNumber(unfinished.sequence?.frames_received ?? 0)} of{' '}
            {formatNumber(unfinished.sequence ? unfinished.sequence.last_frame - unfinished.sequence.first_frame + 1 : 0)} frames arrived and the upload was not finished. Cancel it and upload the
            sequence again. An unfinished upload is removed after a day.
          </span>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => void act('Cancelling…', () => reviewMediaApi.remove(unfinished.id))}>
              Cancel upload
            </Button>
          )}
        </div>
      )}
      {job && running && (
        <p role="status" className="text-xs text-cyan-300">
          {job.source_name}: {(job.remake_of ? REMAKE_TEXT : JOB_TEXT)[job.status]}
        </p>
      )}
      {job && job.status === 'failed' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
          <span>
            {job.source_name}: {job.error_message}
            {job.remake_of && current ? ' The remake failed; the current copy stays.' : ''}
            {job.attempts >= MAX_ATTEMPTS ? (job.source === 'published_file' ? ' Make the copy again from the published file.' : job.source === 'storage_path' ? ' Make the copy again from studio storage.' : ' Upload the file again.') : ''}
          </span>
          {canManage && job.attempts < MAX_ATTEMPTS && (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act('Retrying…', () => reviewMediaApi.retry(job.id))}>
              Retry
            </Button>
          )}
        </div>
      )}
      {problem && (
        <p role="alert" className="text-xs text-rose-300">
          {problem}
        </p>
      )}

      <ConfirmDialog
        isOpen={removing}
        title={`Remove the review copy of ${version.code}`}
        message="The movie the server made is deleted. The version and its own links stay as they are."
        confirmLabel="Remove"
        destructive
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          if (!current) return;
          await reviewMediaApi.remove(current.id); // a refusal stays in the dialog with the server's reason
          await refresh();
        }}
      />
    </section>
  );
};
