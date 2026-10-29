import React from 'react';
import { Activity, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/Button';
import { HEALTH_PROBES, useApiHealth } from '../health/useApiHealth';
import type { ProbeState } from '../health/useApiHealth';
import { useVersionInfo } from '../health/useVersionInfo';

const STATE_STYLE: Record<ProbeState, { label: string; className: string }> = {
  operational: { label: 'Operational', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  slow: { label: 'Slow', className: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  restricted: { label: 'Reachable, not permitted', className: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  down: { label: 'Down', className: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
  pending: { label: 'Checking…', className: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
};

export const ApiHealthPage: React.FC = () => {
  const { results, isChecking, checkNow } = useApiHealth();
  const version = useVersionInfo();
  const down = HEALTH_PROBES.filter((p) => results[p.id].state === 'down').length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-y-auto">
      <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/platform/admin">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Platform Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              API health
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live checks made from your browser right now: status code and response time of each request. Refreshes every 30 seconds.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {version.data && (
            <span className="font-mono text-slate-400">
              Backend {version.data.version} · {version.data.environment}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => void checkNow()} disabled={isChecking} leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />}>
            Check now
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 w-full space-y-3">
        <p role="status" className={`text-sm font-semibold ${down ? 'text-rose-300' : 'text-emerald-400'}`}>
          {down === 0 ? 'All checked endpoints answered.' : `${down} of ${HEALTH_PROBES.length} checks failed.`}
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-2 font-semibold">Check</th>
                <th className="px-4 py-2 font-semibold">Request</th>
                <th className="px-4 py-2 font-semibold">Result</th>
                <th className="px-4 py-2 font-semibold text-right">HTTP</th>
                <th className="px-4 py-2 font-semibold text-right">Time</th>
                <th className="px-4 py-2 font-semibold text-right">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {HEALTH_PROBES.map((probe) => {
                const r = results[probe.id];
                const style = STATE_STYLE[r.state];
                return (
                  <tr key={probe.id}>
                    <td className="px-4 py-2 text-slate-200">{probe.label}</td>
                    <td className="px-4 py-2 font-mono text-slate-400">GET {probe.path}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded border px-2 py-0.5 font-semibold ${style.className}`}>{style.label}</span>
                      {r.error && <span className="ml-2 text-slate-500">{r.error}</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{r.status ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.latencyMs !== null ? `${r.latencyMs} ms` : '—'}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500">{r.checkedAt ? r.checkedAt.toLocaleTimeString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
