import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { serverMessage } from '@/api/errors/serverMessage';
import { reviewCopiesApi, versionsApi } from '@/api/production/review';
import type { ReviewCopies, ReviewCopiesRemade, ReviewCopyDiffering } from '@/api/production/review';
import type { Project } from '@/api/production/structure';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { formatDateTime, formatNumber } from '@/core/locale/studioLocale';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';

/** How often the counts are read again while remade copies are being made. */
const WHILE_REMAKING_MS = 10_000;

const copies = (n: number) => `${formatNumber(n)} review ${n === 1 ? 'copy' : 'copies'}`;
const sequences = (n: number) => `${formatNumber(n)} image ${n === 1 ? 'sequence' : 'sequences'}`;

/** The sentence about the movies and stills that differ from the project's settings (C-RP-38; colour, RP-15). */
export function outOfDateText(c: ReviewCopies): string {
  const verb = c.out_of_date === 1 ? 'was' : 'were';
  // RP-20 (C-RP-53): shots' grades
  if (c.grade_out_of_date > 0) return `${copies(c.out_of_date)} ${verb} made with other shot grades, colour or burn-in settings than the project has now.`;
  if (c.colour_out_of_date > 0) return `${copies(c.out_of_date)} ${verb} made with other colour or burn-in settings than the project has now.`;
  return c.review_burn_ins
    ? `${copies(c.out_of_date)} ${verb} made without burn-ins; the project now adds them.`
    : `${copies(c.out_of_date)} ${verb} made with burn-ins; the project now leaves them off.`;
}

/**
 * The sentence about the sequences that differ (C-RP-38; RP-16, C-RP-41; RP-17, C-RP-46): which of the listed ones can
 * still be remade, from their kept frames or from their published files, and which can only be uploaded again or kept as
 * they are.
 */
export function sequencesText(c: ReviewCopies): string {
  const n = c.sequences_out_of_date;
  const listed = c.differing.filter((row) => row.kind === 'sequence');
  const uploaded = listed.filter((row) => row.source === 'upload');
  const stored = listed.filter((row) => row.source === 'published_file');
  // RP-18 (C-RP-49): read by path from the project's review folder
  const byPath = listed.filter((row) => row.source === 'storage_path');
  const inFolder = byPath.filter((row) => row.remakable).length;
  const moved = byPath.length - inFolder;
  const kept = uploaded.filter((row) => row.remakable).length;
  const gone = uploaded.length - kept;
  const readable = stored.filter((row) => row.remakable).length;
  const unreadable = stored.length - readable;
  const parts = [`${sequences(n)} ${n === 1 ? 'was' : 'were'} made with other settings.`];
  if (readable > 0) parts.push(`${formatNumber(readable)} can be remade from ${readable === 1 ? 'its published file' : 'their published files'}.`);
  if (inFolder > 0) parts.push(`${formatNumber(inFolder)} can be remade from the project's review folder.`);
  if (kept > 0) parts.push(`${formatNumber(kept)} can be remade while ${kept === 1 ? 'its frames are' : 'their frames are'} kept.`);
  if (gone > 0) parts.push(`${formatNumber(gone)} no longer ${gone === 1 ? 'has its' : 'have their'} frames: upload them again, or keep the copies as they are.`);
  if (unreadable > 0) parts.push(`${formatNumber(unreadable)} can no longer read ${unreadable === 1 ? 'its published file' : 'their published files'}: keep the copies as they are, or make them from another file.`);
  if (moved > 0) parts.push(`${formatNumber(moved)} can no longer read ${moved === 1 ? 'its render' : 'their renders'} from the project's review folder: keep the copies as they are, or make them again.`);
  return parts.join(' ');
}

/** What the project remake did (C-RP-38), one sentence. */
export function remadeText(r: ReviewCopiesRemade): string {
  const parts = [`Remaking ${copies(r.queued)}.`];
  if (r.skipped_busy) parts.push(`${formatNumber(r.skipped_busy)} left: their version already has a copy being made.`);
  if (r.skipped_sequence) parts.push(`${formatNumber(r.skipped_sequence)} left: the frames of those sequences are no longer kept.`);
  if (r.skipped_missing) parts.push(`${formatNumber(r.skipped_missing)} left: the uploaded file is gone; upload it again.`);
  if (r.skipped_storage) parts.push(`${formatNumber(r.skipped_storage)} left: their files on studio storage can no longer be read.`);
  return parts.join(' ');
}

const WHY_TEXT: Record<ReviewCopyDiffering['why'][number], string> = { burn_ins: 'burn-ins', colour: 'colour', grade: 'grade' };

/** What differs: `burn-ins`, `burn-ins and colour`, `burn-ins, colour and grade` (the shot's, RP-20). */
const whyText = (why: ReviewCopyDiffering['why']): string => {
  const parts = why.map((reason) => WHY_TEXT[reason] ?? reason);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
};

