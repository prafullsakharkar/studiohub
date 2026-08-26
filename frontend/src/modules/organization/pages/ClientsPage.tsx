import React, { useState } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  Building,
  Mail,
  Phone,
  Film,
  DollarSign,
  Shield,
  ExternalLink,
  Filter,
  Download,
  Archive,
  RotateCcw,
  Edit,
  Eye,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { useClients, useClientMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';
import { Link, useNavigate } from 'react-router-dom';

export const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [studioTypeFilter, setStudioTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Archived' | 'Prospective'>('ALL');

  const { data: clientsData, isLoading } = useClients({ search });
  const { archiveClient, restoreClient, deleteClient } = useClientMutations();

  const clients = clientsData?.results || [];
  const filtered = clients.filter((c) => {
    const matchType = studioTypeFilter === 'ALL' || c.studio_type === studioTypeFilter;
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchType && matchStatus;
  });

  const totalBilledSum = clients.reduce((acc, c) => acc + (c.total_billed_usd || 0), 0);

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(clients, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `studio_clients_portfolio_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Client Studios & Production Accounts</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {clients.length} Accounts
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organization-level studio entities, executive producer contacts, production turnover slates, and review portals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Portfolio
          </Button>

          <Link to="/clients/new">
            <Button
              size="sm"
              variant="primary"
              className="text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Client
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Total Client Accounts</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{clients.length}</div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Cumulative Billed Revenue</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            ${(totalBilledSum / 1000000).toFixed(2)}M
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Active Productions</div>
          <div className="text-2xl font-bold font-mono text-indigo-300 mt-1">
            {new Set(clients.flatMap((c) => c.active_projects)).size} Shows
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Review Portal Entitlements</div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
            {clients.filter((c) => c.portal_access).length} Enrolled
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'Major Studio', 'Streaming Platform', 'Independent Producer', 'Game Publisher'].map((type) => (
            <button
              key={type}
              onClick={() => setStudioTypeFilter(type)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                studioTypeFilter === type
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              )}
            >
              {type === 'ALL' ? 'All Studio Categories' : type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-hidden font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Prospective">Prospective</option>
            <option value="Archived">Archived</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, code, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-56 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            No client studios match your current filter criteria.
          </div>
        ) : (
          filtered.map((client) => {
            const isArchived = client.status === 'Archived';
            return (
              <div
                key={client.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-base font-mono shrink-0 shadow-inner">
                        {client.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/clients/${client.id}`}
                            className="font-bold text-sm text-white hover:text-indigo-400 transition-colors"
                          >
                            {client.name}
                          </Link>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {client.studio_type} • {client.headquarters}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <Badge
                        variant={isArchived ? 'secondary' : client.status === 'Active' ? 'success' : 'warning'}
                        className="text-[10px]"
                      >
                        {client.status}
                      </Badge>
                      {client.portal_access && (
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Portal Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Contact & Slate */}
                  <div className="mt-4 space-y-3">
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 text-[11px] font-mono">Liaison Contact:</span>
                        <span className="font-semibold text-white">{client.contact_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] pt-1 border-t border-slate-900">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-indigo-400" />
                          {client.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-indigo-400" />
                          {client.phone}
                        </span>
                      </div>
                    </div>

                    {/* Active Shows */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 text-[11px] flex items-center gap-1.5 font-mono">
                        <Film className="w-3.5 h-3.5 text-indigo-400" />
                        Active Shows ({client.active_projects.length}):
                      </span>
                      <div className="flex flex-wrap items-center gap-1 justify-end">
                        {client.active_projects.map((proj) => (
                          <span
                            key={proj}
                            className="px-2 py-0.5 rounded bg-slate-950 text-indigo-300 text-[10px] font-mono border border-slate-800"
                          >
                            {proj}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Tier: <strong className="text-slate-200">{client.contract_tier}</strong>
                    </span>
                    <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                      ${(client.total_billed_usd / 1000000).toFixed(2)}M Lifetime
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link to={`/clients/${client.id}/edit`}>
                      <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white p-1.5">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (isArchived) restoreClient.mutate(client.id);
                        else archiveClient.mutate(client.id);
                      }}
                      className="text-xs text-slate-400 hover:text-amber-400 p-1.5"
                      title={isArchived ? 'Restore' : 'Archive'}
                    >
                      {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </Button>

                    <Link to={`/clients/${client.id}`}>
                      <Button size="sm" variant="outline" className="text-xs flex items-center gap-1">
                        Workspace <Eye className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
