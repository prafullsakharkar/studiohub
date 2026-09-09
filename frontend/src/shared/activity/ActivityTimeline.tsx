import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Search,
  Filter,
  ArrowRight,
  Clock,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  Sparkles,
  Layers,
  Clapperboard,
  Film,
  Box,
  CheckSquare,
  Users,
  Briefcase,
  Building2,
  Calendar,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { ActivityLogItem, ActivityFilterOptions, ActivityActionType } from '@/types/enterprise';
import { EntityType, EntityId } from '@/types/crud';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { Button } from '@/shared/components/Button';

interface ActivityTimelineProps {
  entityType?: EntityType;
  entityId?: EntityId;
  limit?: number;
  showFilters?: boolean;
  showSearch?: boolean;
  showExport?: boolean;
  compact?: boolean;
  className?: string;
  title?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  entityType,
  entityId,
  limit,
  showFilters = true,
  showSearch = true,
  showExport = true,
  compact = false,
  className = '',
  title = 'Activity & Audit Trail',
}) => {
  const navigate = useNavigate();
  const { activities, getFilteredActivities, addActivity, exportActivitiesAsCSV, exportActivitiesAsJSON } = useActivityStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [showSimulateModal, setShowSimulateModal] = useState(false);

  // Toggle diff expansion
  const toggleDiff = (id: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    const filters: ActivityFilterOptions = {
      query: searchQuery,
      actionType: (selectedAction === 'all' ? 'all' : selectedAction) as ActivityActionType | 'all',
      timeframe: selectedTimeframe,
      entityType: entityType || 'all',
    };

    let list = getFilteredActivities(filters);

    if (entityId) {
      list = list.filter((a) => a.entity.id === entityId || a.entity.code === entityId);
    }

    if (limit && limit > 0) {
      return list.slice(0, limit);
    }

    return list;
  }, [activities, searchQuery, selectedAction, selectedTimeframe, entityType, entityId, limit, getFilteredActivities]);

  // Relative time helper
  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHour > 0) return `${diffHour}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'Just now';
  };

  // Action badge color and icon
  const getActionMeta = (action: ActivityActionType) => {
    switch (action) {
      case 'create':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          label: 'Created',
        };
      case 'update':
      case 'status_change':
        return {
          bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
          dot: 'bg-indigo-400',
          label: 'Updated',
        };
      case 'assign':
        return {
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
          dot: 'bg-purple-400',
          label: 'Assigned',
        };
      case 'upload':
        return {
          bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
          dot: 'bg-cyan-400',
          label: 'Published',
        };
      case 'review':
      case 'approve':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          label: 'Review',
        };
      case 'archive':
      case 'delete':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          label: 'Archived',
        };
      default:
        return {
          bg: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
          dot: 'bg-slate-400',
          label: 'Action',
        };
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    const csv = exportActivitiesAsCSV(filteredItems);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `studiohub_audit_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const json = exportActivitiesAsJSON(filteredItems);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `studiohub_audit_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick simulate activity
  const handleSimulateLog = () => {
    addActivity({
      actor: {
        id: 'usr-001',
        name: 'Alex Chen',
        email: 'supervisor@studiohub.vfx',
        role: 'VFX Supervisor',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        department: 'Supervision',
      },
      action: 'status_change',
      actionLabel: 'Shot updated',
      entity: {
        type: entityType || 'shot',
        id: entityId || 'shot-001',
        code: 'NK_010_010',
        name: 'Hero Rooftop Establishing View',
        context: 'Project: Neon Knight • ACEScg',
        deepLink: '/shots',
      },
      description: 'Promoted lighting pass to final review signoff milestone and synchronized pipeline farm jobs.',
      diffs: [
        { field: 'status', label: 'Shot Status', before: 'In Progress', after: 'Approved' },
        { field: 'assigned_lead', label: 'Supervision', before: 'Pending', after: 'Alex Chen' },
      ],
      ipAddress: '192.168.10.45',
      tags: ['live-simulation', 'vfx-signoff'],
    });
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl ${className}`}>
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {filteredItems.length} records
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Immutable audit log with actor attribution, diff tracking & deep-linking
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSimulateLog}
            className="text-xs h-8 gap-1.5 border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Simulate Event</span>
          </Button>

          {showExport && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExportCSV}
                title="Export Filtered Logs as CSV"
                className="text-xs h-8 px-2.5 text-slate-400 hover:text-slate-200"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                <span>CSV</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExportJSON}
                title="Export Filtered Logs as JSON"
                className="text-xs h-8 px-2.5 text-slate-400 hover:text-slate-200"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>JSON</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      {(showSearch || showFilters) && (
        <div className="p-3 sm:p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center gap-2.5">
          {showSearch && (
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search activity description, actor, entity, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-slate-200 placeholder-slate-500 outline-hidden transition-colors"
              />
            </div>
          )}

          {showFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Action Filter */}
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 outline-hidden focus:border-indigo-500"
              >
                <option value="all">All Actions</option>
                <option value="create">Created</option>
                <option value="update">Updated</option>
                <option value="status_change">Status Changed</option>
                <option value="assign">Assigned</option>
                <option value="upload">Uploaded</option>
                <option value="review">Reviewed</option>
                <option value="archive">Archived</option>
              </select>

              {/* Timeframe Filter */}
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 outline-hidden focus:border-indigo-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Timeline Stream */}
      <div className="divide-y divide-slate-800/60 max-h-[650px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">No activity matching your filters</p>
            <p className="text-xs text-slate-500 mt-1">Try broadening your search keywords or resetting filters.</p>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const actionMeta = getActionMeta(item.action);
            const isDiffExpanded = !!expandedDiffs[item.id];
            const hasDiffs = item.diffs && item.diffs.length > 0;

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-slate-800/30 transition-colors flex items-start gap-3.5 group"
              >
                {/* Actor Avatar / Role Node */}
                <div className="relative shrink-0 mt-0.5">
                  {item.actor?.avatarUrl ? (
                    <img
                      src={item.actor.avatarUrl}
                      alt={item.actor.name || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 shadow-sm"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                      {(item.actor?.name || 'User').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${actionMeta.dot}`}
                  />
                </div>

                {/* Content Details */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Top Line: Actor Name, Action Badge, Entity DeepLink, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-200">
                        {item.actor?.name || 'User'}
                      </span>
                      {item.actor?.role && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({item.actor.role})
                        </span>
                      )}

                      {/* Action Pill */}
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${actionMeta.bg}`}
                      >
                        {item.actionLabel}
                      </span>

                      {/* Entity Pill with Deep Link */}
                      <button
                        type="button"
                        onClick={() => {
                          if (item.entity.deepLink) {
                            navigate(item.entity.deepLink);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-colors group-hover:text-indigo-300"
                      >
                        <span className="font-mono text-[11px] text-indigo-400 font-bold">
                          {item.entity.code || item.entity.id}
                        </span>
                        <span className="text-slate-300 truncate max-w-[140px] sm:max-w-[200px]">
                          {item.entity.name}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>

                    {/* Timestamp */}
                    <div
                      className="flex items-center gap-1 text-[11px] text-slate-400 font-mono"
                      title={new Date(item.timestamp).toLocaleString()}
                    >
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatTimeAgo(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Context Subtitle if available */}
                  {item.entity.context && (
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                      <span className="text-slate-500">Context:</span>
                      <span className="text-slate-300">{item.entity.context}</span>
                    </div>
                  )}

                  {/* Before / After Diff Visualizer */}
                  {hasDiffs && (
                    <div className="pt-1.5">
                      <button
                        type="button"
                        onClick={() => toggleDiff(item.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <span>{isDiffExpanded ? 'Hide Before / After changes' : `View ${item.diffs!.length} state changes`}</span>
                        {isDiffExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {isDiffExpanded && (
                        <div className="mt-2 p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 animate-in fade-in duration-150">
                          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 flex justify-between">
                            <span>Field Attribute</span>
                            <span>State Transition (Before ➔ After)</span>
                          </div>
                          {item.diffs!.map((diff, dIdx) => (
                            <div
                              key={dIdx}
                              className="flex flex-wrap items-center justify-between text-xs py-1 border-b border-slate-900 last:border-0 gap-2"
                            >
                              <span className="font-mono text-slate-300 text-[11px]">
                                {diff.label} ({diff.field}):
                              </span>
                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                <span className="line-through text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/40">
                                  {String(diff.before ?? 'None')}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                <span className="text-emerald-300 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40 font-semibold">
                                  {String(diff.after ?? 'None')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Meta (IP Address & Tags) */}
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500 font-mono flex-wrap">
                    {item.ipAddress && <span>IP: {item.ipAddress}</span>}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 rounded bg-slate-800/60 text-slate-400 border border-slate-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
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
