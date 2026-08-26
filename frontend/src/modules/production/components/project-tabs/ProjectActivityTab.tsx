import React, { useState } from 'react';
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
import { Project } from '@/mocks/db/production/projects';
import {
  mockProjectActivities,
  ProjectActivityItem,
} from '@/mocks/db/production/projectDetails';
import { Button } from '@/shared/components/Button';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectActivityTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectActivityTab: React.FC<ProjectActivityTabProps> = ({ project }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const addNotification = useNotificationStore((state) => state.addNotification);

  const activities =
    mockProjectActivities.filter((a) => a.project_id === project.id).length > 0
      ? mockProjectActivities.filter((a) => a.project_id === project.id)
      : mockProjectActivities;

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
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
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
                <img
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
