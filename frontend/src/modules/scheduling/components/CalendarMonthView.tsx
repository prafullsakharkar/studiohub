import React, { useState } from 'react';
import { CalendarEvent, StudioHoliday, ResourceLeave } from '@/types/scheduling';
import {
  getMonthDays,
  isEventOnDate,
  getEventTypeBadge,
  isSameDay,
} from '../utils/calendarHelpers';
import {
  Calendar,
  AlertTriangle,
  Flag,
  PlayCircle,
  Send,
  CheckCircle2,
  Users,
  ShieldAlert,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  holidays: StudioHoliday[];
  leaves: ResourceLeave[];
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEventOnDate: (date: Date) => void;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentDate,
  events,
  holidays,
  leaves,
  onSelectEvent,
  onAddEventOnDate,
}) => {
  const days = getMonthDays(currentDate);
  const [selectedDayPopover, setSelectedDayPopover] = useState<{ date: Date; events: CalendarEvent[] } | null>(null);

  const weekDayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/70 text-center py-2.5">
        {weekDayHeaders.map((day, idx) => (
          <div
            key={day}
            className={`text-xs font-bold uppercase tracking-wider ${
              idx >= 5 ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-800/80 bg-slate-950/20 overflow-y-auto custom-scrollbar">
        {days.map((item, idx) => {
          const dateStr = item.date.toISOString().split('T')[0];
          const dayEvents = events.filter((e) => isEventOnDate(e, item.date));
          const dayHolidays = holidays.filter((h) => h.date === dateStr);
          const dayLeaves = leaves.filter((l) => {
            const start = l.start_date;
            const end = l.end_date;
            return dateStr >= start && dateStr <= end;
          });

          // Calculate daily work pressure
          const hasCritical = dayEvents.some((e) => e.priority === 'Critical');
          const hasOverbooked = dayEvents.some((e) => e.is_overbooked);
          const maxVisible = 3;
          const overflowCount = dayEvents.length - maxVisible;

          return (
            <div
              key={idx}
              onClick={() => {
                if (dayEvents.length > maxVisible) {
                  setSelectedDayPopover({ date: item.date, events: dayEvents });
                }
              }}
              className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors group relative ${
                item.isCurrentMonth ? 'bg-slate-900/40' : 'bg-slate-950/60 opacity-40'
              } ${item.isToday ? 'ring-1 ring-inset ring-indigo-500/80 bg-indigo-950/10' : ''} hover:bg-slate-800/30`}
            >
              {/* Day Cell Header */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-mono font-bold ${
                      item.isToday
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/50'
                        : item.isCurrentMonth
                        ? 'text-slate-200 group-hover:text-indigo-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {item.date.getDate()}
                  </span>

                  {/* Holiday / Maintenance Indicator */}
                  {dayHolidays.length > 0 && (
                    <span
                      title={dayHolidays[0].name}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 truncate max-w-[80px]"
                    >
                      {dayHolidays[0].name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {hasOverbooked && (
                    <span title="Overbooking Detected">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    </span>
                  )}
                  {hasCritical && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0 animate-pulse" title="Critical Milestone" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddEventOnDate(item.date);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all"
                    title="Add Event on this date"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Event Chips */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {/* Leaves Banner */}
                {dayLeaves.map((l) => (
                  <div
                    key={l.id}
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60 truncate flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span className="truncate">{l.resource_name} ({l.leave_type})</span>
                  </div>
                ))}

                {/* Main Events */}
                {dayEvents.slice(0, maxVisible).map((evt) => {
                  const badge = getEventTypeBadge(evt.event_type);

                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={`px-1.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-all hover:scale-[1.01] hover:brightness-110 flex items-center justify-between gap-1 shadow-sm ${
                        badge.bg
                      } ${badge.border} ${badge.text}`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`} />
                        <span className="truncate font-semibold">{evt.title}</span>
                      </div>
                      {evt.project_code && (
                        <span className="text-[9px] font-mono opacity-80 shrink-0 font-bold">
                          {evt.project_code}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Overflow count button */}
                {overflowCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayPopover({ date: item.date, events: dayEvents });
                    }}
                    className="w-full py-0.5 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/30 rounded border border-indigo-800/40 text-center"
                  >
                    +{overflowCount} more events
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Overflow Popover / Modal */}
      {selectedDayPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {selectedDayPopover.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayPopover(null)}
                className="text-slate-400 hover:text-slate-100 text-xs px-2 py-1 bg-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {selectedDayPopover.events.map((evt) => {
                const badge = getEventTypeBadge(evt.event_type);
                return (
                  <div
                    key={evt.id}
                    onClick={() => {
                      setSelectedDayPopover(null);
                      onSelectEvent(evt);
                    }}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer hover:brightness-110 flex items-center justify-between gap-2 ${badge.bg} ${badge.border} ${badge.text}`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span className="font-bold text-slate-100 truncate">{evt.title}</span>
                      </div>
                      <p className="text-[11px] opacity-80">{evt.department || evt.office_name}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/60 font-bold">
                      {evt.project_code || 'ALL'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
