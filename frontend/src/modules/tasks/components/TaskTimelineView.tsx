import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Task } from '@/types/tasks';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import {
  Calendar,
  Layers,
  ChevronRight,
  User,
  Film,
  Box,
  GitCommit,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';

interface TaskTimelineViewProps {
  tasks: Task[];
}

export const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({ tasks }) => {
  const [zoomLevel, setZoomLevel] = useState<'days' | 'weeks'>('days');

  // Timeline spans from Aug 1, 2026 to Sep 15, 2026
  const timelineStart = new Date(2026, 7, 1);
  const timelineEnd = new Date(2026, 8, 15);
  const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));

  const daysArray = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + i);
    return {
      date: d,
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
    };
  });

  const getPositionStyles = (startDateStr?: string, dueDateStr?: string) => {
    const start = startDateStr ? new Date(startDateStr) : new Date(2026, 7, 10);
    const end = dueDateStr ? new Date(dueDateStr) : new Date(2026, 7, 25);

    const leftDays = Math.max(0, Math.ceil((start.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
    const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    const leftPercent = (leftDays / totalDays) * 100;
    const widthPercent = Math.min(100 - leftPercent, (durationDays / totalDays) * 100);

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(3, widthPercent)}%`,
    };
  };

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case 'FX & Simulation':
        return 'from-red-500/80 to-red-600/80 border-red-400 text-white';
      case '3D Modeling & Assets':
        return 'from-cyan-500/80 to-cyan-600/80 border-cyan-400 text-white';
      case 'Character & Creature Rigging':
        return 'from-emerald-500/80 to-emerald-600/80 border-emerald-400 text-white';
      case 'Character & Creature Animation':
        return 'from-amber-500/80 to-amber-600/80 border-amber-400 text-white';
      case 'Lighting & LookDev':
        return 'from-pink-500/80 to-pink-600/80 border-pink-400 text-white';
      case 'Compositing (Nuke)':
        return 'from-indigo-500/80 to-indigo-600/80 border-indigo-400 text-white';
      case 'Pipeline & Core Infrastructure':
        return 'from-blue-500/80 to-blue-600/80 border-blue-400 text-white';
      default:
        return 'from-slate-600 to-slate-700 border-slate-500 text-white';
    }
  };

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
      {/* Header Controls */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-100">Production Gantt & Schedule Timeline</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            Aug 1 – Sep 15, 2026
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden bg-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setZoomLevel('days')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                zoomLevel === 'days' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Days
            </button>
            <button
              onClick={() => setZoomLevel('weeks')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                zoomLevel === 'weeks' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Weeks
            </button>
          </div>
        </div>
      </div>

      {/* Gantt Container */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <div className="min-w-[1200px]">
          {/* Timeline Dates Header */}
          <div className="grid grid-cols-[280px_1fr] border-b border-slate-800 bg-slate-950/80 sticky top-0 z-20">
            <div className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-r border-slate-800 flex items-center">
              Task & Target Entity
            </div>
            <div className="relative h-12 flex items-center">
              {daysArray.map((day, idx) => {
                const isToday = day.dateStr === '2026-08-20';
                const isWeekend = day.dayName === 'Sat' || day.dayName === 'Sun';

                return (
                  <div
                    key={idx}
                    className={`flex-1 flex flex-col items-center justify-center border-r border-slate-800/60 text-[10px] h-full ${
                      isToday ? 'bg-indigo-950/40 text-indigo-300 font-bold' : isWeekend ? 'bg-slate-950/40 text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    <span className="text-[9px] uppercase">{day.dayName}</span>
                    <span className="font-mono text-xs">{day.dayNumber}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Task Rows */}
          <div className="divide-y divide-slate-800/60">
            {tasks.map((task) => {
              const startDate = task.schedule?.start_date || '2026-08-10';
              const dueDate = task.schedule?.due_date || task.due_date || '2026-08-28';
              const style = getPositionStyles(startDate, dueDate);
              const progress = task.schedule?.progress_percent || 50;

              return (
                <div
                  key={task.id}
                  className="grid grid-cols-[280px_1fr] hover:bg-slate-800/30 transition-colors group relative"
                >
                  {/* Left Task Info */}
                  <div className="p-3 border-r border-slate-800 flex flex-col justify-center gap-1 bg-slate-900/40">
                    <div className="flex items-center justify-between gap-1">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="font-mono text-xs font-bold text-indigo-400 hover:underline truncate"
                      >
                        {task.code}
                      </Link>
                      <StatusBadge status={task.status} />
                    </div>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="text-xs font-medium text-slate-200 hover:text-indigo-300 truncate"
                      title={task.title}
                    >
                      {task.title}
                    </Link>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate">{task.department}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {task.schedule?.logged_hours || 0}h / {task.schedule?.estimated_hours || 24}h
                      </span>
                    </div>
                  </div>

                  {/* Right Timeline Bar Track */}
                  <div className="relative h-16 flex items-center px-1">
                    {/* Background Grid Lines */}
                    <div className="absolute inset-0 grid grid-cols-46 pointer-events-none flex">
                      {daysArray.map((d, i) => (
                        <div
                          key={i}
                          className={`flex-1 border-r border-slate-800/30 ${
                            d.dateStr === '2026-08-20' ? 'bg-indigo-500/10' : ''
                          }`}
                        />
                      ))}
                    </div>

                    {/* Today Line Indicator */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-indigo-500 z-10 pointer-events-none"
                      style={{
                        left: `${((19 / totalDays) * 100).toFixed(2)}%`,
                      }}
                    />

                    {/* Task Bar Span */}
                    <div
                      className={`absolute top-3 bottom-3 rounded-lg shadow-md bg-gradient-to-r ${getDeptColor(
                        task.department
                      )} border p-2 flex items-center justify-between overflow-hidden cursor-pointer hover:brightness-110 transition-all z-10`}
                      style={style}
                      title={`${task.code}: ${startDate} to ${dueDate} (${progress}% done)`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {task.assignee_avatar && (
                          <img
                            src={task.assignee_avatar}
                            alt={task.assignee_name}
                            className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/40"
                          />
                        )}
                        <span className="text-xs font-semibold text-white drop-shadow truncate">
                          {task.title}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-white/90 bg-black/30 px-1.5 py-0.5 rounded ml-2 shrink-0">
                        {task.schedule?.progress_percent ?? 50}%
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
};
