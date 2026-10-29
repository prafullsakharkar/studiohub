import React from 'react';
import { Film, ArrowUpRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShotsData } from '../types';

export interface ShotStatusMatrixProps {
  shotsData: DashboardShotsData;
  projectId: string;
}

const VFX_STATUSES = [
  { key: 'Not Started', label: 'Not Started', color: 'bg-slate-700 text-slate-300 border-slate-600' },
  { key: 'In Progress', label: 'In Progress', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { key: 'Internal Review', label: 'Internal Review', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  { key: 'Client Review', label: 'Client Review', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { key: 'Approved', label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'Final', label: 'Final', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  { key: 'On Hold', label: 'On Hold', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
];

export const ShotStatusMatrix: React.FC<ShotStatusMatrixProps> = ({ shotsData, projectId }) => {
  const navigate = useNavigate();
  const total = shotsData.total || 1;

  const handleStatusClick = (statusKey: string) => {
    navigate(`/shots?project=${projectId}&status=${encodeURIComponent(statusKey)}`);
  };

  return (
    <div id="dashboard-shot-status-matrix" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Shot Pipeline Breakdown</h2>
            <p className="text-[11px] text-slate-400">Interactive stage filters for active project sequence shots</p>
          </div>
        </div>

        <Link
          to={`/shots?project=${projectId}`}
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-mono transition-colors"
        >
          View All Matrix ({shotsData.total})
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* VFX Status Distribution Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {VFX_STATUSES.map((status) => {
          const count = shotsData.by_status[status.key] || 0;
          const percentage = Math.round((count / total) * 100);

          return (
            <button
              key={status.key}
              type="button"
              onClick={() => handleStatusClick(status.key)}
              title={`Filter shots by status: ${status.label}`}
              className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="text-[10px] text-slate-400 truncate group-hover:text-slate-200">
                {status.label}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-white font-mono group-hover:text-indigo-300 transition-colors">
                  {count}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{percentage}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden mt-1.5 border border-slate-800">
                <div
                  className={`h-full rounded-full ${
                    status.key === 'Approved' || status.key === 'Final'
                      ? 'bg-emerald-400'
                      : status.key === 'In Progress' || status.key === 'Internal Review'
                      ? 'bg-sky-400'
                      : status.key === 'On Hold'
                      ? 'bg-amber-400'
                      : 'bg-slate-700'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent Shots Queue */}
      <div className="space-y-2 pt-2">
        <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider flex items-center justify-between">
          <span>Active Sequences &amp; Shot Roster</span>
          <span className="text-[10px] text-slate-400 font-normal">Most recent turnarounds</span>
        </h3>

        {shotsData.recent_shots.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            No shots created yet for this project.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                  <th className="pb-2 font-medium">Shot Code</th>
                  <th className="pb-2 font-medium">Sequence</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Artist</th>
                  <th className="pb-2 font-medium">Version</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {shotsData.recent_shots.slice(0, 5).map((shot) => (
                  <tr key={shot.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 text-white font-bold flex items-center gap-2">
                      {shot.thumbnail_url && (
                        <img
                          src={shot.thumbnail_url}
                          alt={shot.code}
                          className="w-7 h-4.5 rounded object-cover border border-slate-700 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span>{shot.code}</span>
                    </td>
                    <td className="py-2 text-slate-400">{shot.sequence_code || '—'}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          shot.status === 'Approved' || shot.status === 'Final'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : shot.status === 'In Progress'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {shot.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-300">{shot.assigned_artist_name || 'Unassigned'}</td>
                    <td className="py-2 text-indigo-400">{shot.current_version || '—'}</td>
                    <td className="py-2 text-right">
                      <Link
                        to={`/shots/${shot.id}`}
                        className="text-indigo-400 hover:text-indigo-300 hover:underline text-[11px]"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
