import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi, holidaysApi, leavesApi, milestonesApi } from '@/api/scheduling/scheduling';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';
import { dayKey, fromKey, itemsByDay, monthGrid } from './calendarModel';
import type { DayItem, DayItemKind } from './calendarModel';
import { formatDay } from './format';

const KIND_STYLE: Record<DayItemKind, string> = {
  event: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/30',
  milestone: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
  holiday: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  leave: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
};
const KIND_LABEL: Record<DayItemKind, string> = { event: 'Event', milestone: 'Milestone', holiday: 'Holiday', leave: 'Leave' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The studio calendar for a month: events, project milestones, holidays and leave that is approved or pending.
 * Every list is a bare array, so a month is drawn from the full lists (the server cannot filter them by date, CR-25).
 */
export const CalendarPage: React.FC<{ projectName?: string; embedded?: boolean; projectId?: string }> = ({ projectName, projectId, embedded }) => {
  const canCreateEvent = useCan('schedule.create');
  const today = dayKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  const events = useQuery({ queryKey: [...eventsApi.keys.lists(), 'calendar'], queryFn: () => eventsApi.list({}).then((p) => p.results) });
  const milestones = useQuery({ queryKey: [...milestonesApi.keys.lists(), 'calendar', projectId ?? ''], queryFn: () => milestonesApi.list(projectId ? { project_id: projectId } : {}).then((p) => p.results) });
  const holidays = useQuery({ queryKey: [...holidaysApi.keys.lists(), 'calendar'], queryFn: () => holidaysApi.list({}).then((p) => p.results) });
  const leaves = useQuery({ queryKey: [...leavesApi.keys.lists(), 'calendar'], queryFn: () => leavesApi.list({}).then((p) => p.results) });

  const days = useMemo(
    () =>
      itemsByDay({
        // A project's calendar shows its events only; the row has the name, not the id (CR-25).
        events: (events.data ?? []).filter((e) => !projectName || e.project_name === projectName),
        milestones: milestones.data ?? [],
        holidays: holidays.data ?? [],
        leaves: projectName ? [] : (leaves.data ?? []),
      }),
    [events.data, milestones.data, holidays.data, leaves.data, projectName]
  );
  const weeks = monthGrid(cursor.year, cursor.month);
  const label = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const move = (delta: number) => setCursor((c) => ({ year: new Date(c.year, c.month + delta, 1).getFullYear(), month: new Date(c.year, c.month + delta, 1).getMonth() }));
  const loading = events.isLoading || milestones.isLoading || holidays.isLoading || leaves.isLoading;
  const error = events.error ?? milestones.error ?? holidays.error ?? leaves.error;
  const chosen: DayItem[] = days.get(selected) ?? [];

  return (
    <div className={cn('space-y-4', !embedded && 'p-4 sm:p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!embedded && <h1 className="text-xl font-bold text-white tracking-tight">Calendar</h1>}
          <p className="text-xs text-slate-400">{projectName ? `${projectName}: its events and milestones.` : 'Events, milestones, holidays and leave. Times are shown in your time zone.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" aria-label="Previous month" onClick={() => move(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold text-white min-w-36 text-center" aria-live="polite">
            {label}
          </span>
          <Button size="sm" variant="outline" aria-label="Next month" onClick={() => move(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const now = new Date();
              setCursor({ year: now.getFullYear(), month: now.getMonth() });
              setSelected(today);
            }}
          >
            Today
          </Button>
          {canCreateEvent && (
            <Link to={`/scheduling/events/new?start_time=${encodeURIComponent(`${selected}T09:00`)}&end_time=${encodeURIComponent(`${selected}T10:00`)}`}>
              <Button size="sm" variant="primary">
                New event
              </Button>
            </Link>
          )}
        </div>
      </div>

      <QueryBoundary isLoading={loading} error={error} onRetry={() => void Promise.all([events.refetch(), milestones.refetch(), holidays.refetch(), leaves.refetch()])} entityName="calendar">
        <div role="grid" aria-label={label} className="rounded-lg border border-slate-800 overflow-hidden">
          <div role="row" className="grid grid-cols-7 bg-slate-900 text-[11px] font-semibold text-slate-400">
            {WEEKDAYS.map((d) => (
              <div key={d} role="columnheader" className="px-2 py-1.5">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]} role="row" className="grid grid-cols-7">
              {week.map((key) => {
                const inMonth = fromKey(key).getMonth() === cursor.month;
                const items = days.get(key) ?? [];
                return (
                  <button
                    key={key}
                    role="gridcell"
                    type="button"
                    aria-label={`${formatDay(key)}, ${items.length} item${items.length === 1 ? '' : 's'}`}
                    aria-selected={key === selected}
                    onClick={() => setSelected(key)}
                    className={cn('min-h-20 border-t border-l border-slate-800 p-1 text-left align-top', !inMonth && 'opacity-40', key === selected && 'bg-slate-800/60 ring-1 ring-inset ring-cyan-500/50')}
                  >
                    <span className={cn('text-[11px]', key === today ? 'font-bold text-cyan-300' : 'text-slate-400')}>{fromKey(key).getDate()}</span>
                    <span className="mt-1 flex flex-col gap-0.5">
                      {items.slice(0, 3).map((item) => (
                        <span key={item.key} className={cn('truncate rounded border px-1 text-[10px]', KIND_STYLE[item.kind], item.muted && 'opacity-60')}>
                          {item.title}
                        </span>
                      ))}
                      {items.length > 3 && <span className="text-[10px] text-slate-500">+{items.length - 3} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <section aria-label="Selected day" className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
          <h2 className="text-sm font-semibold text-white">{formatDay(selected)}</h2>
          {chosen.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing is planned for this day.</p>
          ) : (
            <ul className="space-y-1.5">
              {chosen.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-xs">
                  <span className={cn('rounded border px-1.5 py-0.5 text-[10px]', KIND_STYLE[item.kind])}>{KIND_LABEL[item.kind]}</span>
                  <span className="text-slate-200">
                    {item.title}
                    <span className="block text-slate-500">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </QueryBoundary>
    </div>
  );
};
