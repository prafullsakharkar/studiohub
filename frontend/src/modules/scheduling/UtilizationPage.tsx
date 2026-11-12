import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi, resourcesApi } from '@/api/scheduling/scheduling';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useStudioLocale } from '@/core/locale/studioLocale';
import { Button } from '@/shared/components/Button';
import { fetchAllRows } from '@/shared/data/listing';
import { cn } from '@/shared/utils/cn';
import { addDays, dayKey, weekOf, windowOf } from './calendarModel';
import type { WeekStart } from './calendarModel';
import { formatDay, formatHours } from './format';
import { BANDS, utilizationOf } from './planningModel';
import type { Band } from './planningModel';

const BAR: Record<Band, string> = { over: 'bg-rose-500', optimal: 'bg-emerald-500', under: 'bg-amber-500' };
const TEXT: Record<Band, string> = { over: 'text-rose-300', optimal: 'text-emerald-300', under: 'text-amber-300' };

/**
 * How much of each resource's weekly capacity is booked, for one week: over capacity, well used and under-used.
 * Only Booked and Overbooked time counts; a booking that crosses the week's edge counts for the part inside it.
 */
export const UtilizationPage: React.FC = () => {
  const weekStart: WeekStart = useStudioLocale()?.week_start === 0 ? 0 : 1;
  const [day, setDay] = useState(() => dayKey(new Date()));
  const days = weekOf(day, weekStart);
  const span = windowOf(days[0], days[6]);
  const resources = useQuery({ queryKey: [...resourcesApi.keys.lists(), 'utilization'], queryFn: ({ signal }) => fetchAllRows(resourcesApi.list, {}, { signal }) });
  const bookings = useQuery({ queryKey: [...bookingsApi.keys.lists(), 'utilization', span.start, span.end], queryFn: ({ signal }) => fetchAllRows(bookingsApi.list, { start: span.start, end: span.end }, { signal }) });
  const rows = resources.data && bookings.data ? utilizationOf(resources.data, bookings.data, new Date(span.start), new Date(span.end)) : [];
  const average = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.percent, 0) / rows.length) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Utilization</h1>
          <p className="text-xs text-slate-400 mt-1">{`Booked hours against each resource's weekly capacity, ${formatDay(days[0])} to ${formatDay(days[6])}.`}</p>
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

      <QueryBoundary
        isLoading={resources.isLoading || bookings.isLoading}
        error={resources.error ?? bookings.error}
        onRetry={() => {
          void resources.refetch();
          void bookings.refetch();
        }}
        entityName="utilization"
        isEmpty={rows.length === 0}
        empty={{ title: 'No resources with a weekly capacity', description: 'Utilization needs resources that have capacity hours per week.' }}
      >
        <dl aria-label="Summary" className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">Average</dt>
            <dd className="mt-1 font-mono text-xl text-slate-100">{average}%</dd>
          </div>
          {BANDS.map((b) => (
            <div key={b.band} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3" title={b.hint}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{b.label}</dt>
              <dd className={cn('mt-1 font-mono text-xl', TEXT[b.band])}>{rows.filter((r) => r.band === b.band).length}</dd>
            </div>
          ))}
        </dl>

        {BANDS.map((b) => {
          const inBand = rows.filter((r) => r.band === b.band);
          if (inBand.length === 0) return null;
          return (
            <section key={b.band} aria-label={b.label} className="space-y-2">
              <h2 className={cn('text-sm font-semibold', TEXT[b.band])}>
                {b.label} <span className="font-mono text-xs text-slate-500">({inBand.length})</span>
              </h2>
              <ul className="space-y-1.5">
                {inBand.map(({ resource, booked, capacity, percent }) => (
                  <li key={resource.id} className="grid grid-cols-[minmax(0,12rem)_1fr_12rem] items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                    <span className="min-w-0">
                      <Link to={`/scheduling/resources/${resource.id}`} className="block truncate font-semibold text-cyan-300 hover:underline">
                        {resource.name}
                      </Link>
                      <span className="block truncate text-[11px] text-slate-500">{[resource.resource_type_display, resource.department_name].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <span role="meter" aria-label={`${resource.name} utilization`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)} className={cn('block h-full rounded-full', BAR[b.band])} style={{ width: `${Math.min(percent, 100)}%` }} />
                    </span>
                    <span className="text-right font-mono text-slate-300">
                      <span className={TEXT[b.band]}>{percent}%</span> · {formatHours(booked)} of {formatHours(capacity)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </QueryBoundary>
    </div>
  );
};
