import React, { useState } from 'react';
import { CalendarEvent, Resource } from '@/types/scheduling';
import { getEventTypeBadge } from '../utils/calendarHelpers';
import {
  Calendar,
  Users,
  Film,
  Cpu,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Layers,
  Flag,
  Send,
} from 'lucide-react';

interface CalendarTimelineViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  resources: Resource[];
  onSelectEvent: (event: CalendarEvent) => void;
}

export const CalendarTimelineView: React.FC<CalendarTimelineViewProps> = ({
  currentDate,
  events,
  resources,
  onSelectEvent,
}) => {
  const [groupBy, setGroupBy] = useState<'resource' | 'department' | 'project' | 'equipment'>('resource');
  const [timelineWindowDays, setTimelineWindowDays] = useState<number>(21); // 3-week window

  // Calculate day headers starting from current date - 3 days to current date + 18 days
  const startDate = new Date(currentDate);
  startDate.setDate(startDate.getDate() - 3);

  const timelineDays: Date[] = [];
  for (let i = 0; i < timelineWindowDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    timelineDays.push(d);
  }

  // Calculate left % and width % for an event inside the timelineDays window
  const getEventStyle = (evt: CalendarEvent) => {
    const windowStartMs = timelineDays[0].getTime();
    const windowEndMs = timelineDays[timelineDays.length - 1].getTime() + 86400000;
    const windowDuration = windowEndMs - windowStartMs;

    const eventStartMs = new Date(evt.start_date.split('T')[0]).getTime();
    const eventEndMs = new Date(evt.end_date.split('T')[0]).getTime() + 86400000;

    // Check if event is within visible window
    if (eventEndMs < windowStartMs || eventStartMs > windowEndMs) {
      return null;
    }

    const clampedStart = Math.max(windowStartMs, eventStartMs);
    const clampedEnd = Math.min(windowEndMs, eventEndMs);

    const leftPct = ((clampedStart - windowStartMs) / windowDuration) * 100;
    const widthPct = Math.max(1.8, ((clampedEnd - clampedStart) / windowDuration) * 100);

    return { left: `${leftPct}%`, width: `${widthPct}%` };
  };

  // Group items
  const renderRows = () => {
    if (groupBy === 'resource') {
      const activeResources = resources.filter((r) => r.type === 'person');
      return activeResources.map((res) => {
        const resEvents = events.filter(
          (e) => e.assignee_ids.includes(res.id) || e.primary_assignee_id === res.id
        );

        return (
          <div
            key={res.id}
            className="grid grid-cols-[220px_1fr] border-b border-slate-800/70 hover:bg-slate-850/40 transition-colors min-h-[48px]"
          >
            {/* Left Header */}
            <div className="p-2.5 border-r border-slate-800 flex items-center justify-between gap-2 bg-slate-900/90">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {res.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">{res.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{res.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {res.is_overbooked && (
                  <span title="Overbooked">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  </span>
                )}
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    res.utilization_pct > 100
                      ? 'bg-red-500/20 text-red-400'
                      : res.utilization_pct > 75
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {res.utilization_pct}%
                </span>
              </div>
            </div>

            {/* Right Timeline Track */}
            <div className="relative flex items-center min-h-[48px] bg-slate-950/20">
              {/* Day grid guideline columns */}
              <div className="absolute inset-0 grid grid-cols-[repeat(21,1fr)] pointer-events-none divide-x divide-slate-800/30" />

              {/* Event bars */}
              {resEvents.map((evt) => {
                const style = getEventStyle(evt);
                if (!style) return null;
                const badge = getEventTypeBadge(evt.event_type);

                return (
                  <div
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    style={style}
                    title={`${evt.title} (${evt.project_code || 'STUDIO'})`}
                    className={`absolute h-7 rounded-lg border text-xs font-medium cursor-pointer shadow-md flex items-center justify-between px-2 gap-1.5 transition-all hover:scale-[1.01] hover:brightness-110 z-10 ${badge.bg} ${badge.border} ${badge.text}`}
                  >
                    <span className="truncate text-[11px] font-bold">{evt.title}</span>
                    {evt.project_code && (
                      <span className="text-[9px] font-mono opacity-80 shrink-0 font-bold">
                        {evt.project_code}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      });
    }

    if (groupBy === 'equipment') {
      const eqResources = resources.filter((r) => r.type === 'equipment');
      return eqResources.map((res) => {
        const eqEvents = events.filter((e) => e.equipment_ids?.includes(res.id));

        return (
          <div
            key={res.id}
            className="grid grid-cols-[220px_1fr] border-b border-slate-800/70 hover:bg-slate-850/40 transition-colors min-h-[48px]"
          >
            <div className="p-2.5 border-r border-slate-800 flex items-center justify-between gap-2 bg-slate-900/90">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded bg-purple-500/10 text-purple-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">{res.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{res.office_name}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-bold">
                {res.availability_status}
              </span>
            </div>

            <div className="relative flex items-center min-h-[48px] bg-slate-950/20">
              <div className="absolute inset-0 grid grid-cols-[repeat(21,1fr)] pointer-events-none divide-x divide-slate-800/30" />
              {eqEvents.map((evt) => {
                const style = getEventStyle(evt);
                if (!style) return null;
                const badge = getEventTypeBadge(evt.event_type);

                return (
                  <div
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    style={style}
                    className={`absolute h-7 rounded-lg border text-xs font-medium cursor-pointer shadow-md flex items-center justify-between px-2 gap-1.5 transition-all hover:brightness-110 z-10 ${badge.bg} ${badge.border} ${badge.text}`}
                  >
                    <span className="truncate text-[11px] font-bold">{evt.title}</span>
                    <span className="text-[9px] font-mono opacity-80">{evt.project_code || 'STUDIO'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      });
    }

    // Default by Project
    const projects = ['NK99', 'DUNE', 'CP88', 'AVTR'];
    return projects.map((code) => {
      const projEvents = events.filter((e) => e.project_code === code);

      return (
        <div
          key={code}
          className="grid grid-cols-[220px_1fr] border-b border-slate-800/70 hover:bg-slate-850/40 transition-colors min-h-[56px]"
        >
          <div className="p-3 border-r border-slate-800 flex items-center justify-between gap-2 bg-slate-900/90">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-xs font-bold text-slate-100 font-mono">{code}</p>
                <p className="text-[10px] text-slate-400">{projEvents.length} Active Events</p>
              </div>
            </div>
          </div>

          <div className="relative flex items-center min-h-[56px] bg-slate-950/20">
            <div className="absolute inset-0 grid grid-cols-[repeat(21,1fr)] pointer-events-none divide-x divide-slate-800/30" />
            {projEvents.map((evt) => {
              const style = getEventStyle(evt);
              if (!style) return null;
              const badge = getEventTypeBadge(evt.event_type);

              return (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent(evt)}
                  style={style}
                  className={`absolute h-7 rounded-lg border text-xs font-medium cursor-pointer shadow-md flex items-center justify-between px-2 gap-1.5 transition-all hover:brightness-110 z-10 ${badge.bg} ${badge.border} ${badge.text}`}
                >
                  <span className="truncate text-[11px] font-bold">{evt.title}</span>
                  <span className="text-[9px] font-semibold px-1 rounded bg-black/40">{evt.priority}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Controls Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Group Timeline:
          </span>
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
            {(['resource', 'project', 'equipment'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGroupBy(mode)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  groupBy === mode
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Window: {timelineDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
            {timelineDays[timelineDays.length - 1].toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Timeline Days Header */}
      <div className="grid grid-cols-[220px_1fr] border-b border-slate-800 bg-slate-950/70">
        <div className="p-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-r border-slate-800">
          Track / Entity
        </div>
        <div className="grid grid-cols-[repeat(21,1fr)] divide-x divide-slate-800/60 text-center">
          {timelineDays.map((d, idx) => {
            const isToday = d.toISOString().split('T')[0] === '2026-08-26';
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            return (
              <div
                key={idx}
                className={`py-2 px-1 flex flex-col items-center justify-center ${
                  isToday ? 'bg-indigo-950/40 text-indigo-300' : isWeekend ? 'bg-slate-950/60 text-slate-500' : 'text-slate-400'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold">
                  {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
                <span
                  className={`text-[11px] font-mono font-bold mt-0.5 ${
                    isToday ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center' : ''
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline Body Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/40">
        {renderRows()}
      </div>
    </div>
  );
};
