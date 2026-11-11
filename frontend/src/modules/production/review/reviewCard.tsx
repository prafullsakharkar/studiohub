import { Building, Layers, MessageSquare, Play } from 'lucide-react';
import type { Review } from '@/api/production/review';
import { CardChip, ListCard } from '@/modules/directory/ListCard';
import type { CardContext } from '@/modules/directory/types';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { safeWebUrl } from '@/shared/utils/safeUrl';

const clientName = (client: Review['client']) => (typeof client?.name === 'string' ? client.name : '');

/** A review as the former Reviews grid drew it: the picture with a play mark, the people and counts underneath. */
export function reviewCard(row: Review, ctx: CardContext) {
  const client = clientName(row.client);
  return (
    <ListCard
      ctx={ctx}
      image={{ src: safeWebUrl(row.thumbnail_url), alt: `${row.title} thumbnail` }}
      band={<Play className="h-10 w-10" aria-hidden />}
      topLeft={<CardChip tone="accent">{row.code}</CardChip>}
      topRight={<StatusBadge status={row.status} />}
      bottomLeft={row.entity_code ? <CardChip>{`${row.entity_type} ${row.entity_code}`.trim()}</CardChip> : undefined}
      title={row.title}
      subtitle={row.lead_reviewer_name ? `Lead: ${row.lead_reviewer_name}` : undefined}
      footerLeft={
        <>
          {client && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate text-cyan-400">
              <Building className="h-3.5 w-3.5 shrink-0" aria-hidden /> {client}
            </span>
          )}
          <span className="inline-flex items-center gap-1" title="Versions">
            <Layers className="h-3.5 w-3.5" aria-hidden /> {row.versions.length}
          </span>
          <span className={`inline-flex items-center gap-1 ${row.comments.length > 0 ? 'font-semibold text-amber-400' : ''}`} title="Comments">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden /> {row.comments.length}
          </span>
        </>
      }
    >
      {row.description && <p className="line-clamp-2 text-xs leading-relaxed text-slate-300">{row.description}</p>}
      {row.supervisor_verdict && row.supervisor_verdict !== 'Pending Review' && (
        <p className="text-[11px] text-slate-400">
          Verdict: <StatusBadge status={row.supervisor_verdict} size="xs" />
        </p>
      )}
    </ListCard>
  );
}
