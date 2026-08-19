import React, { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { Card, CardBody } from '@/shared/components/Card';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
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
} from 'lucide-react';
import { AuditLog } from '@/mocks/db/audit/auditLogs';

export const AuditLogsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Security & Pipeline Audit Trail</h1>
          <p className="text-xs text-slate-400">
            Immutable log of all supervisor approvals, shot handoffs, version publications, and access events
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
          <ShieldAlert className="w-4 h-4" />
          <span>SOC2 Type II / TPN Studio Compliant</span>
        </div>
      </div>

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
  );
};
