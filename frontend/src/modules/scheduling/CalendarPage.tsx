import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, eventsApi, holidaysApi, leavesApi, milestonesApi, resourcesApi } from '@/api/scheduling/scheduling';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { fetchAllRows } from '@/shared/data/listing';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';
import { useStudioLocale } from '@/core/locale/studioLocale';
import { addDays, dayKey, fromKey, itemsByDay, monthGrid, weekOf, windowOf } from './calendarModel';
import type { WeekStart } from './calendarModel';
import type { DayItem } from './calendarModel';
import { formatDay } from './format';
import { KIND_LABEL, KIND_STYLE, weekdayNames } from './kinds';
import { TimeGrid } from './TimeGrid';
import { TimelineView } from './TimelineView';

export type CalendarView = 'month' | 'week' | 'day' | 'timeline';
const VIEWS: Array<{ id: CalendarView; label: string }> = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
  { id: 'timeline', label: 'Timeline' },
];
/** The timeline draws this many days, starting on the Monday of the week that holds the chosen day. */
export const TIMELINE_DAYS = 14;

const parseView = (raw: string | null, allowed: CalendarView[]): CalendarView => (allowed.includes(raw as CalendarView) ? (raw as CalendarView) : 'month');
const parseDay = (raw: string | null): string | null => {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return dayKey(fromKey(raw)) === raw ? raw : null; // 2026-02-31 is not a day
};

/**
 * Which view and which day: in the address (`?view=week&date=2026-11-04`) when the calendar is a page, so a view can be
 * linked and survives a reload; in the component when it is embedded in a project tab, whose address carries other state.
 */
function useCalendarState(embedded: boolean, allowed: CalendarView[], today: string) {
  const [params, setParams] = useSearchParams();
  const [local, setLocal] = useState<{ view: CalendarView; date: string }>({ view: 'month', date: today });
  if (embedded) return { view: local.view, date: local.date, set: (next: Partial<typeof local>) => setLocal((c) => ({ ...c, ...next })) };
  return {
    view: parseView(params.get('view'), allowed),
    date: parseDay(params.get('date')) ?? today,
    set: (next: Partial<{ view: CalendarView; date: string }>) =>
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          if (next.view) out.set('view', next.view);
          if (next.date) out.set('date', next.date);
          return out;
        },
        { replace: true }
      ),
  };
}

const monthLabel = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const short = (key: string) => fromKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const rangeLabel = (days: string[]) => `${short(days[0])} – ${short(days[days.length - 1])}, ${fromKey(days[days.length - 1]).getFullYear()}`;

/**
 * The studio calendar in four views: the month (events, project milestones, holidays and leave that is approved or pending,
 * with the chosen day's agenda), a week and a day on a time grid, and a timeline of resources and their bookings over two
 * weeks. Each view asks the server for exactly the window it shows (events, bookings and, for the month, the grid); milestones
 * by project; holidays and leave are the full (small) lists. A project's own calendar has no timeline: resources are the studio's.
 */
