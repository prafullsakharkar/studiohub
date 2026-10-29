import React, { useState, useMemo } from 'react';
import { useApiRequests, useCreateApiRequest } from '../hooks/useAudit';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { APIRequest } from '@/types/audit';
import { EntityTable } from '@/shared/crud/EntityTable';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Filter,
  Globe,
  Network,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react';

export const ApiRequestsPage: React.FC = () => {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'audit_api_requests',
    defaultPage: 1,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<APIRequest | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Request Form State
  const [formData, setFormData] = useState({
    method: 'GET',
    endpoint: '/api/v1/production/shots',
    status_code: 200,
    response_time_ms: 45,
    ip_address: '192.168.1.100',
    user_email: 'supervisor@studiohub.io',
    payload_size_kb: 1.2,
    request_body: '{\n  "query": "active"\n}',
    response_body: '{\n  "count": 12,\n  "status": "success"\n}',
  });

  const createRequestMutation = useCreateApiRequest();

  const { data, isLoading, refetch, isFetching } = useApiRequests({
    page,
    page_size: pageSize,
    search: search || undefined,
  });

  const allRequests = data?.results || [];
  const totalCount = data?.count || 0;

  // Client-side filtering for quick refinement
  const filteredRequests = useMemo(() => {
    return allRequests.filter((req) => {
      if (methodFilter !== 'ALL' && req.method.toUpperCase() !== methodFilter) {
        return false;
      }
      if (statusFilter !== 'ALL') {
        const code = req.status_code;
        if (statusFilter === '2xx' && (code < 200 || code >= 300)) return false;
        if (statusFilter === '4xx' && (code < 400 || code >= 500)) return false;
        if (statusFilter === '5xx' && code < 500) return false;
      }
      return true;
    });
  }, [allRequests, methodFilter, statusFilter]);


  const apiRequestFields = [
    {
      key: 'method',
      label: 'Method & Endpoint',
      sortable: false,
      render: (_v: unknown, req: APIRequest) => (
        <div className="flex items-center gap-2.5">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getMethodBadge(req.method)}`}>
            {req.method}
          </span>
          <span className="font-semibold text-white truncate max-w-xs sm:max-w-md">
            {(req as APIRequest & { endpoint?: string }).endpoint ?? req.path}
          </span>
        </div>
      ),
    },
    {
      key: 'status_code',
      label: 'Status',
      sortable: false,
      render: (_v: unknown, req: APIRequest) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md border ${getStatusBadge(req.status_code)}`}>
          {req.status_code >= 200 && req.status_code < 300 ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <XCircle className="w-3 h-3" />
          )}
          {req.status_code}
        </span>
      ),
    },
    {
      key: 'response_time_ms',
      label: 'Latency',
      sortable: false,
      render: (_v: unknown, req: APIRequest) => (
        <span className={`font-semibold ${(req.response_time_ms || 0) > 200 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {req.response_time_ms} ms
        </span>
      ),
    },
    {
      key: 'payload_size_kb',
      label: 'Size',
      sortable: false,
      render: (_v: unknown, req: APIRequest) => (
        <span className="text-slate-400 whitespace-nowrap">
          {req.payload_size_kb ? `${req.payload_size_kb} KB` : '—'}
        </span>
      ),
    },
    {
      key: 'user_email',
      label: 'Caller / IP',
      sortable: false,
      render: (_v: unknown, req: APIRequest) => (
        <div>
          <div className="text-slate-200 truncate max-w-[180px]">{req.user_email || 'API Key Service'}</div>
          <div className="text-[10px] text-slate-500">{req.ip_address}</div>
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Timestamp',
      sortable: false,
      render: (_v: unknown, req: APIRequest) => (
        <span className="text-slate-400 whitespace-nowrap text-[11px]">
          {new Date(req.created_at || Date.now()).toLocaleString()}
        </span>
      ),
    },
  ];

  // Metrics
  const metrics = useMemo(() => {
    const total = allRequests.length;
    const errors = allRequests.filter((r) => r.status_code >= 400).length;
    const avgLatency =
      total > 0
        ? Math.round(allRequests.reduce((acc, r) => acc + (r.response_time_ms || 0), 0) / total)
        : 0;
    const slowRequests = allRequests.filter((r) => (r.response_time_ms || 0) > 200).length;
    return { total, errors, avgLatency, slowRequests };
  }, [allRequests]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedReqBody = {};
      let parsedResBody = {};
      try {
        parsedReqBody = JSON.parse(formData.request_body);
      } catch {
        parsedReqBody = { text: formData.request_body };
      }
      try {
        parsedResBody = JSON.parse(formData.response_body);
      } catch {
        parsedResBody = { text: formData.response_body };
      }

      await createRequestMutation.mutateAsync({
        method: formData.method as any,
        endpoint: formData.endpoint,
        status_code: Number(formData.status_code),
        response_time_ms: Number(formData.response_time_ms),
        ip_address: formData.ip_address,
        user_email: formData.user_email,
        payload_size_kb: Number(formData.payload_size_kb),
        user_agent: 'StudioHub-CLI/2.4.0 (X11; Linux x86_64)',
        request_body: parsedReqBody,
        response_body: parsedResBody,
        headers: {
          'Content-Type': 'application/json',
          'X-Studio-Trace-ID': `trc-${Date.now().toString(36)}`,
          Authorization: 'Bearer stk_live_***',
        },
      });

      setIsCreateModalOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to log API request probe', err);
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'POST':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (code >= 300 && code < 400) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
    if (code >= 400 && code < 500) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  API Requests & Telemetry Logs
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  REST & GraphQL Ingress
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                  {totalCount} Total Recorded
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time observability of incoming pipeline API requests, payloads, status codes, and latency distributions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
              title="Refresh API log stream"
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
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Requests</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{totalCount}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400">Avg Latency</div>
            <div className="text-xl font-bold text-blue-300 mt-1 font-mono">
              {metrics.avgLatency} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">Failed / Errors (4xx/5xx)</div>
            <div className="text-xl font-bold text-rose-300 mt-1 font-mono">{metrics.errors}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Slow (&gt;200ms)</div>
            <div className="text-xl font-bold text-amber-300 mt-1 font-mono">{metrics.slowRequests}</div>
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
              placeholder="Search by endpoint, user email, or IP..."
            />

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Method Filters */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethodFilter(m)}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors ${
                      methodFilter === m
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Status Filters */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', '2xx', '4xx', '5xx'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors ${
                      statusFilter === s
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data Table (canonical EntityTable, controlled/server mode) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <LoadingSpinner size="lg" message="Loading API request traces..." />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Network className="w-6 h-6 text-blue-400" />}
                title="No API requests found"
                description={
                  search || methodFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? 'No requests match your current filters. Try changing or clearing them.'
                    : 'No incoming API requests recorded yet. Trigger a probe or run workflow tasks to capture live telemetry.'
                }
                action={
                  undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <EntityTable<APIRequest>
                data={filteredRequests}
                fields={apiRequestFields}
                actions={[{ id: 'inspect', label: 'Inspect', action: (req) => setSelectedRequest(req) }]}
                onRowClick={(req) => setSelectedRequest(req)}
                page={page}
                totalCount={totalCount}
                pageSize={pageSize}
                pageSizeOptions={pageSizeOptions}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                storageKey="audit_api_requests_table"
              />
            </div>
          )}
        </div>
      </div>

      {/* Inspect Request Detail Modal */}
      {selectedRequest && (
        <Modal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          title={`API Request: ${selectedRequest.method} ${selectedRequest.endpoint}`}
          subtitle={`Trace ID: ${selectedRequest.id} • ${new Date(
            selectedRequest.created_at || Date.now()
          ).toUTCString()}`}
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-400 font-mono">
                Caller IP: {selectedRequest.ip_address}
              </span>
              <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 font-mono text-xs text-slate-300">
            {/* Quick Summary Pill Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span
                  className={`font-bold ${
                    selectedRequest.status_code < 400 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedRequest.status_code}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Latency</span>
                <span className="font-bold text-blue-400">{selectedRequest.response_time_ms} ms</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Payload</span>
                <span className="font-bold text-slate-300">{selectedRequest.payload_size_kb} KB</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">User</span>
                <span className="font-bold text-indigo-400 truncate block">
                  {selectedRequest.user_email || 'Service'}
                </span>
              </div>
            </div>

            {/* Request Headers */}
            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                Request Headers
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] overflow-x-auto">
                {selectedRequest.headers ? (
                  <pre>{JSON.stringify(selectedRequest.headers, null, 2)}</pre>
                ) : (
                  <span className="text-slate-600">No explicit custom headers stored</span>
                )}
              </div>
            </div>

            {/* Request Body */}
            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                Request Body
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] overflow-x-auto max-h-48">
                {selectedRequest.request_body ? (
                  <pre>{JSON.stringify(selectedRequest.request_body, null, 2)}</pre>
                ) : (
                  <span className="text-slate-600">None / Empty Body</span>
                )}
              </div>
            </div>

            {/* Response Body */}
            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                Response Payload
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] overflow-x-auto max-h-48">
                {selectedRequest.response_body ? (
                  <pre>{JSON.stringify(selectedRequest.response_body, null, 2)}</pre>
                ) : (
                  <span className="text-slate-600">Empty Response Body</span>
                )}
              </div>
            </div>

            {/* User Agent */}
            {selectedRequest.user_agent && (
              <div className="text-[11px] text-slate-500 pt-1">
                User Agent: {selectedRequest.user_agent}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add / Simulate Request Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Simulate / Log API Request"
          subtitle="Trigger a simulated HTTP request against StudioHub API router to test telemetry and ingress observability"
          size="lg"
        >
          <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">HTTP Method</label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Endpoint Path</label>
                <input
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  placeholder="/api/v1/production/shots"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Status Code</label>
                <input
                  type="number"
                  value={formData.status_code}
                  onChange={(e) => setFormData({ ...formData, status_code: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Latency (ms)</label>
                <input
                  type="number"
                  value={formData.response_time_ms}
                  onChange={(e) => setFormData({ ...formData, response_time_ms: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Caller IP</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">User Email / Identity</label>
              <input
                type="email"
                value={formData.user_email}
                onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500"
                placeholder="developer@studiohub.io"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Request Body (JSON)</label>
              <textarea
                value={formData.request_body}
                onChange={(e) => setFormData({ ...formData, request_body: e.target.value })}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Response Body (JSON)</label>
              <textarea
                value={formData.response_body}
                onChange={(e) => setFormData({ ...formData, response_body: e.target.value })}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono text-[11px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createRequestMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {createRequestMutation.isPending ? 'Logging Probe...' : 'Log API Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
