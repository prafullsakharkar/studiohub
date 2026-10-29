import React, { useState, useMemo } from 'react';
import { useChangeLogs, useRecordChangeLog } from '../hooks/useAudit';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { ChangeLog } from '@/types/audit';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Eye,
  FileCode,
  FileDiff,
  FileText,
  Filter,
  GitCommit,
  Layers,
  Plus,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';

export const ChangeLogsPage: React.FC = () => {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'audit_change_logs',
    defaultPage: 1,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('ALL');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<ChangeLog | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // New Record State
  const [newLogData, setNewLogData] = useState({
    entity_type: 'shot',
    entity_id: 'shot-101',
    entity_name: 'SH_010_020',
    change_type: 'updated',
    field: 'status',
    before_value: 'In Progress',
    after_value: 'Approved',
    user_name: 'Lead Supervisor',
    comment: 'Approved lighting pass following client review session',
  });

  const recordMutation = useRecordChangeLog();

  const { data, isLoading, refetch, isFetching } = useChangeLogs({
    page,
    page_size: pageSize,
    search: search || undefined,
    entity_type: entityTypeFilter !== 'ALL' ? entityTypeFilter : undefined,
  });

  const allLogs = data?.results || [];
  const totalCount = data?.count || 0;

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (changeTypeFilter !== 'ALL' && log.change_type !== changeTypeFilter) {
        return false;
      }
      return true;
    });
  }, [allLogs, changeTypeFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = allLogs.length;
    const statusChanges = allLogs.filter((l) => l.change_type === 'status_changed').length;
    const updates = allLogs.filter((l) => l.change_type === 'updated').length;
    const creations = allLogs.filter((l) => l.change_type === 'created').length;
    return { total, statusChanges, updates, creations };
  }, [allLogs]);

  const handleRecordLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordMutation.mutateAsync({
        entity_type: newLogData.entity_type,
        entity_id: newLogData.entity_id,
        entity_name: newLogData.entity_name,
        change_type: newLogData.change_type,
        user_name: newLogData.user_name,
        comment: newLogData.comment,
        diff: [
          {
            field: newLogData.field,
            before: newLogData.before_value,
            after: newLogData.after_value,
            label: newLogData.field.toUpperCase(),
          },
        ],
      });

      setIsRecordModalOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to record change log', err);
    }
  };

  const getChangeBadge = (type: string) => {
    switch (type) {
      case 'created':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'updated':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'status_changed':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'deleted':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  };

  const entityTypes = ['ALL', 'shot', 'asset', 'task', 'sequence', 'project', 'user'];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileDiff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Entity Change Logs & Field Diffs
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Granular State Versioning
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                  {totalCount} Total Diffs
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit trail of before-and-after attribute values across shots, assets, tasks, and project entities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
              title="Refresh change logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
</div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Mutations</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{totalCount}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Status Transitions</div>
            <div className="text-xl font-bold text-amber-300 mt-1 font-mono">{metrics.statusChanges}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400">Field Updates</div>
            <div className="text-xl font-bold text-blue-300 mt-1 font-mono">{metrics.updates}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Creations</div>
            <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">{metrics.creations}</div>
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
              placeholder="Search by entity name, user, comment..."
            />

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Entity Type Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
                {entityTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setEntityTypeFilter(t);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors uppercase text-[11px] ${
                      entityTypeFilter === t
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Change Type Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', 'status_changed', 'updated', 'created', 'deleted'].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setChangeTypeFilter(c);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors text-[11px] ${
                      changeTypeFilter === c
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <LoadingSpinner size="lg" message="Loading entity change history..." />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<FileDiff className="w-6 h-6 text-indigo-400" />}
                title="No change logs found"
                description={
                  search || entityTypeFilter !== 'ALL' || changeTypeFilter !== 'ALL'
                    ? 'No change logs match your current filter parameters.'
                    : 'No entity mutations recorded yet. Edit a shot, task, or asset to see granular field diffs.'
                }
                action={
                  undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filteredLogs.map((log, idx) => {
                const logKey = log.id || log.uuid || `log-${idx}`;
                const isExpanded = !!expandedRows[logKey];
                return (
                  <div key={logKey} className="p-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleRow(logKey)}
                          className="mt-0.5 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap font-mono">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase ${getChangeBadge(
                                log.change_type
                              )}`}
                            >
                              {log.change_type}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px] border border-slate-700 uppercase">
                              {log.entity_type}
                            </span>
                            <span className="font-bold text-white text-sm">
                              {log.entity_name}
                            </span>
                            <span className="text-xs text-slate-500">({log.entity_id})</span>
                          </div>

                          {log.comment && (
                            <p className="text-xs text-slate-300 mt-1.5 italic">
                              "{log.comment}"
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 font-mono">
                            <span className="flex items-center gap-1 text-indigo-400">
                              <User className="w-3 h-3" />
                              {log.user_name || 'System Auto-Trigger'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(log.created_at || Date.now()).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center shrink-0">
                        <button
                          onClick={() => toggleRow(log.id)}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors font-mono"
                        >
                          {isExpanded ? 'Hide Diff' : `View Diff (${log.diff?.length || 0})`}
                        </button>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 border border-slate-700 transition-colors"
                          title="View Full JSON Record"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Diff Table */}
                    {isExpanded && log.diff && log.diff.length > 0 && (
                      <div className="mt-3 pl-8 pr-2">
                        <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden font-mono text-xs">
                          <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase flex items-center justify-between">
                            <span>Field Changes</span>
                            <span>Before &rarr; After</span>
                          </div>
                          <div className="divide-y divide-slate-800/80">
                            {log.diff.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40"
                              >
                                <div>
                                  <span className="font-semibold text-white">{item.label}</span>
                                  <span className="text-[11px] text-slate-500 ml-2">
                                    ({item.field})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2.5 flex-wrap text-[11px]">
                                  <span className="line-through text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                                    {String(item.before ?? 'None')}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                  <span className="text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 font-semibold">
                                    {String(item.after ?? 'None')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/60">
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>

      {/* View JSON Record Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Mutation Record: ${selectedLog.entity_name}`}
          subtitle={`Type: ${selectedLog.entity_type} • Action: ${selectedLog.change_type} • ID: ${selectedLog.id}`}
          size="xl"
          footer={
            <Button variant="secondary" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3 font-mono text-xs text-slate-300">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto max-h-80">
              <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Manual Change Modal */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title="Record Entity Mutation"
          subtitle="Audit-log a manual state mutation or supervisor attribute override"
          size="lg"
        >
          <form onSubmit={handleRecordLog} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Entity Type</label>
                <select
                  value={newLogData.entity_type}
                  onChange={(e) => setNewLogData({ ...newLogData, entity_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value="shot">shot</option>
                  <option value="asset">asset</option>
                  <option value="task">task</option>
                  <option value="sequence">sequence</option>
                  <option value="project">project</option>
                  <option value="user">user</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Change Type</label>
                <select
                  value={newLogData.change_type}
                  onChange={(e) => setNewLogData({ ...newLogData, change_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value="updated">updated</option>
                  <option value="status_changed">status_changed</option>
                  <option value="created">created</option>
                  <option value="deleted">deleted</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Entity Name</label>
                <input
                  type="text"
                  value={newLogData.entity_name}
                  onChange={(e) => setNewLogData({ ...newLogData, entity_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  placeholder="e.g. SH_010_020"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Entity ID</label>
                <input
                  type="text"
                  value={newLogData.entity_id}
                  onChange={(e) => setNewLogData({ ...newLogData, entity_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  placeholder="e.g. shot-101"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Field Name</label>
                <input
                  type="text"
                  value={newLogData.field}
                  onChange={(e) => setNewLogData({ ...newLogData, field: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Before Value</label>
                <input
                  type="text"
                  value={newLogData.before_value}
                  onChange={(e) => setNewLogData({ ...newLogData, before_value: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">After Value</label>
                <input
                  type="text"
                  value={newLogData.after_value}
                  onChange={(e) => setNewLogData({ ...newLogData, after_value: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Modifier Identity</label>
              <input
                type="text"
                value={newLogData.user_name}
                onChange={(e) => setNewLogData({ ...newLogData, user_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Audit Comment / Reason</label>
              <textarea
                value={newLogData.comment}
                onChange={(e) => setNewLogData({ ...newLogData, comment: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-indigo-500"
                placeholder="Reason for state transition or attribute override..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsRecordModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={recordMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {recordMutation.isPending ? 'Recording...' : 'Commit Change Log'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
