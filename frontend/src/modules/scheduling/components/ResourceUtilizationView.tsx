import React from 'react';
import { Resource, SchedulingCapacitySummary } from '@/types/scheduling';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  ShieldAlert,
  Zap,
  BarChart3,
  Flame,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ResourceUtilizationViewProps {
  resources: Resource[];
  capacitySummaries: SchedulingCapacitySummary[];
}

export const ResourceUtilizationView: React.FC<ResourceUtilizationViewProps> = ({
  resources,
  capacitySummaries,
}) => {
  // Sort resources by utilization descending
  const sortedResources = [...resources].sort((a, b) => b.utilization_pct - a.utilization_pct);
  const overUtilized = sortedResources.filter((r) => r.utilization_pct > 100);
  const optimalUtilized = sortedResources.filter((r) => r.utilization_pct >= 70 && r.utilization_pct <= 100);
  const underUtilized = sortedResources.filter((r) => r.utilization_pct < 70);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Banner Overview */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Studio Resource Utilization & Overtime Analytics
          </h2>
          <p className="text-xs text-slate-400">
            Real-time crew utilization balance across all production departments and locations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-red-500/10 text-red-300 border border-red-500/20">
            {overUtilized.length} Over-Utilized (&gt;100%)
          </span>
          <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {optimalUtilized.length} Optimal (70-100%)
          </span>
          <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
            {underUtilized.length} Free Capacity (&lt;70%)
          </span>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-950/20">
        {/* Critical Burnout / Over-Utilized Alert Section */}
        {overUtilized.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
              <Flame className="w-4 h-4 text-red-400" />
              Over-Utilized Crew & Bottlenecks (Action Required)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overUtilized.map((res) => (
                <div
                  key={res.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-red-900/60 shadow-md space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 font-bold flex items-center justify-center text-xs shrink-0">
                        {res.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-100 truncate">{res.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{res.role || res.department_name}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-red-500/20 text-red-400 border border-red-500/40">
                      {res.utilization_pct}%
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Hours Booked:</span>
                      <span className="text-red-300 font-bold">
                        {res.assigned_hours_current_week}h / {res.capacity_weekly_hours}h
                      </span>
                    </div>
                    <p className="text-[10px] text-red-300/80 truncate">
                      {res.overbooking_reason || 'Simultaneous heavy shot deadlines.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Resource Roster Ranked by Load */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Crew Workload Distribution Table
          </h3>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-lg divide-y divide-slate-800">
            {sortedResources.map((res) => {
              const isHigh = res.utilization_pct > 100;
              const isMed = res.utilization_pct >= 70 && res.utilization_pct <= 100;

              return (
                <div
                  key={res.id}
                  className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 md:w-1/3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {res.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{res.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{res.role || res.department_name}</p>
                    </div>
                  </div>

                  {/* Utilization Visual Bar */}
                  <div className="flex-1 max-w-xs space-y-1">
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isHigh ? 'bg-red-500' : isMed ? 'bg-indigo-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, res.utilization_pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Hours & Utilization Tag */}
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div className="font-mono text-xs text-slate-300">
                      <span className="font-bold">{res.assigned_hours_current_week}</span> / {res.capacity_weekly_hours}h
                    </div>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isHigh
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isMed
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {res.utilization_pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
