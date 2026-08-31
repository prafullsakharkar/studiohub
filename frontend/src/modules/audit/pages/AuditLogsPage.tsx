import React, { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { Card, CardBody } from '@/shared/components/Card';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { ActivityTimeline } from '@/shared/activity/ActivityTimeline';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import {
  ShieldAlert,
  Search,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
  Clock,
  ArrowRight,
  Filter,
  Activity,
  ShieldCheck,
  Sparkles,
  Layers,
  Database,
  Lock,
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'timeline' | 'tabular'>('timeline');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const { activities } = useActivityStore();
  const { data, isLoading } = useAuditLogs({
    page,
    page_size: 10,
    search: search || undefined,
    action: actionFilter !== 'ALL' ? actionFilter : undefined,
  });

  const logs = data?.results || [];
  const totalCount = data?.count || 0;

  const actions = ['ALL', 'APPROVE', 'PUBLISH', 'UPDATE', 'CREATE', 'LOGIN', 'DELETE'];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'APPROVE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'PUBLISH':
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'UPDATE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'CREATE':
        return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
      case 'DELETE':
      case 'REJECT':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Enterprise Activity & Audit Trail
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SOC2 Type II / TPN Studio Compliant
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  {activities.length} Recorded Events
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable log of supervisor approvals, shot handoffs, team deployments, and granular state transitions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg shadow-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Immutable Ledger Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Activity Events</div>
          <div className="text-xl font-bold text-white mt-1 font-mono">{activities.length}</div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Signoff Approvals</div>
          <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">
            {activities.filter((a) => a.action === 'approve' || a.action === 'review').length}
          </div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400">Team Assignments</div>
          <div className="text-xl font-bold text-indigo-300 mt-1 font-mono">
            {activities.filter((a) => a.action === 'assign').length}
          </div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Publishes & Turnovers</div>
          <div className="text-xl font-bold text-cyan-300 mt-1 font-mono">
            {activities.filter((a) => a.action === 'upload' || a.action === 'create').length}
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            viewMode === 'timeline'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Interactive Timeline & Diff Engine</span>
        </button>
        <button
          onClick={() => setViewMode('tabular')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            viewMode === 'tabular'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Compliance Table</span>
        </button>
      </div>

      {/* Mode 1: Interactive ActivityTimeline Component */}
      {viewMode === 'timeline' && (
        <ActivityTimeline
          title="Enterprise Audit & Timeline Feed"
          showFilters={true}
          showSearch={true}
          showExport={true}
        />
      )}

      {/* Mode 2: Structured Tabular View */}
      {viewMode === 'tabular' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <SearchInput
                className="w-full sm:w-80"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onClear={() => {
                  setSearch('');
                  setPage(1);
                }}
                placeholder="Search by user, entity code, or action..."
              />

              <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto">
                {actions.map((act) => (
                  <button
                    key={act}
                    onClick={() => {
                      setActionFilter(act);
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      actionFilter === act
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <LoadingSpinner size="lg" label="Retrieving secure immutable audit records..." />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="w-8 h-8 text-indigo-400" />}
              title="No Audit Records Found"
              description="There are no security or pipeline events matching your filter query."
            />
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="p-3.5 font-semibold">Timestamp</th>
                        <th className="p-3.5 font-semibold">User & Identity</th>
                        <th className="p-3.5 font-semibold">Action</th>
                        <th className="p-3.5 font-semibold">Target Entity</th>
                        <th className="p-3.5 font-semibold">Audit Narrative</th>
                        <th className="p-3.5 font-semibold">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-white">{log.user_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{log.user_email}</div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getActionBadge(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono text-indigo-400 font-bold">{log.entity_code}</span>
                            <span className="text-slate-500 text-[11px] block">{log.entity_type}</span>
                          </td>
                          <td className="p-3.5 text-slate-300 max-w-md">
                            {log.description}
                          </td>
                          <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                            {log.ip_address}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Pagination
                currentPage={page}
                totalCount={totalCount}
                pageSize={10}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};
