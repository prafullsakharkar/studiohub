import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Task } from '@/types/tasks';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Film,
  Box,
  User,
  Plus,
} from 'lucide-react';

interface TaskCalendarViewProps {
  tasks: Task[];
  onOpenCreate?: (dateStr?: string) => void;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({ tasks, onOpenCreate }) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 20)); // August 2026

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date(2026, 7, 20));

  const days: { dayNumber: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({ dayNumber: i, dateStr, isCurrentMonth: true });
  }

  // Next month padding
  const totalCells = Math.ceil(days.length / 7) * 7;
  const remaining = totalCells - days.length;
  for (let i = 1; i <= remaining; i++) {
    const m = month + 2 > 12 ? 1 : month + 2;
    const y = month + 2 > 12 ? year + 1 : year;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({ dayNumber: i, dateStr, isCurrentMonth: false });
  }

  const getDepartmentColor = (dept: string) => {
    switch (dept) {
      case 'FX & Simulation':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case '3D Modeling & Assets':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'Character & Creature Rigging':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Character & Creature Animation':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Lighting & LookDev':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
      case 'Compositing (Nuke)':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'Pipeline & Core Infrastructure':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
      {/* Calendar Header Controls */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-100">
            {monthNames[month]} {year}
          </h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            {tasks.length} tasks scheduled
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={today}>
            Today (Aug 2026)
          </Button>
          <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={prevMonth}
              className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-l border-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Names */}
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60 text-center py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 grid-flow-row auto-rows-fr divide-x divide-y divide-slate-800 bg-slate-950/20">
        {days.map((d, index) => {
          const dayTasks = tasks.filter((t) => {
            const dueDate = t.schedule?.due_date || t.due_date;
            return dueDate === d.dateStr;
          });

          const isCurrentDay = d.dateStr === '2026-08-20';

          return (
            <div
              key={index}
              className={`min-h-[120px] p-2 flex flex-col justify-between transition-colors group relative ${
                !d.isCurrentMonth
                  ? 'bg-slate-950/40 text-slate-600'
                  : isCurrentDay
                  ? 'bg-indigo-950/20 text-slate-100'
                  : 'bg-slate-900/30 hover:bg-slate-800/30 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    isCurrentDay
                      ? 'bg-indigo-600 text-white'
                      : d.isCurrentMonth
                      ? 'text-slate-300'
                      : 'text-slate-600'
                  }`}
                >
                  {d.dayNumber}
                </span>

                {onOpenCreate && d.isCurrentMonth && (
                  <button
                    onClick={() => onOpenCreate(d.dateStr)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-all"
                    title={`Create task for ${d.dateStr}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Tasks List in Cell */}
              <div className="space-y-1 my-1 overflow-y-auto max-h-[85px] custom-scrollbar">
                {dayTasks.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tasks/${t.id}`}
                    className={`block px-1.5 py-1 rounded text-[11px] font-medium border truncate transition-all hover:scale-[1.02] shadow-sm ${getDepartmentColor(
                      t.department
                    )}`}
                    title={`${t.code}: ${t.title} (${t.status})`}
                  >
                    <span className="font-bold mr-1 font-mono">{t.code}</span>
                    <span>{t.title}</span>
                  </Link>
                ))}
              </div>

              {/* Footer Indicator if tasks */}
              {dayTasks.length > 0 && (
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end">
                  <span>{dayTasks.length} {dayTasks.length === 1 ? 'deadline' : 'deadlines'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
