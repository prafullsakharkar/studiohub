import React from 'react';
import { SchedulingCapacitySummary, Resource } from '@/types/scheduling';
import {
  Users,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
  Sliders,
} from 'lucide-react';

interface ResourceCapacityViewProps {
  capacitySummaries: SchedulingCapacitySummary[];
  resources: Resource[];
}

export const ResourceCapacityView: React.FC<ResourceCapacityViewProps> = ({
  capacitySummaries,
  resources,
}) => {
  const totalCapacityHours = capacitySummaries.reduce((acc, c) => acc + c.total_capacity_hours, 0);
  const totalAllocatedHours = capacitySummaries.reduce((acc, c) => acc + c.allocated_hours, 0);
  const totalFreeHours = capacitySummaries.reduce((acc, c) => acc + c.free_hours, 0);
  const overallUtilizationPct = totalCapacityHours > 0 ? Math.round((totalAllocatedHours / totalCapacityHours) * 100) : 0;
  const totalOverbookedDepts = capacitySummaries.filter((c) => c.overbooked_count > 0).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* KPI Overview Strip */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Studio Capacity</p>
            <h3 className="text-2xl font-black text-slate-100 font-mono mt-1">{totalCapacityHours}h</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Across 42 production crew</p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Allocated Workload</p>
            <h3 className="text-2xl font-black text-indigo-300 font-mono mt-1">{totalAllocatedHours}h</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{overallUtilizationPct}% Studio Load</p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Free Runway Capacity</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono mt-1">{totalFreeHours}h</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Available for sprint spillover</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overbooked Departments</p>
            <h3 className="text-2xl font-black text-red-400 font-mono mt-1">{totalOverbookedDepts}</h3>
            <p className="text-[11px] text-red-300/80 mt-0.5">Exceeding 100% capacity</p>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Department Capacity Breakdown Table */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-950/20 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Departmental Weekly Workload & Capacity Balance
        </h3>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-lg divide-y divide-slate-800">
          {capacitySummaries.map((summary) => {
            const isOverloaded = summary.utilization_pct > 100;
            const isNearCapacity = summary.utilization_pct >= 85 && summary.utilization_pct <= 100;

            return (
              <div
                key={summary.department}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
              >
                {/* Department Info */}
                <div className="space-y-1 md:w-1/4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-100">{summary.department}</h4>
                    {summary.overbooked_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        {summary.overbooked_count} Overbooked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {summary.total_resources} Active Resources & Artists
                  </p>
                </div>

                {/* Progress Visualizer */}
                <div className="flex-1 space-y-1.5 max-w-md">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Workload:</span>
                    <span className="font-bold text-slate-200">
                      {summary.allocated_hours}h / {summary.total_capacity_hours}h
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOverloaded
                          ? 'bg-red-500'
                          : isNearCapacity
                          ? 'bg-amber-400'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, summary.utilization_pct)}%` }}
                    />
                  </div>
                </div>

                {/* Metric Readouts */}
                <div className="flex items-center gap-6 justify-end">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Free Runway</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">{summary.free_hours}h</p>
                  </div>
                  <div className="text-right min-w-[70px]">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Utilization</p>
                    <p
                      className={`text-base font-mono font-black ${
                        isOverloaded
                          ? 'text-red-400'
                          : isNearCapacity
                          ? 'text-amber-400'
                          : 'text-indigo-300'
                      }`}
                    >
                      {summary.utilization_pct}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