export const CalendarPage: React.FC<{ embedded?: boolean; projectId?: string }> = ({ projectId, embedded }) => {
  const canCreateEvent = useCan('schedule.create');
  const canManage = useCan('schedule.manage');
  const today = dayKey(new Date());
  const allowed = VIEWS.filter((v) => !(projectId && v.id === 'timeline')).map((v) => v.id);
  const { view, date, set } = useCalendarState(Boolean(embedded), allowed, today);
  const selected = date;
  const chosenMonth = fromKey(date);
  const cursor = { year: chosenMonth.getFullYear(), month: chosenMonth.getMonth() };

  // The days each view shows, and the window the server is asked for.
  const weekStart: WeekStart = useStudioLocale()?.week_start === 0 ? 0 : 1;
  const weeks = monthGrid(cursor.year, cursor.month, weekStart);
  const days = useMemo(() => {
    if (view === 'day') return [date];
    if (view === 'week') return weekOf(date, weekStart);
    if (view === 'timeline') return Array.from({ length: TIMELINE_DAYS }, (_, i) => addDays(weekOf(date, weekStart)[0], i));
    return weeks.flat();
  }, [view, date, weeks, weekStart]);
  const span = windowOf(days[0], days[days.length - 1]);
  const calendarView = view !== 'timeline';

  const events = useQuery({
    queryKey: [...eventsApi.keys.lists(), 'calendar', projectId ?? '', span.start, span.end],
    queryFn: () => eventsApi.list({ start: span.start, end: span.end, ...(projectId ? { project_id: projectId } : {}) }).then((p) => p.results),
    enabled: calendarView,
  });
  const milestones = useQuery({ queryKey: [...milestonesApi.keys.lists(), 'calendar', projectId ?? ''], queryFn: () => milestonesApi.list(projectId ? { project_id: projectId } : {}).then((p) => p.results), enabled: calendarView });
  const holidays = useQuery({ queryKey: [...holidaysApi.keys.lists(), 'calendar'], queryFn: () => holidaysApi.list({}).then((p) => p.results) });
  const leaves = useQuery({ queryKey: [...leavesApi.keys.lists(), 'calendar'], queryFn: () => leavesApi.list({}).then((p) => p.results) });
  const resources = useQuery({ queryKey: [...resourcesApi.keys.lists(), 'timeline'], queryFn: ({ signal }) => fetchAllRows(resourcesApi.list, {}, { signal }), enabled: view === 'timeline' });
  const bookings = useQuery({ queryKey: [...bookingsApi.keys.lists(), 'timeline', span.start, span.end], queryFn: () => bookingsApi.list({ start: span.start, end: span.end }).then((p) => p.results), enabled: view === 'timeline' });

  const data = useMemo(
    () => ({ events: events.data ?? [], milestones: milestones.data ?? [], holidays: holidays.data ?? [], leaves: projectId ? [] : (leaves.data ?? []) }),
    [events.data, milestones.data, holidays.data, leaves.data, projectId]
  );
  const itemsOfDay = useMemo(() => itemsByDay(data), [data]);

  const label = view === 'month' ? monthLabel(cursor.year, cursor.month) : view === 'day' ? formatDay(date) : rangeLabel(days);
  const step = (direction: 1 | -1) => {
    if (view === 'month') set({ date: dayKey(new Date(cursor.year, cursor.month + direction, 1, 12)) });
    else set({ date: addDays(date, direction * (view === 'day' ? 1 : 7)) });
  };
  const unit = view === 'month' ? 'month' : view === 'day' ? 'day' : 'week';

  const queries = calendarView ? [events, milestones, holidays, leaves] : [resources, bookings, holidays, leaves];
  const loading = queries.some((q) => q.isLoading);
  const error = queries.map((q) => q.error).find(Boolean) ?? null;
  const chosen: DayItem[] = itemsOfDay.get(selected) ?? [];

  return (
    <div className={cn('space-y-4', !embedded && 'p-4 sm:p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!embedded && <h1 className="text-xl font-bold text-white tracking-tight">Calendar</h1>}
          <p className="text-xs text-slate-400">
            {view === 'timeline' ? 'Who is booked when: resources down, two weeks across. Times are shown in your time zone.' : projectId ? 'This project’s events and milestones.' : 'Events, milestones, holidays and leave. Times are shown in your time zone.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <fieldset className="m-0 flex rounded-md border border-slate-700 p-0 overflow-hidden">
            <legend className="sr-only">View</legend>
            {VIEWS.filter((v) => allowed.includes(v.id)).map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => set({ view: v.id })} className={cn('px-2.5 py-1 text-xs', view === v.id ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:bg-slate-800')}>
                {v.label}
              </button>
            ))}
          </fieldset>
          <Button size="sm" variant="outline" aria-label={`Previous ${unit}`} onClick={() => step(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold text-white min-w-36 text-center" aria-live="polite">
            {label}
          </span>
          <Button size="sm" variant="outline" aria-label={`Next ${unit}`} onClick={() => step(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => set({ date: today })}>
            Today
          </Button>
          {canCreateEvent && view !== 'timeline' && (
            <Link to={`/scheduling/events/new?start_time=${encodeURIComponent(`${selected}T09:00`)}&end_time=${encodeURIComponent(`${selected}T10:00`)}`}>
              <Button size="sm" variant="primary">
                New event
              </Button>
            </Link>
          )}
        </div>
      </div>

      <QueryBoundary isLoading={loading} error={error} onRetry={() => void Promise.all(queries.map((q) => q.refetch()))} entityName="calendar">
        {view === 'timeline' ? (
          <TimelineView days={days} resources={resources.data ?? []} bookings={bookings.data ?? []} leaves={leaves.data ?? []} holidays={holidays.data ?? []} selected={selected} today={today} onSelect={(day) => set({ date: day })} canBook={canManage} />
        ) : view === 'week' || view === 'day' ? (
          <TimeGrid days={days} data={data} selected={selected} today={today} onSelect={(day) => set({ date: day })} />
        ) : (
          <>
        <table aria-label={label} className="w-full table-fixed border-collapse rounded-lg border border-slate-800 overflow-hidden">
          <thead className="bg-slate-900 text-[11px] font-semibold text-slate-400">
            <tr>
              {weekdayNames(weekStart).map((d) => (
                <th key={d} scope="col" className="px-2 py-1.5 text-left font-semibold">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((key) => {
                  const inMonth = fromKey(key).getMonth() === cursor.month;
                  const items = itemsOfDay.get(key) ?? [];
                  return (
                    <td key={key} className={cn('border-t border-l border-slate-800 p-0 align-top', !inMonth && 'opacity-40', key === selected && 'bg-slate-800/60 ring-1 ring-inset ring-cyan-500/50')}>
                      <button type="button" aria-label={`${formatDay(key)}, ${items.length} item${items.length === 1 ? '' : 's'}`} aria-pressed={key === selected} onClick={() => set({ date: key })} className="block min-h-20 w-full p-1 text-left align-top">
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
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

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
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
