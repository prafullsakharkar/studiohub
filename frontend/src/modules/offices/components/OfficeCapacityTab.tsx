import React from 'react';
import { Clock, Building2, Users } from 'lucide-react';
import { OfficeEntity } from '@/types/organization';

export const OfficeCapacityTab: React.FC<{ office: OfficeEntity }> = ({ office }) => {
  const workstationOccupancy = Math.round((office.headcount / (office.workstations_count || 120)) * 100);
  const weeklyManHours = office.headcount * 40;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Physical Facility & Workstation Capacity
          </h3>
          <p className="text-xs text-slate-400">
            Physical desk allocation, remote hybrid artist desks, and available seat buffer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Workstations</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block">{office.workstations_count || 120}</span>
          <span className="text-xs text-slate-400 mt-1 block">Physical desk setups</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Occupied Desks</span>
          <span className="text-2xl font-bold font-mono text-indigo-400 mt-1 block">{office.headcount}</span>
          <span className="text-xs text-slate-400 mt-1 block">{workstationOccupancy}% physical occupancy</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Weekly Facility Capacity</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">{weeklyManHours}h</span>
          <span className="text-xs text-slate-400 mt-1 block">Total burn capacity per week</span>
        </div>
      </div>

      {/* Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-slate-400">Desk Occupancy Level</span>
          <span className="font-mono text-white font-bold">{office.headcount} / {office.workstations_count || 120}</span>
        </div>
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all ${
              workstationOccupancy > 90 ? 'bg-rose-500' : workstationOccupancy > 75 ? 'bg-indigo-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, workstationOccupancy)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