/** One listed copy (C-RP-42): what differs, and whether it can be remade. */
export function differingText(row: ReviewCopyDiffering): string {
  const why = whyText(row.why);
  let state = 'can be remade';
  if (row.source === 'published_file') state = row.remakable ? 'can be remade from its published file' : 'its published file can no longer be read';
  else if (row.source === 'storage_path') state = row.remakable ? "can be remade from the project's review folder" : "its render is no longer in the project's review folder";
  else if (!row.remakable) state = row.kind === 'sequence' ? 'frames no longer kept' : 'the uploaded file is gone';
  else if (row.frames_until) state = `frames kept until ${formatDateTime(row.frames_until)}`;
  return `${why} differ · ${state}`;
}

/**
 * The project's review copies made with other settings than it has now (RP-14, C-RP-38; RP-16, C-RP-42, C-RP-43):
 * how many, which ones (each linking to its version), and for whoever may change the project (`project.update`) a
 * button that remakes those that can be remade and one that keeps the others as they are. Nothing shows when every copy
 * matches.
 */
export const ReviewCopiesNotice: React.FC<{ project: Project }> = ({ project }) => {
  const canChange = useCan('project.update');
  const queryClient = useQueryClient();
  const [remaking, setRemaking] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const { data } = useQuery({
    queryKey: reviewCopiesApi.keys.of(project.id),
    queryFn: ({ signal }) => reviewCopiesApi.get(project.id, signal),
    refetchInterval: remaking > 0 ? WHILE_REMAKING_MS : false,
  });
  if (!data || (data.out_of_date === 0 && data.sequences_out_of_date === 0)) return null;

  const remakable = data.out_of_date > 0 || data.differing.some((row) => row.remakable);
  const unremakable = data.differing.filter((row) => !row.remakable);

  const remake = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await reviewCopiesApi.remake(project.id);
      setRemaking(result.queued);
      notify.success(remadeText(result));
      await queryClient.invalidateQueries({ queryKey: versionsApi.keys.all });
      await queryClient.invalidateQueries({ queryKey: reviewCopiesApi.keys.of(project.id) });
    } catch (error) {
      setProblem(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const keep = async () => {
    const result = await reviewCopiesApi.keep(
      project.id,
      unremakable.map((row) => row.review_media_id),
    );
    notify.success(`${copies(result.kept)} kept as ${result.kept === 1 ? 'it is' : 'they are'}.`);
    await queryClient.invalidateQueries({ queryKey: reviewCopiesApi.keys.of(project.id) });
  };

  return (
    <section aria-label="Review copies" className="mb-3 space-y-1 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      {remaking > 0 ? (
        <p>Remaking {copies(remaking)}. Each one replaces its old copy when it is ready.</p>
      ) : (
        <>
          {data.out_of_date > 0 && <p>{outOfDateText(data)}</p>}
          {data.sequences_out_of_date > 0 && <p>{sequencesText(data)}</p>}
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" aria-expanded={showing} onClick={() => setShowing((s) => !s)}>
          {showing ? 'Hide the list' : 'Show which'}
        </Button>
        {canChange && remaking === 0 && remakable && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void remake()}>
            {busy ? 'Remaking…' : 'Remake them'}
          </Button>
        )}
        {canChange && unremakable.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            title="Stop counting the copies that cannot be remade until the project's settings change again"
            onClick={() => setConfirmKeep(true)}
          >
            Keep as they are
          </Button>
        )}
      </div>
      {showing && (
        <ul aria-label="Copies made with other settings" className="space-y-0.5 pt-1">
          {data.differing.map((row) => (
            <li key={row.review_media_id}>
              <Link to={`/versions/${row.version.id}`} className="font-semibold text-cyan-300 hover:underline">
                {row.version.code}
              </Link>
              {row.record_code ? <span className="text-slate-400"> · {row.record_code}</span> : null}
              <span className="text-slate-300"> · {differingText(row)}</span>
            </li>
          ))}
          {data.differing_more > 0 && <li className="text-slate-400">and {formatNumber(data.differing_more)} more</li>}
        </ul>
      )}
      {problem && (
        <p role="alert" className="text-rose-300">
          {problem}
        </p>
      )}
      <ConfirmDialog
        isOpen={confirmKeep}
        title="Keep copies as they are"
        message={`${copies(unremakable.length)} cannot be remade. Keep ${unremakable.length === 1 ? 'it' : 'them'} as ${unremakable.length === 1 ? 'it is' : 'they are'}? ${unremakable.length === 1 ? 'It' : 'They'} will count again if the project's burn-ins, colour space, view or look change.`}
        confirmLabel="Keep as they are"
        onConfirm={keep}
        onClose={() => setConfirmKeep(false)}
      />
    </section>
  );
};
