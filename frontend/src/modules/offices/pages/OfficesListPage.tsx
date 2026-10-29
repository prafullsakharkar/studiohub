import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Search, Eye, Trash2 } from 'lucide-react';
import { useOffices, useOfficeMutations } from '@/modules/offices/hooks/useOfficesData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { EmptyState } from '@/shared/components/EmptyState';

export const OfficesListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useOffices();
  const { deleteOffice } = useOfficeMutations();

  const offices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.items ?? [];
    if (!q) return list;
    return list.filter(
      (o) =>
        o.name?.toLowerCase().includes(q) ||
        o.code?.toLowerCase().includes(q) ||
        o.city?.toLowerCase().includes(q) ||
        o.country?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Offices</h1>
            <Badge variant="outline" className="font-mono text-xs text-amber-300 border-amber-500/30">
              {data?.items?.length ?? 0} Registered
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Geographic studio facilities and remote hubs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            placeholder="Search offices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="w-56"
          />
          <Link to="/offices/new">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Office
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : offices.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12">
          <EmptyState
            icon={<Search className="w-6 h-6 text-slate-400" />}
            title={search ? 'No offices match your search' : 'No offices registered yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Register geographic facilities to track distributed crew.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offices.map((office) => (
            <div
              key={office.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white truncate">{office.name}</span>
                    {office.code && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-950 font-mono text-[10px] font-bold text-amber-300 border border-amber-500/30 shrink-0">
                        {office.code}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {[office.city, office.country].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono shrink-0 ${
                    office.is_headquarters
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {office.is_headquarters ? 'HQ' : 'Hub'}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                {office.timezone ? `Timezone: ${office.timezone}` : 'No timezone configured.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                <Link to={`/offices/${office.id}`}>
                  <Button size="xs" variant="outline" leftIcon={<Eye className="w-3 h-3" />}>
                    Open
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => deleteOffice.mutate({ id: office.id, name: office.name, code: office.code })}
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
