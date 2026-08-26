import React from 'react';
import { BarChart3 } from 'lucide-react';
import { TeamEntity } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const TeamUtilizationTab: React.FC<{ team: TeamEntity }> = ({ team }) => {
  const sprints = [
    { sprint: 'Sprint 31', throughput: '24 shots', hours: 154, rate: 88 },
    { sprint: 'Sprint 32', throughput: '28 shots', hours: 162, rate: 92 },
    { sprint: 'Sprint 33', throughput: '26 shots', hours: 150, rate: 85 },
    { sprint: 'Sprint 34 (Current)', throughput: '30 shots', hours: 158, rate: team.utilization_percentage || 85 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Sprint Velocity & Utilization Trends
          </h3>
          <p className="text-xs text-slate-400">
            Shot throughput, review turnaround, and artist hour efficiency for {team.name}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {sprints.map((s) => (
          <div key={s.sprint} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">{s.sprint}</span>
              <Badge
                variant={s.rate > 90 ? 'warning' : 'success'}
                className="font-mono text-[10px]"
              >
                {s.rate}%
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Output:</span>
                <span className="text-white">{s.throughput}</span>
              </div>
              <div className="flex justify-between">
                <span>Burn Hours:</span>
                <span className="text-emerald-400">{s.hours} hrs</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
