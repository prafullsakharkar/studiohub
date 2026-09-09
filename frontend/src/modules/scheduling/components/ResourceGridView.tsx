import React, { useState } from 'react';
import { Resource, ResourceCategory } from '@/types/scheduling';
import {
  Users,
  Cpu,
  MapPin,
  Building,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';

interface ResourceGridViewProps {
  resources: Resource[];
  onSelectResource: (resource: Resource) => void;
  onQuickAssign?: (resource: Resource) => void;
}

export const ResourceGridView: React.FC<ResourceGridViewProps> = ({
  resources,
  onSelectResource,
  onQuickAssign,
}) => {
  const [activeTab, setActiveTab] = useState<ResourceCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = resources.filter((r) => {
    if (activeTab !== 'all' && r.type !== activeTab) return false;
    if (statusFilter !== 'ALL' && r.availability_status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string, isOverbooked?: boolean) => {
    if (isOverbooked) {
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    }
    switch (status) {
      case 'Available':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Assigned':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'Partially Available':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'On Leave':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
      case 'Maintenance':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Subnav & Filters Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {(
            [
              { id: 'all', label: 'All Resources', count: resources.length },
              { id: 'person', label: 'People / Artists', count: resources.filter((r) => r.type === 'person').length },
              { id: 'team', label: 'Teams', count: resources.filter((r) => r.type === 'team').length },
              { id: 'department', label: 'Departments', count: resources.filter((r) => r.type === 'department').length },
              { id: 'office', label: 'Studios / Offices', count: resources.filter((r) => r.type === 'office').length },
              { id: 'equipment', label: 'Equipment & Suites', count: resources.filter((r) => r.type === 'equipment').length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-semibold">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="Available">Available (Free Capacity)</option>
            <option value="Assigned">Assigned (Active)</option>
            <option value="Overbooked">Overbooked Conflicts</option>
            <option value="On Leave">On Leave</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Grid Matrix */}
      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 custom-scrollbar bg-slate-950/20">
        {filtered.map((res) => {
          const isPerson = res.type === 'person';
          const isEq = res.type === 'equipment';

          return (
            <div
              key={res.id}
              onClick={() => onSelectResource(res)}
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/60 hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isPerson ? (
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                        {res.name.charAt(0)}
                      </div>
                    ) : isEq ? (
                      <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0">
                        <Cpu className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                        <Building className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                        {res.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate font-mono">
                        {res.role || res.department_name || res.code}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getStatusBadge(
                      res.availability_status,
                      res.is_overbooked
                    )}`}
                  >
                    {res.is_overbooked ? 'Overbooked' : res.availability_status}
                  </span>
                </div>

                {/* Overbooking Reason Banner */}
                {res.is_overbooked && (
                  <div className="p-2 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-[11px] flex items-center gap-1.5 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    <span className="truncate">{res.overbooking_reason}</span>
                  </div>
                )}
              </div>

              {/* Weekly Capacity & Utilization Bar */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Weekly Hours:</span>
                  <span className="font-bold text-slate-200">
                    {res.assigned_hours_current_week}h / {res.capacity_weekly_hours}h
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      res.utilization_pct > 100
                        ? 'bg-red-500'
                        : res.utilization_pct > 80
                        ? 'bg-amber-400'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, res.utilization_pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Utilization:</span>
                  <span
                    className={`font-mono font-bold ${
                      res.utilization_pct > 100
                        ? 'text-red-400'
                        : res.utilization_pct > 80
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {res.utilization_pct}%
                  </span>
                </div>
              </div>

              {/* Meta details / skills / office */}
              <div className="space-y-2 text-xs">
                {res.office_name && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span className="truncate">{res.office_name}</span>
                  </div>
                )}

                {res.skills && res.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {res.skills.slice(0, 3).map((s, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-800 font-mono"
                      >
                        {s}
                      </span>
                    ))}
                    {res.skills.length > 3 && (
                      <span className="text-[10px] text-slate-500 font-bold self-center">
                        +{res.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {res.assignments && res.assignments.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{res.assignments.length} Active Tasks</span>
                    <span className="font-mono text-indigo-400">
                      {res.assignments[0].project_code || 'NK99'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
