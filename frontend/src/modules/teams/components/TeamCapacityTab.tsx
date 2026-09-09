import React from 'react';
import { Clock, Users2 } from 'lucide-react';
import { TeamEntity } from '@/types/organization';

export const TeamCapacityTab: React.FC<{ team: TeamEntity }> = ({ team }) => {
  const weeklyCapacity = team.capacity_hours_weekly || 160;
  const currentUtilization = team.utilization_percentage || 85;
  const bookedHours = Math.round((weeklyCapacity * currentUtilization) / 100);
  const remainingHours = Math.max(0, weeklyCapacity - bookedHours);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Squad Capacity & Allocation Limits
          </h3>
          <p className="text-xs text-slate-400">
            Workload allocation across {team.member_count} dedicated squad artists.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Weekly Quota</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block">{weeklyCapacity}h</span>
          <span className="text-xs text-slate-400 mt-1 block">{team.member_count} artists × 40 hrs</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Current Load</span>
          <span className="text-2xl font-bold font-mono text-indigo-400 mt-1 block">{bookedHours}h</span>
          <span className="text-xs text-slate-400 mt-1 block">{currentUtilization}% utilization</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Available Headroom</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">{remainingHours}h</span>
          <span className="text-xs text-slate-400 mt-1 block">Free buffer for rush tasks</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-slate-400">Squad Workload vs Target</span>
          <span className="font-mono text-white font-bold">{bookedHours}h / {weeklyCapacity}h</span>
        </div>
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all ${
              currentUtilization > 90 ? 'bg-rose-500' : currentUtilization > 75 ? 'bg-indigo-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, currentUtilization)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
