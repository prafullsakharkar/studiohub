import React, { useState, useMemo } from 'react';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { ActivityTimeline } from '@/shared/activity/ActivityTimeline';
import { SearchInput } from '@/shared/components/SearchInput';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  Filter,
  Layers,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Users,
} from 'lucide-react';

export const ActivitiesPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'timeline' | 'tabular'>('timeline');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'workspace_activities_page',
    defaultPage: 1,
    defaultPageSize: 15,
    pageSizeOptions: [10, 15, 30, 50],
  });

  const { activities: allActivities, addActivity } = useActivityStore();

  // New Activity Form State
  const [newActivity, setNewActivity] = useState({
    userName: 'VFX Supervisor',
    action: 'note_added',
    entityType: 'shot',
    entityName: 'SH_010_030',
    description: 'Added revision notes on lighting pass: increase rim light on hero character',
  });

  // Platform-wide activity feed
  const orgActivities = useMemo(() => allActivities, [allActivities]);

  // Filter by search and action
  const filteredActivities = useMemo(() => {
    return orgActivities.filter((a: any) => {
      if (actionFilter !== 'ALL' && a.action?.toLowerCase() !== actionFilter.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = a.userName?.toLowerCase().includes(query);
        const matchesDesc = a.description?.toLowerCase().includes(query);
        const matchesEntity = a.entityName?.toLowerCase().includes(query);
        const matchesAction = a.action?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesEntity && !matchesAction) {
          return false;
        }
      }
      return true;
    });
  }, [orgActivities, actionFilter, search]);

  const totalCount = filteredActivities.length;
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, page, pageSize]);

  // Metrics
  const metrics = useMemo(() => {
    const total = orgActivities.length;
    const users = new Set(orgActivities.map((a: any) => a.userName)).size;
    const approvals = orgActivities.filter(
      (a: any) => a.action === 'approve' || a.action === 'approved' || a.action === 'review'
    ).length;
    const notes = orgActivities.filter(
      (a: any) => a.action === 'note_added' || a.action === 'comment'
    ).length;
    return { total, users, approvals, notes };
  }, [orgActivities]);

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    addActivity({
      userId: 'user-current',
      userName: newActivity.userName,
      action: (newActivity.action === 'note_added' ? 'comment' : newActivity.action) as any,
      entityType: newActivity.entityType,
      entityId: `id-${Date.now().toString().slice(-4)}`,
      entityName: newActivity.entityName,
      description: newActivity.description,
      timestamp: new Date().toISOString(),
    });

    setIsAddModalOpen(false);
  };

  const getActionBadge = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('approve')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (act.includes('note') || act.includes('comment'))
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    if (act.includes('publish') || act.includes('upload'))
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (act.includes('delete') || act.includes('reject'))
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Studio Activities & Team Stream
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Live Event Feed
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                  {totalCount} Activities
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time stream of artist uploads, review milestones, supervisor annotations, and project updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>Record Team Activity</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Activities</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{metrics.total}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400">Active Contributors</div>
            <div className="text-xl font-bold text-blue-300 mt-1 font-mono">{metrics.users}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Signoffs & Approvals</div>
            <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">{metrics.approvals}</div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Notes & Feedback</div>
            <div className="text-xl font-bold text-cyan-300 mt-1 font-mono">{metrics.notes}</div>
          </div>
        </div>

        {/* Filter Toolbar & View Toggle */}
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
              placeholder="Search activities by user, shot, description..."
            />

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Action Filter */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', 'note_added', 'approve', 'update', 'publish'].map((act) => (
                  <button
                    key={act}
                    onClick={() => {
                      setActionFilter(act);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors text-[11px] ${
                      actionFilter === act
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'timeline'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setViewMode('tabular')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'tabular'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content View */}
        {filteredActivities.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12">
            <EmptyState
              icon={<Activity className="w-6 h-6 text-blue-400" />}
              title="No activities found"
              description={
                search || actionFilter !== 'ALL'
                  ? 'No activity matches your filter criteria.'
                  : 'No team activities recorded yet. Publish a review note or state update to start the feed.'
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-2 bg-blue-600 hover:bg-blue-500"
                >
                  Post First Activity
                </Button>
              }
            />
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <ActivityTimeline activities={paginatedActivities} />
            <div className="mt-6 pt-4 border-t border-slate-800">
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
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {paginatedActivities.map((act: any, idx: number) => (
                    <tr key={act.id || act.uuid || `act-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(act.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-400" />
                          <span>{act.userName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getActionBadge(
                            act.action
                          )}`}
                        >
                          {act.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        <div className="text-blue-400 font-bold">{act.entityName}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{act.entityType}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-md">
                        {act.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
        )}
      </div>

      {/* Record Team Activity Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Record Team Activity"
          subtitle="Publish an artist milestone, supervisor note, or state change to the live activity stream"
          size="lg"
        >
          <form onSubmit={handleAddActivity} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">User Name</label>
                <input
                  type="text"
                  value={newActivity.userName}
                  onChange={(e) => setNewActivity({ ...newActivity, userName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Action Type</label>
                <select
                  value={newActivity.action}
                  onChange={(e) => setNewActivity({ ...newActivity, action: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                >
                  <option value="note_added">note_added</option>
                  <option value="approve">approve</option>
                  <option value="update">update</option>
                  <option value="publish">publish</option>
                  <option value="review_started">review_started</option>
                  <option value="status_changed">status_changed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Entity Type</label>
                <select
                  value={newActivity.entityType}
                  onChange={(e) => setNewActivity({ ...newActivity, entityType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                >
                  <option value="shot">shot</option>
                  <option value="asset">asset</option>
                  <option value="task">task</option>
                  <option value="sequence">sequence</option>
                  <option value="project">project</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Entity Name / Code</label>
                <input
                  type="text"
                  value={newActivity.entityName}
                  onChange={(e) => setNewActivity({ ...newActivity, entityName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  placeholder="e.g. SH_010_030"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Activity Description</label>
              <textarea
                value={newActivity.description}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-blue-500"
                placeholder="What action or milestone was reached?"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                Post Activity
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
