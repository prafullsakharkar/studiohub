import React from 'react';
import { Film, FolderPlus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface DashboardEmptyStateProps {
  onSelectProjectPrompt?: () => void;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = () => {
  return (
    <div
      id="dashboard-empty-state"
      className="flex-1 flex flex-col items-center justify-center min-h-[65vh] p-6 text-center bg-slate-950 text-slate-100"
    >
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-xl shadow-indigo-500/5">
        <Film className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono mb-3">
        <span className="w-2 h-2 rounded-full bg-indigo-400" />
        Project Scope Required
      </div>

      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">No Project Selected</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        Select a project from the toolbar above to load the VFX Production Command Center and view real-time telemetry, shot matrices, task velocity, and review queues.
      </p>

      <div className="flex items-center gap-3">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-600/20"
        >
          <FolderPlus className="w-4 h-4" />
          Browse Projects Catalog
        </Link>
        <button
          type="button"
          onClick={() => {
            const btn = document.getElementById('project-switcher-btn');
            if (btn) btn.click();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
        >
          Open Project Switcher
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
