import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTimelogs, useTimelogMutations } from '../hooks/useTimelogs';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Timelog, Task } from '@/types/tasks';
import { Button } from '@/shared/components/Button';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { TimelogCreateModal } from '../components/TimelogCreateModal';
import {
  Clock,
  Play,
  Pause,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  DollarSign,
  User,
  Calendar,
  Layers,
  Building,
  ArrowUpDown,
  Download,
  AlertCircle,
} from 'lucide-react';

export const TimelogsPage: React.FC = () => {
  const { data: projectsData } = useProjects();
  const { data: peopleData } = usePeople();
  const logPeople: any[] = (peopleData as any)?.results ?? peopleData ?? [];
  const { data: tasksData } = useTasks();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBillable, setSelectedBillable] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const {
    data: timelogsData,
    isLoading,
    refetch,
  } = useTimelogs({
    project_id: selectedProjectId === 'ALL' ? undefined : selectedProjectId,
    person_id: selectedPersonId === 'ALL' ? undefined : selectedPersonId,
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
    billable: selectedBillable === 'ALL' ? undefined : selectedBillable,
    search: searchQuery || undefined,
  });

  const { createTimelog, updateTimelog, deleteTimelog, approveTimelog, rejectTimelog } =
    useTimelogMutations();

  const { isRunning, activeTaskId, startTimer, pauseTimer } = useTimerStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskForLog, setSelectedTaskForLog] = useState<Task | undefined>(undefined);

  const timelogs = timelogsData?.results || [];
  const totalHours = timelogs.reduce((acc, t) => acc + t.duration_hours, 0);
  const billableHours = timelogs.filter((t) => t.billable).reduce((acc, t) => acc + t.duration_hours, 0);
  const totalBillableAmount = timelogs
    .filter((t) => t.billable)
    .reduce((acc, t) => acc + t.duration_hours * (t.hourly_rate_usd || 115), 0);

  const handleApprove = async (id: string) => {
    try {
      await approveTimelog.mutateAsync({ id });
      addNotification({
        type: 'success',
        title: 'Timelog Approved',
        message: 'Hours validated for accounting.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Approval Failed',
        message: err.message,
      });
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Please enter the reason for rejecting this timelog:');
    if (!reason) return;
    try {
      await rejectTimelog.mutateAsync({ id, payload: { rejection_reason: reason } });
      addNotification({
        type: 'info',
        title: 'Timelog Rejected',
        message: 'Notification sent back to artist for correction.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Rejection Failed',
        message: err.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this timelog entry?')) return;
    try {
      await deleteTimelog.mutateAsync(id);
      addNotification({
        type: 'success',
        title: 'Timelog Removed',
        message: 'Hours record deleted.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: err.message,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Production Timelogs & Artist Hours
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  {totalHours.toFixed(1)} hrs Logged
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {billableHours.toFixed(1)} hrs Billable
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Track live artist working sessions, review billable logs, and approve studio payroll entries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedTaskForLog(tasksData?.results?.[0]);
                setIsCreateModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Manual Log Entry
            </Button>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Logged Time</span>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">{totalHours.toFixed(1)} hrs</div>
          <span className="text-xs text-slate-500 mt-1">{timelogs.length} logged sessions</span>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Billable Ratio</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0}%
          </div>
          <span className="text-xs text-slate-500 mt-1">{billableHours.toFixed(1)} billable hrs</span>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Billable Value</span>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-2">
            ${totalBillableAmount.toLocaleString()}
          </div>
          <span className="text-xs text-slate-500 mt-1">Direct client deliverable work</span>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {timelogs.filter((t) => t.status === 'Submitted').length}
          </div>
          <span className="text-xs text-slate-500 mt-1">Awaiting supervisor signoff</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes, task title, code, artist..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Projects</option>
            {projectsData?.results?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>

          {/* Person Filter */}
          <select
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Artists</option>
            {logPeople.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Billable Filter */}
          <select
            value={selectedBillable}
            onChange={(e) => setSelectedBillable(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Types</option>
            <option value="true">Billable Only</option>
            <option value="false">Non-Billable Only</option>
          </select>
        </div>
      </div>

      {/* Main Timelogs Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-xl">
        <table className="w-full text-left text-sm text-slate-300 border-collapse">
          <thead className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
            <tr>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Person</th>
              <th className="p-3.5">Project & Task</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Duration</th>
              <th className="p-3.5">Billable</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Notes</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500">
                  Loading timelogs...
                </td>
              </tr>
            ) : timelogs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                  No timelogs matching current filters.
                </td>
              </tr>
            ) : (
              timelogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors group">
                  {/* Date */}
                  <td className="p-3.5 text-xs font-mono font-semibold text-slate-200">
                    {log.date}
                  </td>

                  {/* Person */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      {log.person_avatar ? (
                        <img
                          src={log.person_avatar}
                          alt={log.person_name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block truncate">
                          {log.person_name}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {log.department}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Project & Task */}
                  <td className="p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-300">
                        {log.project_code}
                      </span>
                      <Link
                        to={`/tasks/${log.task_id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-mono hover:underline truncate max-w-xs"
                      >
                        {log.task_code}: {log.task_title}
                      </Link>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="p-3.5 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80">
                      {log.activity_category || 'Direct Work'}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="p-3.5 text-xs font-mono font-bold text-slate-100">
                    {log.duration_hours} hrs
                  </td>

                  {/* Billable */}
                  <td className="p-3.5 text-xs">
                    {log.billable ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <DollarSign className="w-3.5 h-3.5" /> Billable
                      </span>
                    ) : (
                      <span className="text-slate-500">Non-billable</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-3.5 text-xs">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        log.status === 'Approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : log.status === 'Rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>

                  {/* Notes */}
                  <td className="p-3.5 text-xs text-slate-400 max-w-xs truncate" title={log.notes}>
                    {log.notes || '—'}
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {log.status !== 'Approved' && (
                        <button
                          onClick={() => handleApprove(log.id)}
                          className="p-1.5 rounded bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/60 transition-colors"
                          title="Approve timelog"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {log.status !== 'Rejected' && (
                        <button
                          onClick={() => handleReject(log.id)}
                          className="p-1.5 rounded bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/60 transition-colors"
                          title="Reject timelog"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 border border-slate-700 transition-colors"
                        title="Delete timelog"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isCreateModalOpen && (
        <TimelogCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data) => createTimelog.mutateAsync(data)}
          task={selectedTaskForLog}
        />
      )}
      </div>
    </div>
  );
};
