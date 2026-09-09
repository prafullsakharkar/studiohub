import React, { useState } from 'react';
import { FieldDefinition } from '@/types/crud';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';

interface TimelineViewProps<T = any> {
  data: T[];
  onItemClick?: (item: T) => void;
  emptyMessage?: string;
}

export function TimelineView<T extends { id: string }>({
  data,
  onItemClick,
  emptyMessage = 'No timeline items available.',
}: TimelineViewProps<T>) {
  // Compute timeline date range (e.g. 14 days around current date or items' due dates)
  const [currentOffsetDays, setCurrentOffsetDays] = useState(0);

  const days = React.useMemo(() => {
    const list: Date[] = [];
    const base = new Date();
    base.setDate(base.getDate() + currentOffsetDays);

    for (let i = -3; i <= 10; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(d);
    }
    return list;
  }, [currentOffsetDays]);

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg space-y-0">
      {/* Timeline Controls Header */}
      <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">
            Production Timeline & Milestones
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ({days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {days[days.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentOffsetDays((prev) => prev - 7)}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentOffsetDays(0)}
            className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 font-mono transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCurrentOffsetDays((prev) => prev + 7)}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gantt Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          {/* Calendar Header Row */}
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-mono">
              <th className="w-64 px-3 py-2.5 font-semibold text-slate-300 border-r border-slate-800 sticky left-0 bg-slate-950 z-10">
                Item & Assignee
              </th>
              {days.map((day) => {
                const isToday = formatDateKey(day) === formatDateKey(new Date());
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <th
                    key={day.toISOString()}
                    className={`min-w-[60px] px-1 py-2 text-center border-r border-slate-800/60 ${
                      isToday
                        ? 'bg-indigo-950/40 text-indigo-300 font-bold'
                        : isWeekend
                        ? 'bg-slate-950/80 text-slate-600'
                        : 'text-slate-400'
                    }`}
                  >
                    <div className="text-[10px] uppercase">
                      {day.toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </div>
                    <div className="text-xs">{day.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Timeline Item Rows */}
          <tbody className="divide-y divide-slate-800/60">
            {data.length === 0 ? (
              <tr>
                <td colSpan={days.length + 1} className="py-12 text-center text-xs text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item: any) => {
                const title = item.name || item.title || item.code;
                const code = item.code || item.slug || item.id;
                const dueDateStr = item.due_date || item.delivery_date;
                const dueDate = dueDateStr ? new Date(dueDateStr) : null;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onItemClick && onItemClick(item)}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer group"
                  >
                    {/* Item label pinned column */}
                    <td className="px-3 py-2.5 border-r border-slate-800 sticky left-0 bg-slate-900 group-hover:bg-slate-850 z-10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-[11px] text-indigo-400 font-semibold block truncate">
                            {code}
                          </span>
                          <span className="text-xs text-slate-200 font-medium truncate block">
                            {title}
                          </span>
                        </div>
                        {item.status && <StatusBadge status={item.status} size="sm" />}
                      </div>
                    </td>

                    {/* Timeline Day Slots */}
                    {days.map((day) => {
                      const dayKey = formatDateKey(day);
                      const isMatchDue = dueDate && formatDateKey(dueDate) === dayKey;
                      const isToday = dayKey === formatDateKey(new Date());

                      return (
                        <td
                          key={dayKey}
                          className={`p-1 text-center border-r border-slate-800/40 relative ${
                            isToday ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          {isMatchDue && (
                            <div className="mx-auto w-full py-1 px-1.5 rounded bg-indigo-600 text-white font-mono text-[10px] font-bold shadow-md truncate animate-in zoom-in-95">
                              Due: {code}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
