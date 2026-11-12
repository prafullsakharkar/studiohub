import { Building, CalendarClock, Layers, Package, Send } from 'lucide-react';
import type { DeliveryRow } from '@/api/deliveries/deliveries';
import { CardChip, CardFact, CardFacts, ListCard } from '@/modules/directory/ListCard';
import type { CardContext } from '@/modules/directory/types';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { formatBytes, formatDay } from './format';

/** A delivery as the former Deliveries grid drew it: code and status on a band, the client and the due date in a box. A delivery has no picture. */
export function deliveryCard(row: DeliveryRow, ctx: CardContext) {
  const answered = row.client_status === 'Approved' || row.client_status === 'Rejected';
  return (
    <ListCard
      ctx={ctx}
      band={<Package className="h-12 w-12" aria-hidden />}
      topLeft={<CardChip tone="accent">{row.code}</CardChip>}
      topRight={<StatusBadge status={row.status} />}
      bottomLeft={
        <CardChip tone="good">
          <Layers className="h-3 w-3" aria-hidden /> {row.version_count} {row.version_count === 1 ? 'version' : 'versions'}
        </CardChip>
      }
      bottomRight={<CardChip>{formatBytes(row.total_size_bytes)}</CardChip>}
      title={row.name}
      subtitle={row.project_name || undefined}
    >
      <CardFacts>
        <CardFact label="Client">
          <span className="inline-flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5 text-indigo-400" aria-hidden /> {row.client_name || '—'}
          </span>
        </CardFact>
        <CardFact label="Method">
          <span className="inline-flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-cyan-400" aria-hidden /> {row.delivery_method}
          </span>
        </CardFact>
        <CardFact label="Due">
          <span className={`inline-flex items-center gap-1.5 ${row.is_expired ? 'font-semibold text-rose-400' : ''}`}>
            <CalendarClock className="h-3.5 w-3.5 text-amber-400" aria-hidden /> {row.expires_at ? formatDay(row.expires_at) : '—'}
          </span>
        </CardFact>
        {answered && <CardFact label="Client answer"><StatusBadge status={row.client_status} size="xs" /></CardFact>}
      </CardFacts>
    </ListCard>
  );
}
