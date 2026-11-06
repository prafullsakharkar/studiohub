import { AlertTriangle, CheckCircle2, Clock, PlusCircle, RefreshCw, XCircle } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { formatNumber } from '@/core/locale/studioLocale';
import type { RowOutcome, RowReport } from './rows';
import { countOutcomes } from './rows';
import type { BulkMode, BulkSpec } from './specs';

/**
 * How a bulk batch went, laid out as the former bulk managers showed it: count cards, the "Batch validation breakdown"
 * pills (each filters the rows below), and the per-row log with a badge for each row. Every count comes from the
 * backend's per-row results, so the cards, the pills and the rows always agree.
 */
/** The backend's row statuses, as the breakdown names them. */
const KINDS: ReadonlyArray<{ status: string; label: string; mode?: BulkMode; tone: string }> = [
  { status: 'created', label: 'New (create)', mode: 'create', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  { status: 'updated', label: 'Update', mode: 'update', tone: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
  { status: 'exists', label: 'Already in the project', mode: 'create', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  { status: 'soft_deleted', label: 'Archived (restore it)', mode: 'create', tone: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
  { status: 'duplicate', label: 'Twice in the file', mode: 'create', tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
  { status: 'not_found', label: 'Not found', mode: 'update', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  { status: 'invalid', label: 'Validation errors', tone: 'border-rose-500/40 bg-rose-500/20 text-rose-400' },
];
const KNOWN = new Set(KINDS.map((k) => k.status));
const OTHER = 'other';

const BADGE: Record<RowOutcome, string> = {
  create: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  update: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  skip: 'bg-slate-800 text-slate-400 border-slate-700',
  error: 'bg-rose-500/10 text-rose-400 border-rose-500/40',
};
const NOT_STORED = 'bg-slate-800 text-slate-400 border-slate-700';

export type Stage = 'check' | 'stored' | 'rolled-back';

const badgeText = (report: RowReport, stage: Stage): string => {
  if (report.outcome === 'error') return KINDS.find((k) => k.status === report.status)?.label ?? 'Error';
  if (stage === 'rolled-back') return 'Not stored';
  if (stage === 'check') return { create: 'Create', update: 'Update', skip: 'Skip', error: 'Error' }[report.outcome];
  return { create: 'Created', update: 'Updated', skip: 'Skipped', error: 'Error' }[report.outcome];
};

/** The count cards: rows to create / update (or created / updated), skipped (when any) and errors. */
export const SummaryCards: React.FC<{ spec: BulkSpec; mode: BulkMode; reports: readonly RowReport[]; stage: Stage }> = ({ spec, mode, reports, stage }) => {
  const counts = countOutcomes(reports);
  const written = stage === 'rolled-back' ? 0 : counts[mode];
  const writeLabel =
    stage === 'check' ? `${mode === 'create' ? 'New' : 'Existing'} ${spec.plural} to ${mode}` : `${spec.plural[0].toUpperCase()}${spec.plural.slice(1)} ${mode === 'create' ? 'created' : 'updated'}`;
  const cards = [
    { id: 'write', label: writeLabel, value: written, Icon: mode === 'create' ? PlusCircle : RefreshCw, tone: mode === 'create' ? 'emerald' : 'sky' },
    ...(counts.skip > 0 ? [{ id: 'skip', label: 'Skipped', value: counts.skip, Icon: Clock, tone: 'slate' }] : []),
    { id: 'error', label: stage === 'check' ? 'Rows with errors' : 'Rows not stored (errors)', value: counts.error, Icon: XCircle, tone: 'rose' },
  ];
  const tone: Record<string, string> = {
    emerald: 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400',
    sky: 'bg-sky-950/20 border-sky-500/30 text-sky-300',
    slate: 'bg-slate-900/60 border-slate-800 text-slate-400',
    rose: 'bg-rose-950/20 border-rose-500/30 text-rose-400',
  };
  return (
    <dl aria-label="Batch summary" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map(({ id, label, value, Icon, tone: t }) => (
        <div key={id} className={`border rounded-xl p-3 flex items-center gap-3 ${tone[t]}`}>
          <Icon aria-hidden="true" className="w-5 h-5 shrink-0" />
          <div className="min-w-0">
            <dd className="text-2xl font-bold font-mono">{formatNumber(value)}</dd>
            <dt className="text-xs font-mono text-slate-400">{label}</dt>
          </div>
        </div>
      ))}
    </dl>
  );
};

/** The "Batch validation breakdown" pills and the rows they filter. */
export const RowsLog: React.FC<{ title: string; label: string; mode: BulkMode; reports: readonly RowReport[]; codes: readonly string[]; stage: Stage }> = ({
  title,
  label,
  mode,
  reports,
  codes,
  stage,
}) => {
  const [filter, setFilter] = useState<string>('all');
  const kindOf = (r: RowReport) => (KNOWN.has(r.status) ? r.status : OTHER);
  const count = (kind: string) => reports.filter((r) => kindOf(r) === kind).length;
  const pills = [
    { id: 'all', label: 'All rows', count: reports.length, tone: 'border-slate-700 bg-slate-800 text-slate-200' },
    ...KINDS.filter((k) => !k.mode || k.mode === mode).map((k) => ({ id: k.status, label: k.label, count: count(k.status), tone: k.tone })),
    ...(count(OTHER) > 0 ? [{ id: OTHER, label: 'Other', count: count(OTHER), tone: 'border-slate-700 bg-slate-800 text-slate-300' }] : []),
  ];
  const shown = reports.map((report, index) => ({ report, index })).filter(({ report }) => filter === 'all' || kindOf(report) === filter);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">Batch validation breakdown</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">{formatNumber(reports.length)} total</span>
      </div>
      <div role="group" aria-label="Filter the rows" className="flex flex-wrap gap-2">
        {pills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            aria-pressed={filter === pill.id}
            disabled={pill.count === 0 && pill.id !== 'all'}
            onClick={() => setFilter(pill.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border ${pill.tone} ${
              filter === pill.id ? 'ring-2 ring-indigo-500 font-bold' : pill.count === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
            }`}
          >
            <span>{pill.label}</span>
            <span className="px-1.5 rounded bg-black/40 text-[11px] font-bold">{formatNumber(pill.count)}</span>
          </button>
        ))}
      </div>
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 font-semibold">
          <span>{title}</span>
          <span className="text-slate-500">{formatNumber(reports.length)} rows evaluated</span>
        </div>
        <div className="max-h-72 overflow-auto">
          <table aria-label={label} className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 sticky top-0">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {shown.map(({ report, index }) => (
                <tr key={index} className={report.outcome === 'error' ? 'bg-rose-950/20' : undefined}>
                  <td className="px-3 py-1.5 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-1.5 font-bold text-white">{codes[index] ?? ''}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded border text-[11px] ${stage === 'rolled-back' && report.outcome !== 'error' ? NOT_STORED : BADGE[report.outcome]}`}>
                      {badgeText(report, stage)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-rose-300">{report.messages.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/** The result banner: stored in full (green), stored with refused rows (amber), or nothing stored (red); and the count line. */
export const ResultBanner: React.FC<{ spec: BulkSpec; reports: readonly RowReport[]; committed: boolean; successful: number; failed: number }> = ({
  spec,
  reports,
  committed,
  successful,
  failed,
}) => {
  const counts = countOutcomes(reports);
  const state = !committed ? 'none' : failed > 0 ? 'partial' : 'all';
  const tone = { all: 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300', partial: 'bg-amber-950/30 border-amber-500/40 text-amber-300', none: 'bg-rose-950/30 border-rose-500/40 text-rose-300' }[state];
  const Icon = { all: CheckCircle2, partial: AlertTriangle, none: XCircle }[state];
  const stored = committed ? successful : 0;
  const line = [
    `${formatNumber(committed ? counts.create : 0)} created`,
    `${formatNumber(committed ? counts.update : 0)} updated`,
    `${formatNumber(counts.skip)} skipped`,
    `${formatNumber(counts.error)} failed`,
  ].join(' · ');
  return (
    <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${tone}`}>
      <Icon aria-hidden="true" className="w-6 h-6 shrink-0" />
      <div>
        <p role="status" className="font-bold text-base text-white">
          {committed
            ? `${formatNumber(stored)} ${stored === 1 ? spec.noun : spec.plural} stored${failed ? `; ${formatNumber(failed)} rows were not.` : '.'}`
            : `Nothing was stored: ${formatNumber(failed)} rows failed. Check the rows again.`}
        </p>
        <p className="text-xs text-slate-300 mt-0.5 font-mono">{line}</p>
      </div>
    </div>
  );
};
