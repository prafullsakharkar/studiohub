import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useContext, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { reviewsApi } from '@/api/production/review';
import type { Review } from '@/api/production/review';
import { type REVIEW_ACTIONS, reviewActionsFrom } from '@/api/production/statusFlow';
import type { ReviewAction } from '@/api/production/statusFlow';
import { EntityHistory } from '@/components/history/EntityHistory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { AuthContext } from '@/core/auth/AuthContext';
import { evaluateAccess } from '@/core/permissions/access';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { StatusHistory } from '@/modules/production/work/StatusHistory';
import { useReviewWrite, ReviewActivityPanel, ReviewAnnotationsPanel, ReviewCommentsPanel, ReviewNotesPanel, ReviewParticipantsPanel, ReviewVersionsPanel } from './ReviewPanels';
import { reviewStatusVariant } from './reviews';
import { Badge } from '@/shared/components/Badge';

type TabId = 'versions' | 'participants' | 'comments' | 'notes' | 'annotations' | 'activity' | 'status' | 'changes';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'versions', label: 'Versions' },
  { id: 'participants', label: 'Participants' },
  { id: 'comments', label: 'Comments' },
  { id: 'notes', label: 'Notes' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'activity', label: 'Activity' },
  { id: 'status', label: 'Status history' },
  { id: 'changes', label: 'Changes' },
];

/** Decisions carry an optional note; the rest are plain moves. */
const DECISIONS = new Set<ReviewAction>(['approve', 'requestChanges', 'reject', 'retake']);

const run = (action: ReviewAction, id: string, notes: string) => {
  const n = notes.trim() || undefined;
  switch (action) {
    case 'submit':
      return reviewsApi.submit(id);
    case 'startReview':
      return reviewsApi.startReview(id);
    case 'approve':
      return reviewsApi.approve(id, n);
    case 'requestChanges':
      return reviewsApi.requestChanges(id, n);
    case 'reject':
      return reviewsApi.reject(id, n);
    case 'retake':
      return reviewsApi.verdict(id, 'Retake', n); // the only route to the Retake decision
    case 'close':
      return reviewsApi.close(id);
  }
};

const ReviewActions: React.FC<{ review: Review }> = ({ review }) => {
  const user = useContext(AuthContext)?.user ?? null;
  const write = useReviewWrite();
  const [pending, setPending] = useState<(typeof REVIEW_ACTIONS)[number] | null>(null);
  const [notes, setNotes] = useState('');
  // Only the moves this status allows and this caller holds the permission for; the server still decides (separation of duties).
  const offered = reviewActionsFrom(review.status).filter((a) => evaluateAccess(user, a.permission, {}));
  if (offered.length === 0) return null;
  return (
    <>
      <div role="toolbar" aria-label="Review actions" className="flex flex-wrap gap-2">
        {offered.map((a) => (
          <Button
            key={a.action}
            size="sm"
            variant={a.action === 'approve' ? 'primary' : a.action === 'reject' || a.action === 'close' ? 'outline' : 'secondary'}
            onClick={() => {
              setNotes('');
              setPending(a);
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <ConfirmDialog
        isOpen={pending !== null}
        title={pending ? `${pending.label}: ${review.code}` : ''}
        confirmLabel={pending?.label ?? 'Confirm'}
        destructive={pending?.action === 'reject'}
        message={
          <>
            <p>{pending ? `Move this review to ${pending.to}?` : ''}</p>
            {pending && DECISIONS.has(pending.action) && (
              <label className="mt-3 block text-xs text-slate-400">
                Notes (optional)
                <textarea aria-label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </label>
            )}
          </>
        }
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          // Throw so the dialog stays open and shows the server's reason (a producer cannot approve: separation_of_duties).
          await run(pending.action, review.id, notes);
          await write(async () => undefined);
        }}
      />
    </>
  );
};

export const ReviewWorkspace: React.FC = () => {
  const { reviewId = '' } = useParams();
  const canEdit = useCan('review.update');
  const [tab, setTab] = useState<TabId>('versions');
  const query = useQuery({ queryKey: reviewsApi.keys.detail(reviewId), queryFn: ({ signal }) => reviewsApi.get(reviewId, signal), enabled: Boolean(reviewId) });
  const review = query.data;
  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="review">
        {review && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/reviews" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Reviews
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {review.code} · {review.title}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {review.entity_type} {review.entity_code}
                  {review.supervisor_verdict && review.supervisor_verdict !== 'Pending Review' ? ` · decision: ${review.supervisor_verdict}` : ''}
                </p>
                {review.description && <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{review.description}</p>}
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <Badge variant={reviewStatusVariant(review.status)}>{review.status}</Badge>
                <ReviewActions review={review} />
                {canEdit && (
                  <Link to={`/reviews/${review.id}/edit`} className="text-xs text-cyan-300 hover:underline">
                    Edit details
                  </Link>
                )}
              </div>
            </div>

            <div role="tablist" aria-label="Review sections" className="flex flex-wrap gap-1 border-b border-slate-800">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-xs font-semibold ${tab === t.id ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'versions' && <ReviewVersionsPanel review={review} />}
            {tab === 'participants' && <ReviewParticipantsPanel review={review} />}
            {tab === 'comments' && <ReviewCommentsPanel review={review} />}
            {tab === 'notes' && <ReviewNotesPanel review={review} />}
            {tab === 'annotations' && <ReviewAnnotationsPanel review={review} />}
            {tab === 'activity' && <ReviewActivityPanel review={review} />}
            {tab === 'status' && <StatusHistory queryKey={[...reviewsApi.keys.detail(review.id), 'status-history']} fetch={(signal) => reviewsApi.statusHistory(review.id, signal)} />}
            {tab === 'changes' && <EntityHistory targetType="Review" targetId={review.id} />}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
