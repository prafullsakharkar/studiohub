import type React from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PartialMembership } from '@/core/permissions/access';

export interface DashboardPartialAccessProps {
  limitedTo: PartialMembership;
}

const WHAT: Record<PartialMembership, string> = {
  show: 'Your membership of this project is limited to one show.',
  department: 'Your membership of this project is limited to one department.',
  external: 'You take part in this project as a partner studio or client.',
};

/**
 * The project dashboard sums up the whole project, so the server shows it only to members of the whole project
 * (TM-002). A member limited to a show, a department or a partner side is told so instead of an error.
 */
export const DashboardPartialAccess: React.FC<DashboardPartialAccessProps> = ({ limitedTo }) => (
  <div
    id="dashboard-partial-access"
    className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-slate-950 text-slate-100"
  >
    <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-300 mb-4">
      <Layers className="w-8 h-8" />
    </div>
    <h2 className="text-xl font-bold text-white mb-2 tracking-tight">The project dashboard covers the whole project</h2>
    <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
      {WHAT[limitedTo]} The shots, tasks and versions you work on are in their lists.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-3">
      {[
        ['/shots', 'Shots'],
        ['/tasks', 'Tasks'],
        ['/versions', 'Versions'],
      ].map(([to, label]) => (
        <Link
          key={to}
          to={to}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
        >
          {label}
        </Link>
      ))}
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
