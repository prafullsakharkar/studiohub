import React from 'react';
import { CalendarEvent, StudioHoliday, ResourceLeave } from '@/types/scheduling';
import {
  getWeekDays,
  isEventOnDate,
  getEventTypeBadge,
  isSameDay,
  formatEventTime,
} from '../utils/calendarHelpers';
import {
  Clock,
  MapPin,
  Users,
  ShieldAlert,
  Plus,
  PlayCircle,
  Flag,
  Send,
  AlertTriangle,
} from 'lucide-react';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  holidays: StudioHoliday[];
  leaves: ResourceLeave[];
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEventOnDate: (date: Date) => void;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  events,
  holidays,
  leaves,
  onSelectEvent,
  onAddEventOnDate,
}) => {
  const weekDays = getWeekDays(currentDate);
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Days Header */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-800 bg-slate-950/70">
        <div className="p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center border-r border-slate-800/80">
          Time / Day
        </div>
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, new Date(2026, 7, 26));
          const dateStr = day.toISOString().split('T')[0];
          const dayHoliday = holidays.find((h) => h.date === dateStr);

          return (
            <div
              key={idx}
              className={`p-2.5 text-center border-r border-slate-800/80 last:border-r-0 ${
                isToday ? 'bg-indigo-950/20' : ''
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <span
                  className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${
                    isToday ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40' : 'text-slate-200'
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayHoliday && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" title={dayHoliday.name} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* All Day Banner Row */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-800 bg-slate-950/40 divide-x divide-slate-800/60 max-h-36 overflow-y-auto custom-scrollbar">
        <div className="p-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center bg-slate-950/80">
          All-Day / Gates
        </div>
        {weekDays.map((day, idx) => {
          const dayAllDayEvents = events.filter((e) => e.all_day && isEventOnDate(e, day));
          const dateStr = day.toISOString().split('T')[0];
          const dayLeaves = leaves.filter((l) => dateStr >= l.start_date && dateStr <= l.end_date);

          return (
            <div key={idx} className="p-1.5 space-y-1 min-h-[50px]">
              {dayLeaves.map((l) => (
                <div
                  key={l.id}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80 truncate"
                >
                  🌴 {l.resource_name} ({l.leave_type})
                </div>
              ))}
              {dayAllDayEvents.map((evt) => {
                const badge = getEventTypeBadge(evt.event_type);
                return (
                  <div
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer hover:brightness-110 flex items-center justify-between gap-1 shadow-sm ${badge.bg} ${badge.border} ${badge.text}`}
                  >
                    <span className="truncate">{evt.title}</span>
                    {evt.project_code && (
                      <span className="font-mono text-[9px] opacity-80 shrink-0">{evt.project_code}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Hourly Timetable Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60 bg-slate-950/20">
        {hours.map((hour) => {
          const hourLabel = `${hour.toString().padStart(2, '0')}:00`;

          return (
            <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[58px] divide-x divide-slate-800/60">
              {/* Hour Label */}
              <div className="p-2 text-xs font-mono font-bold text-slate-500 flex items-start justify-center bg-slate-950/60">
                {hourLabel}
              </div>

              {/* Day Hourly Slots */}
              {weekDays.map((day, dIdx) => {
                const timedEvents = events.filter((e) => {
                  if (e.all_day) return false;
                  if (!isEventOnDate(e, day)) return false;
                  const startH = new Date(e.start_date).getHours();
                  return startH === hour;
                });

                return (
                  <div
                    key={dIdx}
                    onClick={() => onAddEventOnDate(day)}
                    className="p-1.5 space-y-1 relative group hover:bg-slate-800/30 transition-colors"
                  >
                    {timedEvents.map((evt) => {
                      const badge = getEventTypeBadge(evt.event_type);
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(evt);
                          }}
                          className={`p-2 rounded-lg border text-xs cursor-pointer hover:scale-[1.01] transition-all shadow-md flex flex-col gap-1 ${badge.bg} ${badge.border} ${badge.text}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold truncate text-[11px]">{evt.title}</span>
                            {evt.is_overbooked && (
                              <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] opacity-80 font-mono">
                            <span>
                              {formatEventTime(evt.start_date)} - {formatEventTime(evt.end_date)}
                            </span>
                            <span>{evt.project_code || 'STUDIO'}</span>
                          </div>
                          {evt.equipment_names && evt.equipment_names.length > 0 && (
                            <span className="text-[9px] font-medium opacity-90 truncate">
                              📍 {evt.equipment_names[0]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
