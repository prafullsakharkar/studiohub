import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users2,
  Search,
  Plus,
  ArrowRight,
  ExternalLink,
  Edit,
  Trash2,
  Clock,
  BarChart3,
  Shield,
} from 'lucide-react';
import { useTeams, useTeamMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';

export const TeamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();
  const [search, setSearch] = useState('');

  const { data: teams, isLoading } = useTeams();
  const { deleteTeam } = useTeamMutations();

  const filteredTeams = (teams || []).filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.lead_name.toLowerCase().includes(search.toLowerCase()) ||
      t.department_name.toLowerCase().includes(search.toLowerCase()) ||
      t.focus_discipline.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenWorkspace = (t: any) => {
    openTab(
      {
        id: t.id,
        title: t.name,
        type: 'team',
        code: t.code,
      },
      t.name
    );
    navigate(`/teams/${t.id}`);
  };

  const handleDelete = (t: any) => {
    if (window.confirm(`Are you sure you want to delete squad ${t.name}?`)) {
      deleteTeam.mutate(t.id);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Production Teams & Strike Pods</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {teams?.length || 0} Squads Active
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Multidisciplinary artist squads, pod leads, project allocations, and sprint throughput.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/teams/new" className="inline-flex">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Create Team Squad
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search teams, codes, leads, disciplines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-full"
          />
        </div>
      </div>

      {/* Teams Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <Users2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No teams found</p>
          <p className="text-xs text-slate-500 mt-1">Assemble a strike squad to coordinate specialized shot work.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        onClick={() => handleOpenWorkspace(team)}
                        className="font-bold text-sm text-white hover:text-indigo-300 cursor-pointer transition-colors"
                      >
                        {team.name}
                      </h3>
                      <span className="text-[10px] font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded">
                        {team.code}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Lead: {team.lead_name} • {team.department_name}
                    </span>
                  </div>

                  <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                    {team.member_count} crew
                  </Badge>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-2">{team.description}</p>

                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="text-slate-500 font-mono">Focus:</span>
                  <span className="text-slate-300 font-medium">{team.focus_discipline}</span>
                </div>

                {/* Show & Capacity */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Show:</span>
                    <span className="text-indigo-400 font-bold">{team.current_project_code}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-emerald-400">
                    <BarChart3 className="w-3 h-3" />
                    <span>{team.utilization_percentage || 85}% util</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleOpenWorkspace(team)}
                  rightIcon={<ExternalLink className="w-3 h-3" />}
                  className="text-[11px]"
                >
                  Workspace
                </Button>

                <div className="flex items-center gap-1">
                  <Link to={`/teams/${team.id}/edit`}>
                    <Button size="xs" variant="ghost" className="p-1.5" title="Edit Team">
                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </Link>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="p-1.5 text-rose-400 hover:bg-rose-950/30"
                    onClick={() => handleDelete(team)}
                    title="Delete Team"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
