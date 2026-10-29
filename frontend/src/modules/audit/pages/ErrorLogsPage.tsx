import React, { useState, useMemo } from 'react';
import { useErrorLogs, useResolveErrorLog, useRecordErrorLog } from '../hooks/useAudit';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { ErrorLog } from '@/types/audit';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Bug,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileCode,
  Filter,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
  XCircle,
} from 'lucide-react';

export const ErrorLogsPage: React.FC = () => {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'audit_error_logs',
    defaultPage: 1,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({});
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    error_code: 'ERR_MEDIA_COLORSPACE_TRANSFORM_FAILED',
    message: 'ACEScg to Rec.709 3D LUT failed to initialize during sequence playback',
    severity: 'ERROR',
    status: 'UNRESOLVED',
    source: 'web-client',
    component: 'MediaReviewPlayer',
    stack_trace:
      'Error: LUT initialization failed\n    at initColorPipeline (ColorManager.ts:142)\n    at MediaReviewPlayer.tsx:88\n    at HTMLVideoElement.handleFrame',
  });

  const resolveMutation = useResolveErrorLog();
  const recordMutation = useRecordErrorLog();

  const { data, isLoading, refetch, isFetching } = useErrorLogs({
    page,
    page_size: pageSize,
    search: search || undefined,
    severity: severityFilter !== 'ALL' ? severityFilter : undefined,
  });

  const allErrors = data?.results || [];
  const totalCount = data?.count || 0;

  const toggleExpand = (id: string) => {
    setExpandedErrors((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyStackTrace = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredErrors = useMemo(() => {
    return allErrors.filter((err) => {
      if (statusFilter !== 'ALL' && err.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allErrors, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = allErrors.length;
    const critical = allErrors.filter((e) => e.severity === 'CRITICAL').length;
    const unresolved = allErrors.filter((e) => e.status === 'UNRESOLVED').length;
    const resolved = allErrors.filter((e) => e.status === 'RESOLVED').length;
    return { total, critical, unresolved, resolved };
  }, [allErrors]);

  const handleResolve = async (id: string) => {
    try {
      await resolveMutation.mutateAsync(id);
      refetch();
      if (selectedError?.id === id) {
        setSelectedError((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
      }
    } catch (err) {
      console.error('Failed to resolve error', err);
    }
  };

  const handleReportError = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordMutation.mutateAsync({
        error_code: formData.error_code,
        message: formData.message,
        severity: formData.severity as any,
        status: formData.status as any,
        source: formData.source,
        component: formData.component,
        stack_trace: formData.stack_trace,
        occurrences: 1,
      });

      setIsReportModalOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to record error log', err);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'ERROR':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'WARNING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'INFO':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'RESOLVED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'INVESTIGATING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'IGNORED':
        return 'bg-slate-700/40 text-slate-400 border-slate-600/30';
      case 'UNRESOLVED':
      default:
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-500/20 to-red-500/20 border border-rose-500/30 rounded-xl text-rose-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Exception & System Error Logs
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  Sentry-Compatible Crash Reporter
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                  {totalCount} Total Incidents
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized exception stack traces, client-side crash telemetry, and pipeline runtime errors
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
              title="Refresh error feed"
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
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Errors</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{totalCount}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">Critical Priority</div>
            <div className="text-xl font-bold text-rose-300 mt-1 font-mono">{metrics.critical}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Unresolved</div>
            <div className="text-xl font-bold text-amber-300 mt-1 font-mono">{metrics.unresolved}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Resolved & Triaged</div>
            <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">{metrics.resolved}</div>
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
              placeholder="Search error code, component, message..."
            />

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Severity Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
                {['ALL', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => {
                      setSeverityFilter(sev);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors text-[11px] ${
                      severityFilter === sev
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', 'UNRESOLVED', 'INVESTIGATING', 'RESOLVED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors text-[11px] ${
                      statusFilter === st
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
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
              <LoadingSpinner size="lg" message="Loading error logs & crash reports..." />
            </div>
          ) : filteredErrors.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Bug className="w-6 h-6 text-rose-400" />}
                title="No error logs found"
                description={
                  search || severityFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? 'No error records match your current filter parameters.'
                    : 'All systems are operating cleanly with zero unhandled exceptions reported.'
                }
                action={
                  undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 font-mono">
              {filteredErrors.map((err, idx) => {
                const errKey = err.id || err.uuid || `err-${idx}`;
                const isExpanded = !!expandedErrors[errKey];
                return (
                  <div key={errKey} className="p-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleExpand(errKey)}
                          className="mt-0.5 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getSeverityBadge(
                                err.severity
                              )}`}
                            >
                              {err.severity}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getStatusBadge(
                                err.status || ''
                              )}`}
                            >
                              {err.status}
                            </span>
                            <span className="font-bold text-white text-sm tracking-wide">
                              {err.error_code}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] border border-slate-700">
                              {err.component || err.source}
                            </span>
                          </div>

                          <p className="text-xs text-slate-200 mt-1.5 font-sans">
                            {err.message}
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 flex-wrap">
                            <span className="text-rose-400 font-semibold">
                              {err.occurrences} {err.occurrences === 1 ? 'event' : 'events'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(err.last_seen || Date.now()).toLocaleString()}
                            </span>
                            {err.url && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 truncate max-w-xs">{err.url}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center shrink-0">
                        {err.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleResolve(err.id)}
                            disabled={resolveMutation.isPending}
                            className="px-2.5 py-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-md transition-colors flex items-center gap-1 font-sans"
                            title="Mark incident as resolved"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>
                        )}
                        <button
                          onClick={() => toggleExpand(err.id)}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors font-sans"
                        >
                          {isExpanded ? 'Hide Trace' : 'Stack Trace'}
                        </button>
                        <button
                          onClick={() => setSelectedError(err)}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors font-sans"
                        >
                          Details
                        </button>
                      </div>
                    </div>

                    {/* Expandable Stack Trace */}
                    {isExpanded && err.stack_trace && (
                      <div className="mt-3 pl-8 pr-2">
                        <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden font-mono text-xs">
                          <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-rose-400">
                              <Terminal className="w-3.5 h-3.5" />
                              Stack Trace
                            </span>
                            <button
                              onClick={() => copyStackTrace(err.id, err.stack_trace!)}
                              className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px]"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedId === err.id ? 'Copied!' : 'Copy'}</span>
                            </button>
                          </div>
                          <div className="p-3 text-[11px] text-rose-300/90 overflow-x-auto whitespace-pre leading-relaxed">
                            {err.stack_trace}
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

      {/* Inspect Error Modal */}
      {selectedError && (
        <Modal
          isOpen={!!selectedError}
          onClose={() => setSelectedError(null)}
          title={`Error: ${selectedError.error_code}`}
          subtitle={`Incident ID: ${selectedError.id} • Severity: ${selectedError.severity}`}
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {selectedError.status !== 'RESOLVED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleResolve(selectedError.id)}
                    disabled={resolveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    Mark as Resolved
                  </Button>
                )}
              </div>
              <Button variant="secondary" onClick={() => setSelectedError(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 font-mono text-xs text-slate-300">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Severity</span>
                <span className="font-bold text-rose-400">{selectedError.severity}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span className="font-bold text-amber-400">{selectedError.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Component</span>
                <span className="font-bold text-slate-300">{selectedError.component || 'Global'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Occurrences</span>
                <span className="font-bold text-white">{selectedError.occurrences}</span>
              </div>
            </div>

            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider font-sans">
                Error Message
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 font-sans">
                {selectedError.message}
              </div>
            </div>

            {selectedError.stack_trace && (
              <div>
                <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider font-sans">
                  Full Stack Trace
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-rose-300 text-[11px] overflow-x-auto max-h-56">
                  <pre>{selectedError.stack_trace}</pre>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-500 space-y-1 pt-1">
              <div>First Seen: {new Date(selectedError.first_seen || Date.now()).toUTCString()}</div>
              <div>Last Seen: {new Date(selectedError.last_seen || Date.now()).toUTCString()}</div>
              {selectedError.url && <div>URL: {selectedError.url}</div>}
            </div>
          </div>
        </Modal>
      )}

      {/* Report / Simulate Error Modal */}
      {isReportModalOpen && (
        <Modal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          title="Report / Simulate Exception"
          subtitle="Inject a synthetic crash or runtime error event to verify observability triage"
          size="lg"
        >
          <form onSubmit={handleReportError} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Error Code</label>
                <input
                  type="text"
                  value={formData.error_code}
                  onChange={(e) => setFormData({ ...formData, error_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-rose-500 font-mono"
                  placeholder="e.g. ERR_INGEST_MEDIA_TIMEOUT"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Severity</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-rose-500 font-mono"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="ERROR">ERROR</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Error Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-rose-500 font-sans"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Source / Environment</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-rose-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Component / Module</label>
                <input
                  type="text"
                  value={formData.component}
                  onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-rose-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Stack Trace</label>
              <textarea
                value={formData.stack_trace}
                onChange={(e) => setFormData({ ...formData, stack_trace: e.target.value })}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-rose-500 font-mono text-[11px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsReportModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={recordMutation.isPending}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                {recordMutation.isPending ? 'Logging Incident...' : 'Log Error Incident'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
