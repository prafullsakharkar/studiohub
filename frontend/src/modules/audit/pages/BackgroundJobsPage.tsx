import React, { useState, useMemo } from 'react';
import {
  useBackgroundJobs,
  useRetryBackgroundJob,
  useCancelBackgroundJob,
  useCreateBackgroundJob,
} from '../hooks/useAudit';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { BackgroundJob } from '@/types/audit';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Server,
  StopCircle,
  Timer,
  Workflow,
  XCircle,
  Zap,
} from 'lucide-react';

export const BackgroundJobsPage: React.FC = () => {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'audit_background_jobs',
    defaultPage: 1,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [queueFilter, setQueueFilter] = useState<string>('ALL');
  const [selectedJob, setSelectedJob] = useState<BackgroundJob | null>(null);
  const [isEnqueueModalOpen, setIsEnqueueModalOpen] = useState(false);

  // Form State for Enqueueing New Job
  const [newJobData, setNewJobData] = useState({
    name: 'Transcode Shot 010_020 to ProRes4444',
    queue: 'transcode',
    priority: 5,
    payload: '{\n  "shot_id": "shot-102",\n  "preset": "prores_4444_xq",\n  "color_pipeline": "ACEScc"\n}',
  });

  const retryMutation = useRetryBackgroundJob();
  const cancelMutation = useCancelBackgroundJob();
  const createJobMutation = useCreateBackgroundJob();

  const { data, isLoading, refetch, isFetching } = useBackgroundJobs({
    page,
    page_size: pageSize,
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  const allJobs = data?.results || [];
  const totalCount = data?.count || 0;

  // Filter queues
  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      const q = job.queue || job.queue_name || 'default';
      if (queueFilter !== 'ALL' && q !== queueFilter) {
        return false;
      }
      return true;
    });
  }, [allJobs, queueFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = allJobs.length;
    const running = allJobs.filter((j) => {
      const s = (j.status || '').toUpperCase();
      return s === 'RUNNING' || s === 'PROGRESS' || s === 'STARTED';
    }).length;
    const pending = allJobs.filter((j) => {
      const s = (j.status || '').toUpperCase();
      return s === 'PENDING' || s === 'QUEUED';
    }).length;
    const failed = allJobs.filter((j) => (j.status || '').toUpperCase() === 'FAILED').length;
    const completed = allJobs.filter((j) => (j.status || '').toUpperCase() === 'COMPLETED').length;
    return { total, running, pending, failed, completed };
  }, [allJobs]);

  const queues = useMemo(() => {
    const set = new Set<string>();
    allJobs.forEach((j) => {
      const q = j.queue || j.queue_name;
      if (q && typeof q === 'string' && q.trim()) {
        set.add(q.trim());
      }
    });
    return ['ALL', ...Array.from(set)];
  }, [allJobs]);

  const handleEnqueue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(newJobData.payload);
      } catch {
        parsedPayload = { text: newJobData.payload };
      }

      await createJobMutation.mutateAsync({
        name: newJobData.name,
        queue: newJobData.queue,
        priority: Number(newJobData.priority),
        status: 'PENDING',
        progress: 0,
        payload: parsedPayload,
        attempts: 0,
        max_attempts: 3,
      });

      setIsEnqueueModalOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to enqueue job', err);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryMutation.mutateAsync(jobId);
      refetch();
      if (selectedJob?.id === jobId) {
        setSelectedJob((prev) => (prev ? { ...prev, status: 'RUNNING', progress: 5 } : null));
      }
    } catch (err) {
      console.error('Failed to retry job', err);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelMutation.mutateAsync(jobId);
      refetch();
      if (selectedJob?.id === jobId) {
        setSelectedJob((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      }
    } catch (err) {
      console.error('Failed to cancel job', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'FAILED':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'PENDING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'CANCELLED':
        return 'bg-slate-700/40 text-slate-400 border-slate-600/30';
      case 'RETRYING':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Background Queue & Render Jobs
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Distributed Worker Engine
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                  {totalCount} Total Jobs
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect transcode tasks, publish queues, metadata reconciliations, and render workers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
              title="Refresh job queue"
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total In Queue</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{totalCount}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400">Running Workers</div>
            <div className="text-xl font-bold text-blue-300 mt-1 font-mono">{metrics.running}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Pending / Queued</div>
            <div className="text-xl font-bold text-amber-300 mt-1 font-mono">{metrics.pending}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Completed</div>
            <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">{metrics.completed}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">Failed / Retrying</div>
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
              placeholder="Search by job name or ID..."
            />

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Queue Filter */}
              <select
                value={queueFilter}
                onChange={(e) => {
                  setQueueFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-hidden focus:border-amber-500"
              >
                {queues.map((q, idx) => (
                  <option key={q || `queue-${idx}`} value={q}>
                    {q === 'ALL' ? 'All Queues' : `Queue: ${q}`}
                  </option>
                ))}
              </select>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
                {['ALL', 'RUNNING', 'PENDING', 'COMPLETED', 'FAILED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors ${
                      statusFilter === st
                        ? 'bg-amber-600 text-white shadow-xs'
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

        {/* Data Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <LoadingSpinner size="lg" message="Polling background job queues..." />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Cpu className="w-6 h-6 text-amber-400" />}
                title="No background jobs found"
                description={
                  search || statusFilter !== 'ALL' || queueFilter !== 'ALL'
                    ? 'No jobs match your current filters. Try changing or clearing them.'
                    : 'The background queue is currently idle. Enqueue a task or trigger transcode operations to see processing jobs.'
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
                    <th className="py-3 px-4">Job Name & ID</th>
                    <th className="py-3 px-3">Queue</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 min-w-[140px]">Progress</th>
                    <th className="py-3 px-3">Attempts</th>
                    <th className="py-3 px-4">Started / Created</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredJobs.map((job, idx) => {
                    const jobId = job.id || job.uuid || job.job_id || `job-${idx}`;
                    const jobName = job.name || job.description || job.job_id || 'Background Job';
                    const jobQueue = job.queue || job.queue_name || 'default';
                    const attempts = job.attempts ?? job.retry_count ?? 0;
                    const maxAttempts = job.max_attempts ?? job.max_retries ?? 3;
                    const statusStr = (job.status || 'PENDING').toString().toUpperCase();

                    return (
                      <tr
                        key={jobId}
                        onClick={() => setSelectedJob(job)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                            {jobName}
                          </div>
                          <div className="text-[10px] text-slate-500">{jobId}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px] border border-slate-700">
                            {jobQueue}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-md border ${getStatusBadge(
                              statusStr
                            )}`}
                          >
                            {(statusStr === 'RUNNING' || statusStr === 'PROGRESS') && <RotateCw className="w-3 h-3 animate-spin" />}
                            {statusStr === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                            {statusStr === 'FAILED' && <XCircle className="w-3 h-3" />}
                            {(statusStr === 'PENDING' || statusStr === 'QUEUED') && <Clock className="w-3 h-3" />}
                            {statusStr === 'CANCELLED' && <Ban className="w-3 h-3" />}
                            {statusStr}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  statusStr === 'FAILED'
                                    ? 'bg-rose-500'
                                    : statusStr === 'COMPLETED'
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, job.progress || 0))}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-400 w-8 text-right">
                              {job.progress || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          {attempts} / {maxAttempts}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                          {job.created_at ? new Date(job.created_at).toLocaleString() : 'Recently'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {statusStr === 'FAILED' && (
                              <button
                                onClick={() => handleRetry(jobId)}
                                disabled={retryMutation.isPending}
                                className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 rounded text-[11px] transition-colors flex items-center gap-1"
                                title="Retry failed job"
                              >
                                <RotateCw className="w-3 h-3" />
                                <span>Retry</span>
                              </button>
                            )}
                            {(statusStr === 'RUNNING' || statusStr === 'PROGRESS' || statusStr === 'PENDING' || statusStr === 'QUEUED') && (
                              <button
                                onClick={() => handleCancel(jobId)}
                                disabled={cancelMutation.isPending}
                                className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded text-[11px] transition-colors flex items-center gap-1"
                                title="Cancel job"
                              >
                                <StopCircle className="w-3 h-3" />
                                <span>Cancel</span>
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedJob(job)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors border border-slate-700"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Inspect Job Modal */}
      {selectedJob && (
        <Modal
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          title={`Job: ${selectedJob.name || selectedJob.description || selectedJob.job_id || 'Background Job'}`}
          subtitle={`Queue: ${selectedJob.queue || selectedJob.queue_name || 'default'} • ID: ${selectedJob.id || selectedJob.uuid || selectedJob.job_id || 'unknown'}`}
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {((selectedJob.status || '').toUpperCase() === 'FAILED') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleRetry(selectedJob.id || selectedJob.uuid || selectedJob.job_id || '')}
                    disabled={retryMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-500"
                  >
                    Retry Job
                  </Button>
                )}
                {['RUNNING', 'PROGRESS', 'PENDING', 'QUEUED'].includes((selectedJob.status || '').toUpperCase()) && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleCancel(selectedJob.id || selectedJob.uuid || selectedJob.job_id || '')}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel Execution
                  </Button>
                )}
              </div>
              <Button variant="secondary" onClick={() => setSelectedJob(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 font-mono text-xs text-slate-300">
            {/* Status summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span
                  className={`font-bold ${
                    (selectedJob.status || '').toUpperCase() === 'COMPLETED'
                      ? 'text-emerald-400'
                      : (selectedJob.status || '').toUpperCase() === 'FAILED'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {(selectedJob.status || '').toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Progress</span>
                <span className="font-bold text-white">{selectedJob.progress || 0}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Attempts</span>
                <span className="font-bold text-slate-300">
                  {selectedJob.attempts ?? selectedJob.retry_count ?? 0} / {selectedJob.max_attempts ?? selectedJob.max_retries ?? 3}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Priority</span>
                <span className="font-bold text-purple-400">Level {selectedJob.priority || 5}</span>
              </div>
            </div>

            {/* Error message if failed */}
            {selectedJob.error_message && (
              <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-lg text-rose-300">
                <div className="flex items-center gap-1.5 font-bold text-rose-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Execution Failure Log</span>
                </div>
                <div className="text-[11px] whitespace-pre-wrap">{selectedJob.error_message}</div>
              </div>
            )}

            {/* Job Payload */}
            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                Task Payload & Parameters
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] overflow-x-auto max-h-56">
                {selectedJob.payload || selectedJob.result_data ? (
                  <pre>{JSON.stringify(selectedJob.payload || selectedJob.result_data, null, 2)}</pre>
                ) : (
                  <span className="text-slate-600">No custom payload defined</span>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-[11px] text-slate-500 space-y-1 pt-1">
              <div>Created: {selectedJob.created_at ? new Date(selectedJob.created_at).toUTCString() : 'N/A'}</div>
              {selectedJob.started_at && (
                <div>Started: {new Date(selectedJob.started_at).toUTCString()}</div>
              )}
              {selectedJob.completed_at && (
                <div>Completed: {new Date(selectedJob.completed_at).toUTCString()}</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Enqueue New Job Modal */}
      {isEnqueueModalOpen && (
        <Modal
          isOpen={isEnqueueModalOpen}
          onClose={() => setIsEnqueueModalOpen(false)}
          title="Enqueue Background Job"
          subtitle="Dispatch an asynchronous task to the StudioHub distributed worker queue"
          size="lg"
        >
          <form onSubmit={handleEnqueue} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Job Name / Description</label>
              <input
                type="text"
                value={newJobData.name}
                onChange={(e) => setNewJobData({ ...newJobData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-amber-500 font-medium"
                placeholder="e.g. Transcode Shot 010_020 to ProRes"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Queue Name</label>
                <select
                  value={newJobData.queue}
                  onChange={(e) => setNewJobData({ ...newJobData, queue: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-amber-500 font-mono"
                >
                  <option value="transcode">transcode</option>
                  <option value="render">render</option>
                  <option value="sync">sync</option>
                  <option value="export">export</option>
                  <option value="notifications">notifications</option>
                  <option value="default">default</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Priority (1 - 10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newJobData.priority}
                  onChange={(e) => setNewJobData({ ...newJobData, priority: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-amber-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Payload JSON</label>
              <textarea
                value={newJobData.payload}
                onChange={(e) => setNewJobData({ ...newJobData, payload: e.target.value })}
                rows={5}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-amber-500 font-mono text-[11px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsEnqueueModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createJobMutation.isPending}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {createJobMutation.isPending ? 'Enqueueing...' : 'Dispatch to Queue'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
