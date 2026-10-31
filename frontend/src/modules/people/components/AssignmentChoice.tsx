import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type React from 'react';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import type { PageFetcher } from '@/shared/data/listing';
import { fetchAllRows } from '@/shared/data/listing';

export interface AssignmentChoiceProps<T extends { id: string; name: string; code: string }> {
  /** What is being assigned: "team" or "department". */
  noun: string;
  queryKey: readonly unknown[];
  fetchPage: PageFetcher<T>;
  /** The id the person has now (`person.team` / `person.department`), if any. */
  currentId: string | null | undefined;
  /** Saves the choice; `null` clears it. A refusal is reported by the mutation's own error handling. */
  onAssign: (id: string | null) => Promise<unknown>;
  describe?: (row: T) => string;
}

/**
 * Every team or department, with the person's current one marked. A person has one of each: choosing
 * another replaces it, and "Remove" clears it. Saved by the person's `team` / `department` field.
 */
export function AssignmentChoice<T extends { id: string; name: string; code: string }>({ noun, queryKey, fetchPage, currentId, onAssign, describe }: AssignmentChoiceProps<T>): React.ReactElement {
  const canManage = useCan('masterdata.directory.manage');
  const query = useQuery({ queryKey: [...queryKey, 'all'], queryFn: ({ signal }) => fetchAllRows(fetchPage, { ordering: 'name' }, { signal }) });
  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white capitalize">{noun}</h3>
        {canManage && currentId && (
          <Button size="sm" variant="outline" onClick={() => void onAssign(null).catch(() => undefined)}>
            Remove from {noun}
          </Button>
        )}
      </div>
      {!canManage && <p className="text-xs text-slate-400">You can see the {noun} but not change it.</p>}
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName={`${noun}s`} isEmpty={rows.length === 0} empty={{ title: `No ${noun}s`, description: `No ${noun} has been created yet.` }}>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-label={`${noun}s`}>
          {rows.map((row) => {
            const current = row.id === currentId;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={!canManage || current}
                  aria-pressed={current}
                  onClick={() => void onAssign(row.id).catch(() => undefined)}
                  className={`w-full text-left rounded-xl border p-4 transition-all disabled:cursor-default ${current ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/50' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{row.name}</span>
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{row.code}</span>
                      </span>
                      {describe && <span className="block text-xs text-slate-400 mt-1">{describe(row)}</span>}
                    </span>
                    {current && (
                      <Badge variant="info" className="inline-flex items-center gap-1">
                        <Check className="w-3 h-3" aria-hidden="true" /> Current
                      </Badge>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </QueryBoundary>
    </div>
  );
}
