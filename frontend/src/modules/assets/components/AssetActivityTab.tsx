import React, { useState } from 'react';
import {
  Activity,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  FileCode,
  User,
  Clock,
  Filter,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Asset } from '@/mocks/db/assets/assets';
import { Badge } from '@/shared/components/Badge';

interface AssetActivityTabProps {
  asset: Asset;
}

export const AssetActivityTab: React.FC<AssetActivityTabProps> = ({ asset }) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const activities = [
    {
      id: 'act-01',
      type: 'Review Sign-off',
      user: 'Alex Chen',
      user_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      action: 'signed off LookDev Dailies for',
      target: `Version ${asset.version || 'v009'}`,
      timestamp: '2 hours ago',
      details: 'Approved hero clearcoat paint and emissive HUD shaders in ACEScg color space.',
    },
    {
      id: 'act-02',
      type: 'Version Published',
      user: 'Sarah Jenkins',
      user_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      action: 'published new OpenUSD release',
      target: asset.version || 'v009',
      timestamp: '1 day ago',
      details: 'Automated Pyblish schema validation passed with 0 errors.',
    },
    {
      id: 'act-03',
      type: 'Task Completed',
      user: 'Elena Rostova',
      user_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      action: 'completed task',
      target: 'MaterialX LookDev & 8K UDIM Shaders',
      timestamp: '3 days ago',
      details: 'Broke down 42 UDIM texture tiles and linked MaterialX graph.',
    },
    {
      id: 'act-04',
      type: 'Status Change',
      user: 'Sarah Jenkins',
      user_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      action: 'changed status to',
      target: asset.status,
      timestamp: '5 days ago',
      details: 'Promoted asset from Work-In-Progress to Approved turnover candidate.',
    },
    {
      id: 'act-05',
      type: 'Asset Registered',
      user: 'Pipeline TD',
      user_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      action: 'registered asset in OpenUSD database',
      target: asset.code,
      timestamp: '2 weeks ago',
      details: `Initialized stage prim at ${asset.usd_prim_path || `/World/Assets/${asset.code}`}`,
    },
  ];

  const filteredActivities = activities.filter((act) => {
    if (filterType !== 'ALL' && act.type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Asset Audit Trail & Event Timeline
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of publishing, status changes, task handoffs, and director approvals
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
          >
            <option value="ALL">All Event Types</option>
            <option value="Review Sign-off">Review Sign-off</option>
            <option value="Version Published">Version Published</option>
            <option value="Task Completed">Task Completed</option>
            <option value="Status Change">Status Change</option>
          </select>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-3">
        {filteredActivities.map((act) => (
          <div key={act.id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-emerald-400 group-hover:scale-125 transition-transform flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center space-x-2">
                  <img
                    src={act.user_avatar}
                    alt={act.user}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="text-xs font-bold text-white">{act.user}</span>
                  <span className="text-xs text-slate-400">{act.action}</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{act.target}</span>
                </div>

                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 self-end sm:self-center">
                  <Clock className="w-3 h-3 text-slate-500" /> {act.timestamp}
                </span>
              </div>

              {act.details && (
                <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                  {act.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
