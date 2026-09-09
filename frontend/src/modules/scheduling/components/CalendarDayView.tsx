import React from 'react';
import { CalendarEvent, Resource, StudioHoliday, ResourceLeave } from '@/types/scheduling';
import {
  isEventOnDate,
  getEventTypeBadge,
  formatEventTime,
  getPriorityBadge,
} from '../utils/calendarHelpers';
import {
  Clock,
  MapPin,
  Users,
  Cpu,
  ShieldAlert,
  Calendar,
  PlayCircle,
  Plus,
} from 'lucide-react';

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  resources: Resource[];
  holidays: StudioHoliday[];
  leaves: ResourceLeave[];
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: () => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  currentDate,
  events,
  resources,
  holidays,
  leaves,
  onSelectEvent,
  onAddEvent,
}) => {
  const dateStr = currentDate.toISOString().split('T')[0];
  const dayEvents = events.filter((e) => isEventOnDate(e, currentDate));
  const dayHoliday = holidays.find((h) => h.date === dateStr);
  const dayLeaves = leaves.filter((l) => dateStr >= l.start_date && dateStr <= l.end_date);

  // Group events by Tracks (Suites & Bays, Supervisors & Leads, Tasks)
  const reviewAndSuitesEvents = dayEvents.filter((e) => e.event_type === 'review' || (e.equipment_ids && e.equipment_ids.length > 0));
  const milestonesAndDeliveries = dayEvents.filter((e) => e.event_type === 'milestone' || e.event_type === 'delivery');
  const taskAssignments = dayEvents.filter((e) => e.event_type === 'task' || e.event_type === 'project');
  const meetingsAndScrums = dayEvents.filter((e) => e.event_type === 'meeting');

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Day Overview Banner */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              {dayHoliday && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {dayHoliday.name}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              {dayEvents.length} scheduled production events across Montreal, London & Vancouver sites
            </p>
          </div>
        </div>

        <button
          onClick={onAddEvent}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Schedule Event
        </button>
      </div>

      {/* Main Track Columns */}
      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 custom-scrollbar bg-slate-950/20">
        {/* Track 1: Dailies, Screening Theaters & Equipment */}
        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Dailies & Screening Bays
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
              {reviewAndSuitesEvents.length}
            </span>
          </div>
          <div className="p-3 space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
            {reviewAndSuitesEvents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No screening sessions booked</p>
            ) : (
              reviewAndSuitesEvents.map((evt) => {
                const badge = getEventTypeBadge(evt.event_type);
                return (
                  <div
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-cyan-500/50 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-100 truncate">{evt.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                        {evt.project_code || 'NK99'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {formatEventTime(evt.start_date)} - {formatEventTime(evt.end_date)}
                    </div>
                    {evt.location_or_link && (
                      <p className="text-[11px] text-slate-400 truncate">📍 {evt.location_or_link}</p>
                    )}
                    {evt.primary_assignee_name && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-[9px] font-bold flex items-center justify-center text-white">
                          {evt.primary_assignee_name.charAt(0)}
                        </span>
                        <span className="truncate">{evt.primary_assignee_name}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Track 2: Milestones & Deliveries */}
        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Milestones & Aspera Deliveries
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-pink-400">
              {milestonesAndDeliveries.length}
            </span>
          </div>
          <div className="p-3 space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
            {milestonesAndDeliveries.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No turnover gates on this date</p>
            ) : (
              milestonesAndDeliveries.map((evt) => {
                const isDelivery = evt.event_type === 'delivery';
                return (
                  <div
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    className={`p-3 rounded-xl bg-slate-900 border cursor-pointer transition-all space-y-2 ${
                      isDelivery
                        ? 'border-emerald-500/30 hover:border-emerald-500'
                        : 'border-pink-500/30 hover:border-pink-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-100 truncate">{evt.title}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          isDelivery ? 'bg-emerald-500/20 text-emerald-300' : 'bg-pink-500/20 text-pink-300'
                        }`}
                      >
                        {evt.project_code || 'NK99'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{evt.department || 'Production'}</span>
                      <span className="font-semibold text-amber-400">{evt.priority}</span>
                    </div>
                    {evt.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">{evt.description}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Track 3: Department Tasks & In-Progress Sprints */}
        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Department Task Blocks
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-400">
              {taskAssignments.length}
            </span>
          </div>
          <div className="p-3 space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
            {taskAssignments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No scheduled tasks</p>
            ) : (
              taskAssignments.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent(evt)}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-100 truncate">{evt.title}</span>
                    {evt.task_code && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                        {evt.task_code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{evt.department}</span>
                    <span className="font-mono text-emerald-400">{evt.progress_pct || 0}% Done</span>
                  </div>
                  {evt.primary_assignee_name && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">
                        {evt.primary_assignee_name.charAt(0)}
                      </div>
                      <span className="truncate">{evt.primary_assignee_name}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Track 4: Production Scrums & Crew Leaves */}
        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Scrums & Availability
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-purple-400">
              {meetingsAndScrums.length + dayLeaves.length}
            </span>
          </div>
          <div className="p-3 space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
            {/* Leaves in track */}
            {dayLeaves.map((l) => (
              <div
                key={l.id}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">🌴 {l.resource_name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {l.leave_type}
                  </span>
                </div>
                {l.notes && <p className="text-[11px] text-slate-400">{l.notes}</p>}
              </div>
            ))}

            {meetingsAndScrums.map((evt) => (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-100 truncate">{evt.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                    Meeting
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                  <Clock className="w-3 h-3 text-purple-400" />
                  {formatEventTime(evt.start_date)} - {formatEventTime(evt.end_date)}
                </div>
                {evt.location_or_link && (
                  <p className="text-[11px] text-slate-400 truncate">🔗 {evt.location_or_link}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
