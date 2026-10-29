import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface DashboardErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

export const DashboardErrorState: React.FC<DashboardErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div
      id="dashboard-error-state"
      className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-slate-950 text-slate-100"
    >
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-xl shadow-rose-500/5">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-3">
        Telemetry Retrieval Error
      </div>

      <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Failed to Load Project Dashboard</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        {error?.message ||
          'The project may not exist in your active organization, or your user account lacks required permissions.'}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Telemetry Query
        </button>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
          Select Another Project
        </Link>
      </div>
    </div>
  );
};
