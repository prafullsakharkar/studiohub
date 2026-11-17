import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { serverMessage } from '@/api/errors/serverMessage';
import { reviewCopiesApi, versionsApi } from '@/api/production/review';
import type { ReviewCopies, ReviewCopiesRemade } from '@/api/production/review';
import type { Project } from '@/api/production/structure';
import { formatNumber } from '@/core/locale/studioLocale';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';

/** How often the counts are read again while remade copies are being made. */
const WHILE_REMAKING_MS = 10_000;

const copies = (n: number) => `${formatNumber(n)} review ${n === 1 ? 'copy' : 'copies'}`;

/** The sentence about the copies that differ from the project's settings (C-RP-38; colour, RP-15). */
export function outOfDateText(c: ReviewCopies): string {
  const verb = c.out_of_date === 1 ? 'was' : 'were';
  if (c.colour_out_of_date > 0) return `${copies(c.out_of_date)} ${verb} made with other colour or burn-in settings than the project has now.`;
  return c.review_burn_ins
    ? `${copies(c.out_of_date)} ${verb} made without burn-ins; the project now adds them.`
    : `${copies(c.out_of_date)} ${verb} made with burn-ins; the project now leaves them off.`;
}

/** What the project remake did (C-RP-38), one sentence. */
export function remadeText(r: ReviewCopiesRemade): string {
  const parts = [`Remaking ${copies(r.queued)}.`];
  if (r.skipped_busy) parts.push(`${formatNumber(r.skipped_busy)} left: their version already has a copy being made.`);
  if (r.skipped_missing) parts.push(`${formatNumber(r.skipped_missing)} left: the uploaded file is gone; upload it again.`);
  return parts.join(' ');
}

/**
 * The project's review copies that differ from its burn-in switch (RP-14, C-RP-37, C-RP-38): how many, and for whoever
 * may change the project (`project.update`) a button that remakes the movies. A sequence cannot be remade (its frames
 * are gone once its copy is ready), so it is only counted. Nothing shows when every copy matches.
 */
export const ReviewCopiesNotice: React.FC<{ project: Project }> = ({ project }) => {
  const canRemake = useCan('project.update');
  const queryClient = useQueryClient();
  const [remaking, setRemaking] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: reviewCopiesApi.keys.of(project.id),
    queryFn: ({ signal }) => reviewCopiesApi.get(project.id, signal),
    refetchInterval: remaking > 0 ? WHILE_REMAKING_MS : false,
  });
  if (!data || (data.out_of_date === 0 && data.sequences_out_of_date === 0)) return null;

  const remake = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await reviewCopiesApi.remake(project.id);
      setRemaking(result.queued);
      notify.success(remadeText(result));
      await queryClient.invalidateQueries({ queryKey: versionsApi.keys.all });
    } catch (error) {
      setProblem(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Review copies" className="mb-3 space-y-1 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      {data.out_of_date > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {remaking > 0 ? `Remaking ${copies(remaking)}. Each one replaces its old copy when it is ready.` : outOfDateText(data)}
          </span>
          {canRemake && remaking === 0 && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void remake()}>
              {busy ? 'Remaking…' : 'Remake them'}
            </Button>
          )}
        </div>
      )}
      {data.sequences_out_of_date > 0 && (
        <p>
          {formatNumber(data.sequences_out_of_date)} image {data.sequences_out_of_date === 1 ? 'sequence was' : 'sequences were'} made with other settings. A
          sequence's frames are not kept, so upload its frames again to change it.
        </p>
      )}
      {problem && (
        <p role="alert" className="text-rose-300">
          {problem}
        </p>
      )}
    </section>
  );
};
