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

/** What the file picker offers; the server decides (by the first bytes and the extension) and answers 400 on `file`. */
const ACCEPT = '.mov,.mp4,.m4v,.mkv,.webm,.mxf,.avi,.jpg,.jpeg,.png,.tif,.tiff';
/** The first attempt and two retries (C-RP-20); after that the file has to be uploaded again. */
const MAX_ATTEMPTS = 3;

function sizeText(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${formatNumber(Math.round(mb * 10) / 10)} MB` : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

function probeText(media: ReviewMedia): string {
  const p = media.probe;
  if (!p) return '';
  const size = `${p.width}×${p.height}`;
  if (media.kind === 'still') return `${size} · ${p.video_codec}`;
  return [size, `${formatNumber(p.fps)} fps`, `${formatNumber(p.frames)} frames`, p.video_codec, p.has_audio ? 'with sound' : 'no sound'].join(' · ');
}

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
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const current = version.review_media;
  const job = version.review_media_job;
  const running = reviewMediaInFlight(job);
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

  return (
    <section aria-label="Review movie" className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Review movie</h2>
          <p className="text-[11px] text-slate-500">
            {current
              ? `${current.kind === 'still' ? 'A still' : 'A movie'} made by the server from ${current.source_name} (${sizeText(current.source_size)}).`
              : 'Upload a movie or still: the server makes a copy every browser can play.'}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={input} type="file" accept={ACCEPT} aria-label="Movie or still to upload" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="sm" variant={current ? 'outline' : 'primary'} disabled={busy !== null || running} onClick={() => input.current?.click()}>
              {busy === 'Uploading…' ? 'Uploading…' : current ? 'Replace' : 'Upload'}
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
          <div>
            <dt className="sr-only">Made</dt>
            <dd className="text-slate-400">
              {current.created_by?.name ? `${current.created_by.name} · ` : ''}
              {formatDateTime(current.finished_at, '')}
            </dd>
          </div>
        </dl>
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
