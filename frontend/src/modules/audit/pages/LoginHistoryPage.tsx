import React, { useState, useMemo } from 'react';
import { useLoginHistory, useRecordLogin } from '../hooks/useAudit';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { LoginHistoryItem } from '@/types/audit';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  Key,
  Laptop,
  Lock,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';

export const LoginHistoryPage: React.FC = () => {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'audit_login_history',
    defaultPage: 1,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [authMethodFilter, setAuthMethodFilter] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<LoginHistoryItem | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    user_email: 'supervisor@studiohub.io',
    user_name: 'Elena Rostova',
    status: 'SUCCESS',
    auth_method: 'SSO_SAML',
    ip_address: '192.168.1.55',
    location: 'Vancouver, BC, Canada',
    mfa_used: true,
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/123.0',
    failure_reason: '',
  });

  const recordMutation = useRecordLogin();

  const { data, isLoading, refetch, isFetching } = useLoginHistory({
    page,
    page_size: pageSize,
    search: search || undefined,
    // Backend + mock fixtures use lowercase status words (success/failed).
    status: statusFilter !== 'ALL' ? statusFilter.toLowerCase() : undefined,
  });

  const allRecords = data?.results || [];
  const totalCount = data?.count || 0;

  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      if (authMethodFilter !== 'ALL' && rec.auth_method !== authMethodFilter) {
        return false;
      }
      return true;
    });
  }, [allRecords, authMethodFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = allRecords.length;
    const successful = allRecords.filter((r) => r.status === 'success').length;
    const failed = allRecords.filter((r) => r.status === 'failed' || r.status === 'blocked').length;
    const mfa = allRecords.filter((r) => r.mfa_used).length;
    return { total, successful, failed, mfa };
  }, [allRecords]);

  const handleRecordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordMutation.mutateAsync({
        user_email: formData.user_email,
        user_name: formData.user_name,
        status: formData.status as any,
        auth_method: formData.auth_method as any,
        ip_address: formData.ip_address,
        location: formData.location,
        mfa_used: formData.mfa_used,
        user_agent: formData.user_agent,
        failure_reason: formData.status !== 'SUCCESS' ? formData.failure_reason || 'Simulated failure' : undefined,
      });

      setIsRecordModalOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to record login event', err);
    }
  };

  const getStatusBadge = (st: string) => {
    switch ((st || '').toLowerCase()) {
      case 'success':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'failed':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'blocked':
        return 'bg-red-950/60 text-red-400 border-red-800';
      case 'mfa_challenge':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  };

  const getAuthMethodBadge = (m: string) => {
    switch (m) {
      case 'SSO_SAML':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'GOOGLE_OAUTH':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'PASSWORD':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'API_KEY':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Authentication & Login Audit History
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  MFA / SSO Compliance
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                  {totalCount} Total Sessions
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect user identity logins, IP geographic telemetry, SAML SSO assertions, and multi-factor validations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
              title="Refresh login logs"
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
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Attempts</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{totalCount}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Successful Sessions</div>
            <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">{metrics.successful}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">MFA Protected</div>
            <div className="text-xl font-bold text-cyan-300 mt-1 font-mono">{metrics.mfa}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">Failed / Blocked</div>
            <div className="text-xl font-bold text-rose-300 mt-1 font-mono">{metrics.failed}</div>
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
              placeholder="Search user, email, IP, location..."
            />

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
                {['ALL', 'SUCCESS', 'FAILED', 'BLOCKED', 'MFA_CHALLENGE'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors text-[11px] ${
                      statusFilter === st
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Auth Method Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', 'SSO_SAML', 'GOOGLE_OAUTH', 'PASSWORD'].map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setAuthMethodFilter(m);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors text-[11px] ${
                      authMethodFilter === m
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <LoadingSpinner size="lg" message="Loading authentication history..." />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<LogIn className="w-6 h-6 text-emerald-400" />}
                title="No login records found"
                description={
                  search || statusFilter !== 'ALL' || authMethodFilter !== 'ALL'
                    ? 'No authentication sessions match your current filters.'
                    : 'No sign-in events recorded yet in the audit ledger.'
                }
                action={
                  undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">User & Email</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Auth Method</th>
                    <th className="py-3 px-3">MFA</th>
                    <th className="py-3 px-4">Location & IP</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRecords.map((rec, idx) => (
                    <tr
                      key={rec.id || rec.uuid || `rec-${idx}`}
                      onClick={() => setSelectedRecord(rec)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                          {rec.user_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans">{rec.user_email}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-md border ${getStatusBadge(
                            rec.status
                          )}`}
                        >
                          {rec.status === 'success' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getAuthMethodBadge(
                            rec.auth_method || ''
                          )}`}
                        >
                          {rec.auth_method}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {rec.mfa_used ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            VERIFIED
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-300 font-sans">{rec.location || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-500">{rec.ip_address}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(rec.created_at || Date.now()).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(rec);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors border border-slate-700 font-sans"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* Inspect Session Modal */}
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`Session: ${selectedRecord.user_name}`}
          subtitle={`Session ID: ${selectedRecord.id} • Auth: ${selectedRecord.auth_method}`}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedRecord(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 font-mono text-xs text-slate-300">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span
                  className={`font-bold ${
                    selectedRecord.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedRecord.status}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Auth Method</span>
                <span className="font-bold text-purple-400">{selectedRecord.auth_method}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">MFA Step</span>
                <span className="font-bold text-cyan-400">
                  {selectedRecord.mfa_used ? 'Enforced' : 'None'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">IP Address</span>
                <span className="font-bold text-slate-300">{selectedRecord.ip_address}</span>
              </div>
            </div>

            {selectedRecord.failure_reason && (
              <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-lg text-rose-300">
                <div className="flex items-center gap-1.5 font-bold text-rose-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Authentication Rejection Reason</span>
                </div>
                <div className="text-[11px] font-sans">{selectedRecord.failure_reason}</div>
              </div>
            )}

            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider font-sans">
                Location & Origin
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-200">
                {selectedRecord.location || 'Undisclosed Geolocation'}
              </div>
            </div>

            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider font-sans">
                Browser & Client User Agent
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 text-[11px] overflow-x-auto">
                {selectedRecord.user_agent || 'Unknown client agent'}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 pt-1">
              Recorded at: {new Date(selectedRecord.created_at || Date.now()).toUTCString()}
            </div>
          </div>
        </Modal>
      )}

      {/* Record Login Modal */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title="Simulate / Record Login Attempt"
          subtitle="Inject an authentication session into the security access ledger"
          size="lg"
        >
          <form onSubmit={handleRecordLogin} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">User Name</label>
                <input
                  type="text"
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">User Email</label>
                <input
                  type="email"
                  value={formData.user_email}
                  onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500 font-sans"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                >
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILED">FAILED</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="MFA_CHALLENGE">MFA_CHALLENGE</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Auth Method</label>
                <select
                  value={formData.auth_method}
                  onChange={(e) => setFormData({ ...formData, auth_method: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                >
                  <option value="SSO_SAML">SSO_SAML</option>
                  <option value="GOOGLE_OAUTH">GOOGLE_OAUTH</option>
                  <option value="PASSWORD">PASSWORD</option>
                  <option value="API_KEY">API_KEY</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">MFA Verified</label>
                <select
                  value={formData.mfa_used ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, mfa_used: e.target.value === 'true' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                >
                  <option value="true">Yes (MFA Enforced)</option>
                  <option value="false">No (Single Factor)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">IP Address</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Geolocation</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500 font-sans"
                  placeholder="e.g. London, UK"
                />
              </div>
            </div>

            {formData.status !== 'SUCCESS' && (
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Rejection Reason</label>
                <input
                  type="text"
                  value={formData.failure_reason}
                  onChange={(e) => setFormData({ ...formData, failure_reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500 font-sans"
                  placeholder="e.g. Invalid MFA token or expired SAML assertion"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsRecordModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={recordMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {recordMutation.isPending ? 'Recording...' : 'Commit Login Event'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
