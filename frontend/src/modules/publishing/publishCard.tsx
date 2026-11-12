import { AlertTriangle, Box, Film, Layers } from 'lucide-react';
import type { PublishRow } from '@/api/publishing/publishing';
import { CardChip, CardFact, CardFacts, ListCard } from '@/modules/directory/ListCard';
import type { CardContext } from '@/modules/directory/types';
import { StatusBadge } from '@/shared/components/StatusBadge';

const DCC_TONE: Record<string, string> = {
  Nuke: 'border-amber-500/30 bg-amber-950/60 text-amber-300',
  Maya: 'border-cyan-500/30 bg-cyan-950/60 text-cyan-300',
  Houdini: 'border-orange-500/30 bg-orange-950/60 text-orange-300',
  Blender: 'border-blue-500/30 bg-blue-950/60 text-blue-300',
  Unreal: 'border-purple-500/30 bg-purple-950/60 text-purple-300',
  USD: 'border-emerald-500/30 bg-emerald-950/60 text-emerald-300',
};

/** An export job as the former Publishing grid drew it: the tool on a coloured chip, the shot or asset, the status. A job has no picture. */
export function publishCard(row: PublishRow, ctx: CardContext) {
  const isShot = row.entity_type === 'Shot';
  const tool = row.dcc_tool_display || row.dcc_tool;
  return (
    <ListCard
      ctx={ctx}
      band={<Layers className="h-12 w-12" aria-hidden />}
      topLeft={
        <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${DCC_TONE[row.dcc_tool] ?? 'border-slate-700 bg-slate-800 text-slate-300'}`}>
          {tool}
          {row.dcc_version ? ` ${row.dcc_version}` : ''}
        </span>
      }
      topRight={<StatusBadge status={row.job_status} />}
      bottomLeft={
        row.entity_code ? (
          <CardChip tone="accent">
            {isShot ? <Film className="h-3 w-3" aria-hidden /> : <Box className="h-3 w-3" aria-hidden />} {row.entity_code}
          </CardChip>
        ) : undefined
      }
      bottomRight={row.export_format ? <CardChip>{row.export_format}</CardChip> : undefined}
      title={row.name}
      subtitle={row.code}
    >
      <CardFacts>
        <CardFact label="For">{row.entity_name || row.entity_code || '—'}</CardFact>
        <CardFact label="Project">{row.client_name || '—'}</CardFact>
        {row.retry_count > 0 && <CardFact label="Retries">{row.retry_count}</CardFact>}
      </CardFacts>
      {row.is_failed && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden />
          <span>The export failed. Open the job for the reason.</span>
        </div>
      )}
    </ListCard>
  );
}
