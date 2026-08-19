import React, { useState } from 'react';
import {
  Users2,
  Users,
  Film,
  Search,
  Plus,
  Target,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useTeams } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Link } from 'react-router-dom';

export const TeamsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data: teams, isLoading } = useTeams();

  const filtered = (teams || []).filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.department_name.toLowerCase().includes(search.toLowerCase()) ||
      t.focus_discipline.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Production Squads & Teams</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {teams?.length || 0} Active Squads
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Specialized sequence and asset squads dedicated to hero milestones and high-complexity shot packages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search squads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-56"
            />
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((team) => (
          <div
            key={team.id}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{team.name}</h3>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                      {team.code}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono mt-0.5 block">
                    {team.department_name}
                  </span>
                </div>

                <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 text-[10px] font-mono border border-slate-800 flex items-center gap-1">
                  <Film className="w-3 h-3 text-indigo-400" />
                  {team.current_project_code}
                </span>
              </div>

              {/* Squad Lead & Discipline Focus */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={team.lead_avatar}
                      alt={team.lead_name}
                      className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-700"
                    />
                    <div>
                      <span className="font-semibold text-white block">{team.lead_name}</span>
                      <span className="text-[10px] font-mono text-indigo-400">Squad Lead</span>
                    </div>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-500" />
                    {team.member_count} Artists
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Target className="w-3 h-3 text-indigo-400" />
                    Focus Discipline:
                  </span>
                  <p className="text-xs text-slate-200 mt-1 font-medium">{team.focus_discipline}</p>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-500">
                Assigned to Show [{team.current_project_code}]
              </span>
              <Link
                to="/tasks"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                View Squad Board
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
