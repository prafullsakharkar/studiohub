import type React from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Booking, Holiday, Leave, ResourceRow } from '@/api/scheduling/scheduling';
import { cn } from '@/shared/utils/cn';
import { fromKey, holidaysByCalendar, layoutBars, leaveDaysByResource } from './calendarModel';
import { formatDay, formatRange } from './format';

/** One lane of overlapping bookings is this tall, in pixels. */
export const LANE_PX = 22;
const BAR_STYLE: Record<string, string> = {
  Booked: 'bg-cyan-500/25 border-cyan-500/50 text-cyan-100',
  Blocked: 'bg-slate-500/30 border-slate-400/50 text-slate-100',
  Overbooked: 'bg-rose-500/25 border-rose-500/60 text-rose-100',
};
const barStyle = (status: string) => BAR_STYLE[status] ?? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-100';

interface Props {
  /** The days across the top (the timeline draws two weeks). */
  days: string[];
  resources: ResourceRow[];
  bookings: Booking[];
  leaves: Leave[];
  holidays: Holiday[];
  selected: string;
  today: string;
  onSelect: (day: string) => void;
  /** Whether a booking links to its edit form and a row offers "Book". */
  canBook: boolean;
}

/**
 * Resources down, days across: each booking is a bar over the days it covers, an approved or pending leave and the holidays of
 * the resource's own work calendar shade the days, weekends are dimmed. Overlapping bookings of one resource (an Overbooked
 * slot does) stack in lanes. Bookings are read for exactly the window shown (the server filters by it).
 */
export const TimelineView: React.FC<Props> = ({ days, resources, bookings, leaves, holidays, selected, today, onSelect, canBook }) => {
  const [filter, setFilter] = useState('');
  const bars = useMemo(() => layoutBars(bookings, days), [bookings, days]);
  const away = useMemo(() => leaveDaysByResource(leaves, days), [leaves, days]);
  const closed = useMemo(() => holidaysByCalendar(holidays, days), [holidays, days]);
  const byId = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);
  const rows = useMemo(() => {
    const wanted = filter.trim().toLowerCase();
    return [...resources].filter((r) => !wanted || `${r.name} ${r.code} ${r.department_name ?? ''}`.toLowerCase().includes(wanted)).sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, filter]);
  const column = 100 / days.length;
  const weekend = (day: string) => [0, 6].includes(fromKey(day).getDay());

  return (
    <section aria-label="Resource timeline" className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="timeline-filter" className="text-xs text-slate-400">
          Filter resources
        </label>
        <input id="timeline-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by name, code or department" className="w-64 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white" />
        <span className="text-[11px] text-slate-500">{rows.length} shown</span>
      </div>
      <div className="rounded-lg border border-slate-800 overflow-x-auto">
        <div className="min-w-[60rem]">
          <div className="flex border-b border-slate-800 bg-slate-900">
            <div className="w-44 shrink-0" />
            <ol aria-label="Days" className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((day) => (
                <li key={day} className={cn('border-l border-slate-800', weekend(day) && 'bg-slate-950/40', day === selected && 'bg-slate-800/60')}>
                  <button type="button" aria-pressed={day === selected} aria-label={formatDay(day)} onClick={() => onSelect(day)} className={cn('block w-full px-1 py-1 text-center text-[10px] font-semibold', day === today ? 'text-cyan-300' : 'text-slate-400')}>
                    {fromKey(day).toLocaleDateString(undefined, { weekday: 'short' })}
                    <span className="block text-[11px]">{fromKey(day).getDate()}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">{resources.length === 0 ? 'There are no resources yet.' : 'No resource matches the filter.'}</p>
          ) : (
            <ul aria-label="Resources">
              {rows.map((r) => {
                const row = bars.get(r.id);
                const lanes = Math.max(row?.lanes ?? 1, 1);
                const mine = away.get(r.id);
                const theirs = r.calendar ? closed.get(r.calendar) : undefined;
                return (
                  <li key={r.id} className="flex border-t border-slate-800">
                    <div className="w-44 shrink-0 p-2">
                      <p className="truncate text-xs font-semibold text-white" title={r.name}>
                        {r.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">{[r.code, r.department_name].filter(Boolean).join(' · ')}</p>
                      {canBook && (
                        <Link className="text-[10px] text-cyan-300 hover:underline" aria-label={`Book ${r.name}`} to={`/scheduling/bookings/new?resource=${r.id}&start_time=${encodeURIComponent(`${selected}T09:00`)}&end_time=${encodeURIComponent(`${selected}T17:00`)}`}>
                          Book {formatDay(selected)}
                        </Link>
                      )}
                    </div>
                    <div className="relative flex-1" style={{ height: lanes * LANE_PX + 8 }}>
                      {days.map((day, i) => {
                        const leave = mine?.get(day);
                        const holiday = theirs?.get(day);
                        const shade = leave ? 'bg-amber-500/15' : holiday ? 'bg-emerald-500/15' : weekend(day) ? 'bg-slate-950/40' : '';
                        const title = leave ? `On leave (${leave})` : holiday ? `${holiday.name}${holiday.is_optional ? ' (optional)' : ''}` : undefined;
                        return <div key={day} title={title} data-shade={leave ? 'leave' : holiday ? 'holiday' : weekend(day) ? 'weekend' : undefined} className={cn('absolute inset-y-0 border-l border-slate-800', shade)} style={{ left: `${i * column}%`, width: `${column}%` }} />;
                      })}
                      <ul aria-label={`Bookings of ${r.name}`}>
                        {(row?.bars ?? []).map((bar) => {
                          const b = byId.get(bar.id);
                          if (!b) return null;
                          const text = `${b.status}${b.notes ? `: ${b.notes}` : ''}`;
                          const title = `${r.name}, ${text}, ${formatRange(b.start_time, b.end_time)}`;
                          const classes = cn('absolute block overflow-hidden whitespace-nowrap border px-1 text-[10px] leading-5', barStyle(b.status), bar.clippedStart ? 'rounded-l-none border-l-0' : 'rounded-l', bar.clippedEnd ? 'rounded-r-none border-r-0' : 'rounded-r');
                          const style = { left: `${bar.left}%`, width: `${bar.width}%`, top: 4 + bar.lane * LANE_PX, height: LANE_PX - 2 };
                          return (
                            <li key={bar.id}>
                              {canBook ? (
                                <Link to={`/scheduling/bookings/${b.id}/edit`} title={title} aria-label={title} style={style} className={cn(classes, 'hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-cyan-400')}>
                                  {text}
                                </Link>
                              ) : (
                                <article title={title} aria-label={title} style={style} className={classes}>
                                  {text}
                                </article>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">Cyan is booked, grey is blocked, red is overbooked. Amber days are leave, green days are holidays of the resource’s work calendar. Times are shown in your time zone.</p>
    </section>
  );
};
