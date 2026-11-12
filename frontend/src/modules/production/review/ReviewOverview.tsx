import type React from 'react';
import { Link } from 'react-router-dom';
import type { Review } from '@/api/production/review';
import { formatDateTime } from '@/core/locale/studioLocale';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { parseDrawing } from './annotationModel';

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-xs text-slate-200">{children || '—'}</dd>
  </div>
);

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3" title={hint}>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-1 font-mono text-xl text-slate-100">{value}</dd>
  </div>
);

const clientName = (client: Review['client']) => (typeof client?.name === 'string' ? client.name : '');

/** The review at a glance: what it is, where the verdicts stand, how much feedback there is, its versions and what happened last. */
export const ReviewOverview: React.FC<{ review: Review }> = ({ review }) => {
  const verdicts: Record<string, number> = {};
  for (const p of review.reviewers) {
    const verdict = p.verdict || 'Pending Review';
    verdicts[verdict] = (verdicts[verdict] ?? 0) + 1;
  }
  const topLevel = review.comments;
  const open = topLevel.filter((c) => !c.is_resolved).length;
  const replies = topLevel.reduce((sum, c) => sum + c.replies.length, 0);
  const drawings = review.annotations.filter((a) => parseDrawing(a.drawing_coordinates).length > 0).length;
  const versions = [...review.versions].sort((a, b) => a.order - b.order);
  const recent = [...review.activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
  return (
    <div className="space-y-5">
      <dl aria-label="Review details" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Fact label="Code">{review.code}</Fact>
        <Fact label="For">{`${review.entity_type} ${review.entity_code}`.trim()}</Fact>
        <Fact label="Status">
          <StatusBadge status={review.status} size="xs" />
        </Fact>
        <Fact label="Supervisor verdict">
          <StatusBadge status={review.supervisor_verdict} size="xs" />
        </Fact>
        <Fact label="Lead reviewer">{review.lead_reviewer_name}</Fact>
        <Fact label="Client">{clientName(review.client)}</Fact>
        <Fact label="Created">{formatDateTime(review.created_at, '')}</Fact>
        <Fact label="Updated">{formatDateTime(review.updated_at, '')}</Fact>
      </dl>
      {review.description && <p className="whitespace-pre-wrap text-sm text-slate-300">{review.description}</p>}

      <dl aria-label="Review counts" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Versions" value={versions.length} />
        <Tile label="Participants" value={review.reviewers.length} />
        <Tile label="Open comments" value={open} hint={`${topLevel.length} comments, ${topLevel.length - open} resolved, ${replies} replies`} />
        <Tile label="Annotations" value={review.annotations.length} hint={`${drawings} with a drawing`} />
        <Tile label="Notes" value={review.notes.length} hint={`${review.notes.filter((n) => n.is_pinned).length} pinned`} />
      </dl>

      <section aria-label="Verdicts" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Verdicts</h2>
        {review.reviewers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">Nobody has been asked for a verdict yet.</p>
        ) : (
          <>
            <ul aria-label="Verdict tally" className="flex flex-wrap gap-2">
              {Object.entries(verdicts).map(([verdict, n]) => (
                <li key={verdict} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs">
                  <StatusBadge status={verdict} size="xs" />
                  <span className="font-mono text-slate-300">{n}</span>
                </li>
              ))}
            </ul>
            <ul aria-label="Participants" className="divide-y divide-slate-800/70 text-xs">
              {review.reviewers.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="text-slate-200">
                    {p.name}
                    {p.role && <span className="ml-2 text-[11px] text-slate-500">{p.role}</span>}
                  </span>
                  <StatusBadge status={p.verdict || 'Pending Review'} size="xs" />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="Versions on this review" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Versions</h2>
        {versions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No versions yet.</p>
        ) : (
          <ul aria-label="Versions" className="space-y-1.5">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                <Link to={`/versions/${v.id}`} className="font-semibold text-cyan-300 hover:underline">
                  {v.code}
                </Link>
                <span className="font-mono text-[11px] text-slate-400">{v.version_number}</span>
                <StatusBadge status={v.status} size="xs" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recent activity" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">Nothing has happened on this review yet.</p>
        ) : (
          <ol aria-label="Latest activity" className="space-y-1.5 text-xs">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 text-slate-300">
                <span className="font-mono text-[11px] text-slate-500">{formatDateTime(a.timestamp, '')}</span>
                <span className="font-semibold text-slate-200">{a.action}</span>
                <span className="text-slate-400">{a.user}</span>
                {a.notes && <span className="text-slate-400">{a.notes}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
