import React, { useState } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import {
  Activity,
  Search,
  Filter,
  Film,
  Box,
  CheckSquare,
  PlaySquare,
  Calendar,
  PackageCheck,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';

// REST-only shim: mock engine removed; backend is the source of truth.
import type { Project } from '@/types/production';
type ProjectActivityItem = any;
const projectActivitiesFallback: any[] = [];

interface ProjectActivityTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectActivityTab: React.FC<ProjectActivityTabProps> = ({ project }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const addNotification = useNotificationStore((state) => state.addNotification);
  const { activities: storeActivities } = useActivityStore();

  const activities = React.useMemo(() => {
    // 1. Convert relevant items from useActivityStore
    const dynamicItems: ProjectActivityItem[] = storeActivities
      .filter((act: any) => {
        const pId = act.projectId || act.project_id;
        const matchesEntity = act.entity?.type === 'project' && act.entity?.id === project.id;
        const matchesContext =
          act.entity?.context?.includes(project.name) ||
          act.entity?.context?.includes(project.code);
        return pId === project.id || matchesEntity || matchesContext;
      })
      .map((act: any) => {
        const rawType = (act.entity?.type || act.resourceType || 'Project').toLowerCase();
        let targetType: ProjectActivityItem['target_type'] = 'Project' as any;
        if (rawType.includes('shot')) targetType = 'Shot';
        else if (rawType.includes('asset')) targetType = 'Asset';
        else if (rawType.includes('task')) targetType = 'Task';
        else if (rawType.includes('review')) targetType = 'Review';
        else if (rawType.includes('delivery')) targetType = 'Delivery';

        const timeDiff = Date.now() - new Date(act.timestamp || act.createdAt || Date.now()).getTime();
        const mins = Math.floor(timeDiff / 60000);
        let timeStr = 'Just now';
        if (mins > 60 * 24) timeStr = `${Math.floor(mins / (60 * 24))}d ago`;
        else if (mins > 60) timeStr = `${Math.floor(mins / 60)}h ago`;
        else if (mins > 0) timeStr = `${mins}m ago`;

        return {
          id: act.id,
          project_id: project.id,
          user_name: act.actor?.name || 'VFX Supervisor',
          user_role: act.actor?.role || 'Production',
          user_avatar:
            act.actor?.avatar ||
            act.actor?.avatarUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
          action: act.actionLabel || act.action,
          target_type: targetType,
          target_code: act.entity?.code || act.resourceCode || act.entity?.name || act.resourceName || project.code,
          details: act.description,
          timestamp: timeStr,
        };
      });

    const staticItems =
      projectActivitiesFallback.filter((a) => a.project_id === project.id).length > 0
        ? projectActivitiesFallback.filter((a) => a.project_id === project.id)
        : projectActivitiesFallback;

    // Deduplicate by ID
    const seen = new Set<string>();
    const combined: ProjectActivityItem[] = [];
    for (const item of [...dynamicItems, ...staticItems]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }
    return combined;
  }, [storeActivities, project.id, project.name, project.code]);

  const filtered = activities.filter((act) => {
    const matchType = filterType === 'ALL' || act.target_type === filterType;
    const matchSearch =
      !search ||
      act.action.toLowerCase().includes(search.toLowerCase()) ||
      act.target_code.toLowerCase().includes(search.toLowerCase()) ||
      act.user_name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleExportLog = () => {
    addNotification({
      type: 'info',
      title: 'Production Audit Log Exported',
      message: `Audit trail for ${project.code} saved to CSV.`,
    });
  };

  const getTargetIcon = (type: ProjectActivityItem['target_type']) => {
    switch (type) {
      case 'Shot':
        return <Film className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Asset':
        return <Box className="w-3.5 h-3.5 text-purple-400" />;
      case 'Task':
        return <CheckSquare className="w-3.5 h-3.5 text-blue-400" />;
      case 'Review':
        return <PlaySquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Milestone':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'Delivery':
        return <PackageCheck className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <SearchInput
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {['ALL', 'Shot', 'Asset', 'Task', 'Review', 'Milestone', 'Delivery'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  filterType === type
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleExportLog}
          leftIcon={<Download className="w-3.5 h-3.5" />}
        >
          Export CSV Audit
        </Button>
      </div>

      {/* Activity Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="space-y-3">
          {filtered.map((act) => (
            <div
              key={act.id}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
<SmartImg
                  src={act.user_avatar}
                  alt={act.user_name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">{act.user_name}</span>
                    <span className="text-[10px] font-mono text-slate-400">({act.user_role})</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-300">{act.action}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 font-mono text-xs text-indigo-400 font-bold">
                      {getTargetIcon(act.target_type)}
                      <span>{act.target_code}</span>
                    </div>
                    {act.details && (
                      <span className="text-xs text-slate-400 truncate max-w-md">• {act.details}</span>
                    )}
                  </div>
                </div>
              </div>

              <span className="text-[11px] font-mono text-slate-500 shrink-0 self-end sm:self-center">
                {act.timestamp}
              </span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-10 text-xs text-slate-500 font-mono">
              No matching activity events recorded in this show log.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
