import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, Eye, Trash2 } from 'lucide-react';
import { useTeams, useTeamMutations } from '@/modules/teams/hooks/useTeamsData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { EmptyState } from '@/shared/components/EmptyState';

export const TeamsListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTeams();
  const { deleteTeam } = useTeamMutations();

  const teams = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.items ?? [];
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.lead_name?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Teams</h1>
            <Badge variant="outline" className="font-mono text-xs text-emerald-300 border-emerald-500/30">
              {data?.items?.length ?? 0} Registered
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Specialized artist squads assembled for sequence delivery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="w-56"
          />
          <Link to="/teams/new">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Team
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12">
          <EmptyState
            icon={<Search className="w-6 h-6 text-slate-400" />}
            title={search ? 'No teams match your search' : 'No teams assembled yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Assemble artist squads and deploy them to active projects.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white truncate">{team.name}</span>
                    {team.code && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/30 shrink-0">
                        {team.code}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {team.lead_name ? `Lead: ${team.lead_name}` : 'No lead assigned'}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0 text-emerald-300 border-emerald-500/30">
                  {team.member_count ?? 0} Members
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                <Link to={`/teams/${team.id}`}>
                  <Button size="xs" variant="outline" leftIcon={<Eye className="w-3 h-3" />}>
                    Open
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => deleteTeam.mutate({ id: team.id, name: team.name, code: team.code })}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
