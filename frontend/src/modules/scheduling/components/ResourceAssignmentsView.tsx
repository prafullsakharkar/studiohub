import React, { useState } from 'react';
import { Resource, CalendarEvent } from '@/types/scheduling';
import {
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Film,
  ArrowRight,
  Filter,
  Plus,
} from 'lucide-react';
import { formatEventDate } from '../utils/calendarHelpers';

interface ResourceAssignmentsViewProps {
  resources: Resource[];
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onAddAssignment: () => void;
}

export const ResourceAssignmentsView: React.FC<ResourceAssignmentsViewProps> = ({
  resources,
  events,
  onSelectEvent,
  onAddAssignment,
}) => {
  const [selectedDept, setSelectedDept] = useState('ALL');

  const filteredResources = resources.filter((r) => {
    if (r.type !== 'person' && r.type !== 'team') return false;
    if (selectedDept !== 'ALL' && r.department_name?.toLowerCase() !== selectedDept.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            Task Assignments & Crew Allocations
          </h2>
          <p className="text-xs text-slate-400">
            Active task bookings, daily hour allocations, and assigned shots
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="ALL">All Departments</option>
            <option value="Compositing">Compositing</option>
            <option value="FX Simulation">FX Simulation</option>
            <option value="Matchmove & Tracking">Matchmove & Tracking</option>
            <option value="Character Animation">Character Animation</option>
            <option value="Lighting & LookDev">Lighting & LookDev</option>
          </select>

          <button
            onClick={onAddAssignment}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Assign Task
          </button>
        </div>
      </div>

      {/* Roster of Assignments */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-950/20">
        {filteredResources.map((res) => {
          const resEvents = events.filter(
            (e) => (e.assignee_ids.includes(res.id) || e.primary_assignee_id === res.id) && e.event_type === 'task'
          );

          return (
            <div
              key={res.id}
              className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
            >
              {/* Resource Info Banner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                    {res.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{res.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      {res.role} • {res.department_name} ({res.office_name})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-400">
                    Allocated: <span className="font-bold text-slate-200">{res.assigned_hours_current_week}h</span> / {res.capacity_weekly_hours}h
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      res.utilization_pct > 100
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-indigo-500/20 text-indigo-300'
                    }`}
                  >
                    {res.utilization_pct}%
                  </span>
                </div>
              </div>

              {/* Task Items Assigned */}
              {resEvents.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No active tasks assigned this sprint</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                  {resEvents.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => onSelectEvent(evt)}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 cursor-pointer transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-200 truncate">{evt.title}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                          {evt.project_code || 'NK99'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{formatEventDate(evt.start_date)} → {formatEventDate(evt.end_date)}</span>
                        <span className="text-emerald-400 font-bold">{evt.progress_pct || 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
