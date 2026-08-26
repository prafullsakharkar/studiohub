import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';

interface CalendarViewProps<T = any> {
  data: T[];
  onItemClick?: (item: T) => void;
  emptyMessage?: string;
}

export function CalendarView<T extends { id: string }>({
  data,
  onItemClick,
  emptyMessage = 'No scheduled items.',
}: CalendarViewProps<T>) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 20)); // August 2026

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const setToday = () => setCurrentDate(new Date(2026, 7, 20));

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map items to date keys (YYYY-MM-DD)
  const itemsByDate = React.useMemo(() => {
    const map: Record<string, T[]> = {};
    data.forEach((item: any) => {
      const dateStr = item.due_date || item.delivery_date || item.created_at;
      if (!dateStr) return;
      const key = dateStr.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [data]);

  const daysGrid: { dayNumber: number | null; dateKey: string | null }[] = [];

  // Pad beginning of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysGrid.push({ dayNumber: null, dateKey: null });
  }

  // Populate days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    daysGrid.push({
      dayNumber: d,
      dateKey: `${year}-${mStr}-${dStr}`,
    });
  }

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
      {/* Calendar Header */}
      <div className="p-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-semibold text-slate-200">{monthName}</h4>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={setToday}
            className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 font-mono transition-colors"
          >
            Current Month
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 bg-slate-950/90 border-b border-slate-800 text-center font-mono text-[11px] text-slate-400 py-2">
        <span>SUN</span>
        <span>MON</span>
        <span>TUE</span>
        <span>WED</span>
        <span>THU</span>
        <span>FRI</span>
        <span>SAT</span>
      </div>

      {/* Calendar Cells Grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/60 bg-slate-950/20">
        {daysGrid.map((cell, idx) => {
          if (!cell.dayNumber || !cell.dateKey) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[100px] p-2 bg-slate-950/40 text-slate-700"
              />
            );
          }

          const items = itemsByDate[cell.dateKey] || [];
          const isToday = cell.dateKey === '2026-08-20';

          return (
            <div
              key={cell.dateKey}
              className={`min-h-[110px] p-2 transition-colors flex flex-col justify-between ${
                isToday ? 'bg-indigo-950/20 ring-1 ring-inset ring-indigo-500/30' : 'hover:bg-slate-850/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-mono font-semibold ${
                    isToday
                      ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {items.length > 0 && (
                  <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                    {items.length}
                  </span>
                )}
              </div>

              {/* Items for this day */}
              <div className="space-y-1 mt-1 overflow-y-auto max-h-[80px]">
                {items.map((item: any) => {
                  const title = item.name || item.title || item.code;
                  const code = item.code || item.slug || item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onItemClick && onItemClick(item)}
                      className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-[10px] text-slate-200 truncate transition-colors"
                      title={`${code}: ${title}`}
                    >
                      <span className="font-mono text-indigo-400 mr-1 font-semibold">{code}</span>
                      <span>{title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
