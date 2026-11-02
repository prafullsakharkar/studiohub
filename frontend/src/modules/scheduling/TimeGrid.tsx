import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { dayAgenda, fromKey } from './calendarModel';
import type { CalendarData } from './calendarModel';
import { formatDay } from './format';
import { KIND_LABEL, KIND_STYLE } from './kinds';

/** One hour is this tall, in pixels. */
export const HOUR_PX = 48;
const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const minutesText = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

interface Props {
  /** One day (the Day view) or the seven of a week. */
  days: string[];
  data: CalendarData;
  selected: string;
  today: string;
  onSelect: (day: string) => void;
  /** Whether an event links to its edit form. */
  canEditEvents: boolean;
}

/**
 * A time grid: the days side by side, an all-day band on top, and the timed events at their clock time over 24 hours.
 * Events that overlap sit side by side (see `placeTimed`). Everything is the studio calendar's own data; times are in the
 * browser's zone.
 */
export const TimeGrid: React.FC<Props> = ({ days, data, selected, today, onSelect, canEditEvents }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const agendas = useMemo(() => days.map((day) => ({ day, ...dayAgenda(data, day) })), [days, data]);
  const events = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events]);

  // Open on the working day: an hour before the first event shown, else 08:00.
  const firstMinute = Math.min(...agendas.flatMap((a) => a.timed.map((p) => p.startMinutes)), 8 * 60);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (firstMinute / 60 - 1) * HOUR_PX);
  }, [firstMinute]);

  const single = days.length === 1;
  return (
    <section aria-label={single ? formatDay(days[0]) : 'Week'} className="rounded-lg border border-slate-800 overflow-x-auto">
      <div className={cn(!single && 'min-w-[44rem]')}>
        <div className="flex border-b border-slate-800 bg-slate-900">
          <div className="w-12 shrink-0" />
          {agendas.map(({ day, allDay }) => (
            <div key={day} className={cn('flex-1 min-w-0 border-l border-slate-800 p-1.5 space-y-1', day === selected && 'bg-slate-800/60')}>
              <button
                type="button"
                aria-pressed={day === selected}
                aria-label={formatDay(day)}
                onClick={() => onSelect(day)}
                className={cn('block w-full text-left text-[11px] font-semibold', day === today ? 'text-cyan-300' : 'text-slate-300')}
              >
                {fromKey(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              </button>
              <ul aria-label={`All day on ${formatDay(day)}`} className="space-y-0.5">
                {allDay.map((item) => (
                  <li key={item.key} title={`${KIND_LABEL[item.kind]}: ${item.title} (${item.detail})`} className={cn('truncate rounded border px-1 text-[10px]', KIND_STYLE[item.kind], item.muted && 'opacity-60')}>
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div ref={scroller} className="max-h-[34rem] overflow-y-auto">
          <div className="flex" style={{ height: 24 * HOUR_PX }}>
            <ol aria-hidden="true" className="w-12 shrink-0 text-[10px] text-slate-500">
              {hours.map((label) => (
                <li key={label} style={{ height: HOUR_PX }} className="pr-1 text-right">
                  {label}
                </li>
              ))}
            </ol>
            {agendas.map(({ day, timed }) => (
              <ul
                key={day}
                aria-label={`Timed events on ${formatDay(day)}`}
                className={cn('relative flex-1 min-w-0 border-l border-slate-800', day === selected && 'bg-slate-800/30')}
                style={{ backgroundImage: 'linear-gradient(to bottom, rgb(51 65 85 / 0.5) 1px, transparent 1px)', backgroundSize: `100% ${HOUR_PX}px` }}
              >
                {timed.map((p) => {
                  const event = events.get(p.id);
                  if (!event) return null;
                  const range = `${minutesText(p.startMinutes)} – ${minutesText(p.endMinutes)}`;
                  const style = { top: (p.startMinutes / 60) * HOUR_PX, height: Math.max(((p.endMinutes - p.startMinutes) / 60) * HOUR_PX - 1, 14), left: `${(p.lane / p.lanes) * 100}%`, width: `${100 / p.lanes}%` };
                  const body = (
                    <>
                      <span className="block truncate font-semibold">{event.title}</span>
                      <span className="block truncate text-[10px] opacity-80">{event.is_all_day ? 'All day' : `${clock(event.start_time)} – ${clock(event.end_time)}`}</span>
                    </>
                  );
                  const classes = cn('absolute overflow-hidden rounded border px-1 py-0.5 text-[11px] leading-tight', KIND_STYLE.event, event.status === 'Completed' && 'opacity-60');
                  const title = `${event.title}, ${range}${event.location ? `, ${event.location}` : ''}`;
                  return (
                    <li key={`${day}-${event.id}`} style={style} className="absolute p-px">
                      {canEditEvents ? (
                        <Link to={`/scheduling/events/${event.id}/edit`} title={title} aria-label={title} className={cn(classes, 'inset-px block hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-cyan-400')}>
                          {body}
                        </Link>
                      ) : (
                        <article title={title} aria-label={title} className={cn(classes, 'inset-px')}>
                          {body}
                        </article>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
