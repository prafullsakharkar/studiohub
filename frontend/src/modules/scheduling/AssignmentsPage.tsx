import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { tasksApi } from '@/api/production/work';
import type { Task } from '@/api/production/work';
import { bookingsApi, eventsApi, resourcesApi } from '@/api/scheduling/scheduling';
import type { Booking, CalendarEventRow, ResourceRow } from '@/api/scheduling/scheduling';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useStudioLocale } from '@/core/locale/studioLocale';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { fetchAllRows } from '@/shared/data/listing';
import { addDays, dayKey, weekOf, windowOf } from './calendarModel';
import type { WeekStart } from './calendarModel';
import { formatDay, formatHours, formatRange } from './format';
import { ALLOCATING, hoursInWindow } from './planningModel';

interface Line {
  booking: Booking;
  task?: Task;
  event?: CalendarEventRow;
  hours: number;
}

/** What a booking is for: its task, its event, or what its note says. */
const Target: React.FC<{ line: Line }> = ({ line }) => {
  const { booking, task, event } = line;
  if (booking.task)
    return (
      <Link to={`/tasks/${booking.task}`} className="text-cyan-300 hover:underline">
        {task ? `${task.code} · ${task.title}` : 'A task'}
      </Link>
    );
  if (booking.event)
    return (
      <Link to={`/scheduling/events/${booking.event}`} className="text-cyan-300 hover:underline">
        {event?.title ?? 'An event'}
      </Link>
    );
  return <span className="text-slate-400">{booking.notes || (booking.status === 'Blocked' ? 'Blocked' : 'Not linked to a task or event')}</span>;
};

/**
 * Who is booked on what in a week: each resource with its bookings, and what each booking is for (a task, an event, or
 * nothing in particular). Resources with nothing booked are listed apart, so a free person is easy to find.
 */
export const AssignmentsPage: React.FC = () => {
  const weekStart: WeekStart = useStudioLocale()?.week_start === 0 ? 0 : 1;
  const [day, setDay] = useState(() => dayKey(new Date()));
  const days = weekOf(day, weekStart);
  const span = windowOf(days[0], days[6]);
  const resources = useQuery({ queryKey: [...resourcesApi.keys.lists(), 'assignments'], queryFn: ({ signal }) => fetchAllRows(resourcesApi.list, {}, { signal }) });
  const bookings = useQuery({ queryKey: [...bookingsApi.keys.lists(), 'assignments', span.start, span.end], queryFn: ({ signal }) => fetchAllRows(bookingsApi.list, { start: span.start, end: span.end }, { signal }) });
  const wantsTasks = (bookings.data ?? []).some((b) => b.task);
  const wantsEvents = (bookings.data ?? []).some((b) => b.event);
  const tasks = useQuery({ queryKey: [...tasksApi.keys.lists(), 'assignments'], queryFn: ({ signal }) => fetchAllRows(tasksApi.list, {}, { signal }), enabled: wantsTasks });
  const events = useQuery({ queryKey: [...eventsApi.keys.lists(), 'assignments', span.start, span.end], queryFn: ({ signal }) => fetchAllRows(eventsApi.list, { start: span.start, end: span.end }, { signal }), enabled: wantsEvents });

  const taskById = new Map((tasks.data ?? []).map((t) => [t.id, t]));
  const eventById = new Map<string, CalendarEventRow>((events.data ?? []).map((e) => [e.id, e]));
  const windowStart = new Date(span.start);
  const windowEnd = new Date(span.end);
  const lines = (resource: ResourceRow): Line[] =>
    (bookings.data ?? [])
      .filter((b) => b.resource === resource.id)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((booking) => ({ booking, task: booking.task ? taskById.get(booking.task) : undefined, event: booking.event ? eventById.get(booking.event) : undefined, hours: hoursInWindow(booking, windowStart, windowEnd) }));

  const all = resources.data ?? [];
  const busy = all.filter((r) => lines(r).length > 0);
  const free = all.filter((r) => lines(r).length === 0);
  const loading = resources.isLoading || bookings.isLoading;

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Assignments</h1>
          <p className="text-xs text-slate-400 mt-1">{`Who is booked on what, ${formatDay(days[0])} to ${formatDay(days[6])}.`}</p>
        </div>
        <div className="flex items-center gap-2" role="toolbar" aria-label="Week">
          <Button size="sm" variant="outline" aria-label="Previous week" onClick={() => setDay(addDays(days[0], -7))}>
            ←
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDay(dayKey(new Date()))}>
            This week
          </Button>
          <Button size="sm" variant="outline" aria-label="Next week" onClick={() => setDay(addDays(days[0], 7))}>
            →
          </Button>
        </div>
      </div>

      <QueryBoundary isLoading={loading} error={resources.error ?? bookings.error} onRetry={() => { void resources.refetch(); void bookings.refetch(); }} entityName="assignments" isEmpty={all.length === 0} empty={{ title: 'No resources', description: 'Add resources to see who is booked on what.' }}>
        {busy.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">Nothing is booked this week.</p>
        ) : (
          <ul aria-label="Booked resources" className="space-y-3">
            {busy.map((resource) => {
              const own = lines(resource);
              // Blocked time is off the table, not work: only Booked and Overbooked hours count against the capacity, as on the Utilization page.
              const total = own.filter((l) => ALLOCATING.has(l.booking.status)).reduce((sum, l) => sum + l.hours, 0);
              return (
                <li key={resource.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/scheduling/resources/${resource.id}`} className="text-sm font-semibold text-cyan-300 hover:underline">
                      {resource.name}
                    </Link>
                    <span className="font-mono text-xs text-slate-400">{`${formatHours(Math.round(total * 10) / 10)} of ${formatHours(resource.capacity_hours_per_week)}`}</span>
                  </div>
                  <ul aria-label={`Bookings of ${resource.name}`} className="mt-2 divide-y divide-slate-800/70">
                    {own.map((line) => {
                      const { booking, hours } = line;
                      return (
                      <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
                        <span className="min-w-0 flex-1">
                          <Target line={line} />
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">{formatRange(booking.start_time, booking.end_time)}</span>
                        <span className="font-mono text-[11px] text-slate-500">{formatHours(Math.round(hours * 10) / 10)}</span>
                        <StatusBadge status={booking.status} size="xs" />
                      </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
        {free.length > 0 && (
          <section aria-label="Nothing booked" className="space-y-1.5">
            <h2 className="text-sm font-semibold text-slate-300">
              Nothing booked <span className="font-mono text-xs text-slate-500">({free.length})</span>
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {free.map((r) => (
                <li key={r.id}>
                  <Link to={`/scheduling/resources/${r.id}`} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-700">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </QueryBoundary>
    </div>
  );
};
