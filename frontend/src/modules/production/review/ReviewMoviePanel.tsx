import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useRef, useState } from 'react';
import { reviewMediaApi, reviewMediaInFlight, versionsApi } from '@/api/production/review';
import type { ReviewMedia, Version } from '@/api/production/review';
import { serverMessage } from '@/api/errors/serverMessage';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { formatDateTime, formatNumber } from '@/core/locale/studioLocale';
import { useCan } from '@/core/permissions/useCan';
import { notify } from '@/core/notifications/notify';
import { Button } from '@/shared/components/Button';
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

/** The colour rule and burn-ins of a copy (C-RP-32, C-RP-33); empty when there is nothing to say. */
function copyNotes(media: ReviewMedia): string[] {
  const notes: string[] = [];
  if (media.probe?.colour === 'srgb_from_linear') notes.push('EXR shown as sRGB from linear light; not for colour approval');
  if (media.probe?.burn_ins) notes.push('With burn-ins');
  return notes;
}

const KIND_TEXT: Record<ReviewMedia['kind'], string> = { movie: 'A movie', still: 'A still', sequence: 'A movie' };

const JOB_TEXT: Partial<Record<ReviewMedia['status'], string>> = {
  queued: 'Waiting for the media worker…',
  processing: 'Making the review copy…',
};

/**
 * The version's review movie (RP-5, C-RP-19 to C-RP-22): upload a movie or still, follow the worker's job, retry a
 * failure, replace or remove the copy. Uploading, retrying and removing need `version.update`, or being the version's
 * artist with `version.create` (RP-10, C-RP-26); reading needs only the version. The version is refetched while a job runs (`VersionWorkspace`), so this panel shows what the server says.
 */
export const ReviewMoviePanel: React.FC<{ version: Version }> = ({ version }) => {
  const canUpdate = useCan('version.update');
  const canCreate = useCan('version.create');
  const { user } = useCurrentUser();
  const canManage = canUpdate || (canCreate && Boolean(user?.id) && version.artist_id === user?.id);
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const framesInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
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
      await reviewMediaApi.upload(version.id, file);
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
      const row = await reviewMediaApi.openSequence(version.id, { name: plan.name, extension: plan.extension, first_frame: plan.first, last_frame: plan.last });
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
            {current
              ? `${KIND_TEXT[current.kind]} made by the server from ${current.source_name} (${sizeText(current.source_size)}).`
              : 'Upload a movie, a still or an image sequence (EXR, DPX, TIFF, PNG, JPEG): the server makes a copy every browser can play.'}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={input} type="file" accept={ACCEPT} aria-label="Movie or still to upload" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={folderInput} type="file" multiple {...FOLDER_PICKER} aria-label="Folder of frames to upload" className="hidden" onChange={(e) => { uploadSequence(e.target.files); e.target.value = ''; }} />
            <input ref={framesInput} type="file" multiple accept={FRAMES_ACCEPT} aria-label="Frames to upload" className="hidden" onChange={(e) => { uploadSequence(e.target.files); e.target.value = ''; }} />
            <Button size="sm" variant={current ? 'outline' : 'primary'} disabled={busy !== null || running || unfinished !== null} onClick={() => input.current?.click()}>
              {busy === 'Uploading…' ? 'Uploading…' : current ? 'Replace' : 'Upload'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null || running || unfinished !== null} onClick={() => folderInput.current?.click()}>
              Upload a sequence
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null || running || unfinished !== null} onClick={() => framesInput.current?.click()}>
              Choose frames
            </Button>
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
          {job.source_name}: {JOB_TEXT[job.status]}
        </p>
      )}
      {job && job.status === 'failed' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
          <span>
            {job.source_name}: {job.error_message}
            {job.attempts >= MAX_ATTEMPTS ? ' Upload the file again.' : ''}
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
