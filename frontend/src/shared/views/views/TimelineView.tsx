import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, Layers } from 'lucide-react';
import { StatusBadge } from '@/shared/components/StatusBadge';

export interface TimelineViewProps<T = any> {
  data: T[];
  onItemClick?: (item: T) => void;
  emptyMessage?: string;
}

export function TimelineView<T extends { id: string }>({
  data,
  onItemClick,
  emptyMessage = 'No scheduled items for timeline view.',
}: TimelineViewProps<T>) {
  // Center around August 2026 by default
  const [baseMonth, setBaseMonth] = useState(new Date(2026, 7, 1)); // August 2026

  const prevMonth = () => {
    setBaseMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setBaseMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const setToday = () => {
    setBaseMonth(new Date(2026, 7, 1));
  };

  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = baseMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Compute timeline items with normalized dates
  const timelineItems = useMemo(() => {
    return data.map((item: any) => {
      const rawStart = item.start_date || item.created_at || item.due_date;
      const rawEnd = item.due_date || item.end_date || item.delivery_date || item.created_at;

      let startDate = rawStart ? new Date(rawStart) : null;
      let endDate = rawEnd ? new Date(rawEnd) : null;

      if (startDate && isNaN(startDate.getTime())) startDate = null;
      if (endDate && isNaN(endDate.getTime())) endDate = null;

      // If start exists but not end, span 2 days; if end exists but not start, start 2 days before
      if (startDate && !endDate) {
        endDate = new Date(startDate.getTime() + 86400000 * 2);
      } else if (!startDate && endDate) {
        startDate = new Date(endDate.getTime() - 86400000 * 2);
      } else if (!startDate && !endDate) {
        // synthesize a mid-month anchor for items without explicit dates
        const dayOffset = (Math.abs(item.id.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % 20) + 2;
        startDate = new Date(year, month, dayOffset);
        endDate = new Date(year, month, dayOffset + 3);
      }

      return {
        original: item,
        id: item.id,
        code: item.code || item.slug || item.id,
        title: item.name || item.title || item.code || `Item #${item.id}`,
        status: item.status || 'In Progress',
        department: item.department || item.department_name || 'Production',
        startDate: startDate!,
        endDate: endDate!,
      };
    });
  }, [data, year, month]);

  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500 italic text-xs bg-slate-900/40 rounded-xl border border-slate-800">
        {emptyMessage}
      </div>
    );
  }

  // Days array for the month header
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Status color mapping for timeline bars
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('approv') || s.includes('complete') || s.includes('deliver')) {
      return 'bg-emerald-600/80 border-emerald-500 text-emerald-100';
    }
    if (s.includes('prog') || s.includes('activ')) {
      return 'bg-cyan-600/80 border-cyan-500 text-cyan-100';
    }
    if (s.includes('review') || s.includes('pend')) {
      return 'bg-amber-600/80 border-amber-500 text-amber-100';
    }
    if (s.includes('block') || s.includes('retake')) {
      return 'bg-rose-600/80 border-rose-500 text-rose-100';
    }
    return 'bg-indigo-600/80 border-indigo-500 text-indigo-100';
  };

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
      {/* Header controls */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-slate-200">Gantt & Chronological Timeline</h4>
          <span className="text-[11px] font-mono text-slate-500">({timelineItems.length} entities)</span>
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
            {monthName}
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

      {/* Timeline Gantt Grid Container */}
      <div className="overflow-x-auto custom-scrollbar">
        <div className="min-w-[900px]">
          {/* Days Grid Header */}
          <div className="flex border-b border-slate-800 bg-slate-950/90 sticky top-0 z-10">
            {/* Entity Label Column */}
            <div className="w-64 shrink-0 px-3 py-2 text-[11px] font-mono text-slate-400 border-r border-slate-800 font-semibold">
              ENTITY / CODE
            </div>
            {/* Day columns */}
            <div className="flex-1 flex">
              {days.map((d) => (
                <div
                  key={d}
                  className="flex-1 min-w-[28px] text-center py-1.5 border-r border-slate-800/40 text-[10px] font-mono text-slate-400 select-none"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="divide-y divide-slate-800/40">
            {timelineItems.map((item) => {
              // Calculate left and width percentages within the current month
              const monthStart = new Date(year, month, 1).getTime();
              const monthEnd = new Date(year, month, daysInMonth, 23, 59, 59).getTime();
              const monthDuration = monthEnd - monthStart;

              const itemStart = Math.max(item.startDate.getTime(), monthStart);
              const itemEnd = Math.min(item.endDate.getTime(), monthEnd);

              let leftPct = ((itemStart - monthStart) / monthDuration) * 100;
              let widthPct = ((itemEnd - itemStart) / monthDuration) * 100;

              // Constrain bounds
              leftPct = Math.max(0, Math.min(leftPct, 96));
              widthPct = Math.max(3, Math.min(widthPct, 100 - leftPct));

              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick && onItemClick(item.original)}
                  className={`flex items-center hover:bg-slate-850/50 transition-colors group ${
                    onItemClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Left Metadata Column */}
                  <div className="w-64 shrink-0 px-3 py-2 border-r border-slate-800 flex items-center justify-between gap-2 overflow-hidden">
                    <div className="overflow-hidden">
                      <div className="font-mono text-xs text-indigo-400 font-semibold truncate">
                        {item.code}
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">{item.title}</div>
                    </div>
                    <StatusBadge status={item.status} size="sm" />
                  </div>

                  {/* Gantt Bar Lane */}
                  <div className="flex-1 relative h-10 flex items-center bg-slate-900/40">
                    {/* Background day guide lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {days.map((d) => (
                        <div key={d} className="flex-1 border-r border-slate-800/20" />
                      ))}
                    </div>

                    {/* Chronological bar */}
                    <div
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      className={`absolute h-6 rounded-md border shadow-sm px-2 flex items-center justify-between text-[10px] font-medium truncate transition-all duration-200 group-hover:brightness-110 ${getStatusColor(
                        item.status
                      )}`}
                      title={`${item.code}: ${item.title} (${item.startDate.toLocaleDateString()} – ${item.endDate.toLocaleDateString()})`}
                    >
                      <span className="truncate font-mono">{item.code}</span>
                      <span className="text-[9px] opacity-80 shrink-0 ml-1 hidden sm:inline">
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
