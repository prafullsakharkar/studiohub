import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, Eye } from 'lucide-react';
import { useClients } from '@/modules/clients/hooks/useClientsData';
import { useClientMutations } from '@/modules/clients/hooks/useClientsData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { EmptyState } from '@/shared/components/EmptyState';

export const ClientsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useClients();
  const { archiveClient, restoreClient } = useClientMutations();

  const clients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.items ?? [];
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Client Studios</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {data?.items?.length ?? 0} Registered
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Production client studios and partner facilities on the flat directory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="w-56"
          />
          <Link to="/clients/new">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Client
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12">
          <EmptyState
            icon={<Search className="w-6 h-6 text-slate-400" />}
            title={search ? 'No clients match your search' : 'No clients registered yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Register a client studio to track production engagements.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white truncate">{client.name}</span>
                    {client.code && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-950 font-mono text-[10px] font-bold text-indigo-300 border border-indigo-500/30 shrink-0">
                        {client.code}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {[client.city, client.country].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono shrink-0 ${
                    client.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : client.status === 'Archived'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {client.status || 'Active'}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                {client.description || 'No description provided.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                <Link to={`/clients/${client.id}`}>
                  <Button size="xs" variant="outline" leftIcon={<Eye className="w-3 h-3" />}>
                    Open
                  </Button>
                </Link>
                <div className="flex items-center gap-2">
                  {client.status === 'Archived' ? (
                    <button
                      type="button"
                      onClick={() => restoreClient.mutate(client.id)}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => archiveClient.mutate(client.id)}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
