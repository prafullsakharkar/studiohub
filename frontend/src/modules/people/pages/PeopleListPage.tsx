import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, Eye, Trash2 } from 'lucide-react';
import { usePeople, usePersonMutations } from '@/modules/people/hooks/usePeopleData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { EmptyState } from '@/shared/components/EmptyState';

export const PeopleListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data, isLoading } = usePeople();
  const { deletePerson } = usePersonMutations();

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.items ?? [];
    if (!q) return list;
    return list.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.role?.toLowerCase().includes(q) ||
        p.department_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">People Directory</h1>
            <Badge variant="outline" className="font-mono text-xs text-cyan-300 border-cyan-500/30">
              {data?.items?.length ?? 0} Registered
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Studio crew, artists and supervisors on the flat directory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="w-56"
          />
          <Link to="/people/new">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Person
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : people.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12">
          <EmptyState
            icon={<Search className="w-6 h-6 text-slate-400" />}
            title={search ? 'No people match your search' : 'No people registered yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Add crew members to track assignments and availability.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person) => (
            <div
              key={person.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white truncate">{person.full_name}</span>
                    {person.role && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/30 shrink-0">
                        {person.role}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5 truncate">
                    {[person.department_name, person.team_name].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono shrink-0 ${
                    person.availability_status === 'Available'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : person.availability_status === 'On Leave'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {person.availability_status || 'Unknown'}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                {person.email || 'No email provided.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                <Link to={`/people/${person.id}`}>
                  <Button size="xs" variant="outline" leftIcon={<Eye className="w-3 h-3" />}>
                    Open
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => deletePerson.mutate(person.id)}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
