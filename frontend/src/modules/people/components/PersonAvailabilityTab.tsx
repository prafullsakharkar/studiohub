import React, { useState } from 'react';
import { Clock, Calendar, CheckCircle2, AlertCircle, ShieldAlert, UserCheck } from 'lucide-react';
import { Person } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const PersonAvailabilityTab: React.FC<{
  person: Person;
  onUpdateStatus?: (status: any) => void;
}> = ({ person, onUpdateStatus }) => {
  const [currentStatus, setCurrentStatus] = useState(person.availability_status);

  const statuses = [
    { label: 'Available', desc: 'Ready for new shot allocations', color: 'text-emerald-400' },
    { label: 'Assigned 100%', desc: 'At full weekly sprint capacity', color: 'text-indigo-400' },
    { label: 'Overallocated', desc: 'Exceeding 40h/week across shows', color: 'text-rose-400' },
    { label: 'On Leave', desc: 'PTO / Sabbatical / Travel', color: 'text-amber-400' },
  ];

  const handleSelect = (statusLabel: any) => {
    setCurrentStatus(statusLabel);
    if (onUpdateStatus) onUpdateStatus(statusLabel);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Artist Availability & Workload Schedule
          </h3>
          <p className="text-xs text-slate-400">
            Workload allocation affects automated dispatch and task assignment suggestions in production boards.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {statuses.map((s) => {
          const isSelected = currentStatus === s.label;
          return (
            <div
              key={s.label}
              onClick={() => handleSelect(s.label)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/50'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-bold text-sm ${s.color}`}>{s.label}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-2">{s.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Weekly Capacity Breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <h4 className="text-xs font-bold font-mono uppercase text-slate-300">Sprint Capacity Utilization</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Weekly Quota (40 Hours Base)</span>
            <span className="font-mono text-white font-bold">{person.logged_hours}h Logged</span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (person.logged_hours / 40) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
