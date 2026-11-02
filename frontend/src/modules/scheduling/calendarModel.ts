import type { CalendarEventRow, Holiday, Leave, Milestone } from '@/api/scheduling/scheduling';

export type DayItemKind = 'event' | 'milestone' | 'holiday' | 'leave';

export interface DayItem {
  /** Unique within a day. */
  key: string;
  kind: DayItemKind;
  title: string;
  /** A second line: the time, the person, the calendar. */
  detail: string;
  /** Pending leave and unfinished milestones are drawn lighter. */
  muted?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A local calendar day as `YYYY-MM-DD`: the key days are grouped by (a plain day from the API is already one). */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A key back as a local date at noon (so a DST change never moves it to another day). */
export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Every day from `from` to `to`, inclusive, as keys. A backwards range is empty. */
export function daysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  for (let d = fromKey(from); dayKey(d) <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)) {
    keys.push(dayKey(d));
    if (keys.length > 366) break; // a guard against a typo'd year
  }
  return keys;
}

/** The weeks (Monday first) that show `month` (0-11) of `year`: 5 or 6 rows of 7 keys. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7; // Monday is 0
  const start = new Date(year, month, 1 - offset, 12);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i, 12)));
    if (w >= 4 && fromKey(week[0]).getMonth() !== month) break; // the last row only when it still shows this month
    weeks.push(week);
  }
  return weeks;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** The local days an event covers; an event that ends exactly at midnight does not touch the day it ends on. */
export function eventDays(event: Pick<CalendarEventRow, 'start_time' | 'end_time'>): string[] {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const last = end > start && end.getHours() === 0 && end.getMinutes() === 0 ? new Date(end.getTime() - 1) : end;
  return daysBetween(dayKey(start), dayKey(last < start ? start : last));
}

export interface CalendarData {
  events: CalendarEventRow[];
  milestones: Milestone[];
  holidays: Holiday[];
  leaves: Leave[];
}

/** Everything that happens on each day, ready to draw. Cancelled events and rejected or cancelled leave are left out. */
export function itemsByDay({ events, milestones, holidays, leaves }: CalendarData): Map<string, DayItem[]> {
  const days = new Map<string, DayItem[]>();
  const add = (key: string, item: DayItem) => days.set(key, [...(days.get(key) ?? []), item]);
  for (const e of events) {
    if (e.status === 'Cancelled') continue;
    for (const key of eventDays(e)) add(key, { key: `event-${e.id}`, kind: 'event', title: e.title, detail: e.is_all_day ? 'All day' : `${time(e.start_time)} – ${time(e.end_time)}${e.location ? ` · ${e.location}` : ''}`, muted: e.status === 'Completed' });
  }
  for (const m of milestones) add(m.due_date.slice(0, 10), { key: `milestone-${m.id}`, kind: 'milestone', title: m.name, detail: `${m.project_code} · ${m.status}`, muted: m.status === 'Completed' });
  for (const h of holidays) add(h.holiday_date.slice(0, 10), { key: `holiday-${h.id}`, kind: 'holiday', title: h.name, detail: `${h.calendar_name}${h.is_optional ? ' · optional' : ''}` });
  for (const l of leaves) {
    if (l.status !== 'Approved' && l.status !== 'Pending') continue;
    for (const key of daysBetween(l.start_date.slice(0, 10), l.end_date.slice(0, 10))) add(key, { key: `leave-${l.id}`, kind: 'leave', title: `${l.resource_name} off`, detail: `${l.leave_type_display || l.leave_type} · ${l.status}`, muted: l.status === 'Pending' });
  }
  return days;
}

// ------------------------------------------------------------------------------------------------ week, day, timeline

/** `key` moved by `n` days (negative goes back). */
export const addDays = (key: string, n: number): string => {
  const d = fromKey(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12));
};

/** The seven days (Monday first) of the week that holds `key`. */
export function weekOf(key: string): string[] {
  const monday = addDays(key, -((fromKey(key).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const midnight = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * The window the server wants for the days `from` to `through` (inclusive): the start of the first day and the start of
 * the day after the last, as instants WITH a time zone (a bare date-time is a 400 on bookings and events).
 */
export const windowOf = (from: string, through: string) => ({ start: midnight(from).toISOString(), end: midnight(addDays(through, 1)).toISOString() });

/** The clock minutes (0 to 1440) of `date` on the day `key`, before the day 0 and after it 1440. */
const clockMinutes = (date: Date, key: string): number => {
  const day = dayKey(date);
  if (day < key) return 0;
  if (day > key) return 1440;
  return date.getHours() * 60 + date.getMinutes();
};

export interface Span {
  id: string;
  start: string;
  end: string;
}

export interface Placed {
  id: string;
  /** Clock minutes from midnight of the day, clipped to it. */
  startMinutes: number;
  endMinutes: number;
  /** Which of `lanes` side-by-side columns the item sits in, so overlapping items do not hide each other. */
  lane: number;
  lanes: number;
}

/** A very short item is drawn at least this tall (in minutes) so it can be read and clicked. */
export const MIN_MINUTES = 20;

/**
 * The timed items of one day, clipped to it and given a lane. Items that overlap in time (directly or through a chain)
 * share the width: the first goes in the first free lane, and every item of the chain is as narrow as the chain is wide.
 */
export function placeTimed(spans: Span[], day: string): Placed[] {
  const open = midnight(day).getTime();
  const close = midnight(addDays(day, 1)).getTime();
  const items = spans
    .map((s) => ({ id: s.id, start: new Date(s.start), end: new Date(s.end) }))
    .filter((s) => !Number.isNaN(s.start.getTime()) && !Number.isNaN(s.end.getTime()) && s.end.getTime() > open && s.start.getTime() < close)
    .map((s) => {
      const startMinutes = clockMinutes(s.start, day);
      const endMinutes = Math.min(1440, Math.max(clockMinutes(s.end, day), startMinutes + MIN_MINUTES));
      return { id: s.id, startMinutes, endMinutes };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes || a.id.localeCompare(b.id));

  const placed: Placed[] = [];
  let chain: Placed[] = [];
  let laneEnds: number[] = [];
  let chainEnd = -1;
  const closeChain = () => {
    for (const p of chain) p.lanes = laneEnds.length;
    chain = [];
    laneEnds = [];
  };
  for (const item of items) {
    if (item.startMinutes >= chainEnd) {
      closeChain();
      chainEnd = -1;
    }
    let lane = laneEnds.findIndex((end) => end <= item.startMinutes);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.endMinutes;
    chainEnd = Math.max(chainEnd, item.endMinutes);
    const p: Placed = { ...item, lane, lanes: 1 };
    chain.push(p);
    placed.push(p);
  }
  closeChain();
  return placed;
}

/** Where `date` falls on a row of equal-width day columns: the column index plus the fraction of that day, clamped to the row. */
export function positionIn(days: string[], date: Date): number {
  const key = dayKey(date);
  if (key < days[0]) return 0;
  if (key > days[days.length - 1]) return days.length;
  return days.indexOf(key) + (date.getHours() * 60 + date.getMinutes()) / 1440;
}

export interface Bar {
  id: string;
  resource: string;
  /** Percentages of the row. */
  left: number;
  width: number;
  lane: number;
  /** The booking began before the first day / runs past the last one shown. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

export interface BarsOfRow {
  bars: Bar[];
  lanes: number;
}

/** The narrowest a bar is drawn, in percent of the row, so a short booking can still be seen. */
export const MIN_BAR = 0.6;

/**
 * Bookings as bars on rows of equal-width day columns, grouped by resource. Bookings of one resource that overlap in time
 * (an Overbooked slot does) go in lanes below one another. Positions follow the day columns, so a daylight-saving change
 * does not shift a bar off its day. A booking outside the days is left out.
 */
export function layoutBars(bookings: Array<{ id: string; resource: string; start_time: string; end_time: string }>, days: string[]): Map<string, BarsOfRow> {
  const rows = new Map<string, BarsOfRow>();
  if (days.length === 0) return rows;
  const first = midnight(days[0]).getTime();
  const last = midnight(addDays(days[days.length - 1], 1)).getTime();
  const sorted = bookings
    .map((b) => ({ ...b, start: new Date(b.start_time), end: new Date(b.end_time) }))
    .filter((b) => !Number.isNaN(b.start.getTime()) && !Number.isNaN(b.end.getTime()) && b.end.getTime() > b.start.getTime() && b.end.getTime() > first && b.start.getTime() < last)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id));
  const laneEnds = new Map<string, number[]>();
  for (const b of sorted) {
    const ends = laneEnds.get(b.resource) ?? [];
    let lane = ends.findIndex((end) => end <= b.start.getTime());
    if (lane === -1) lane = ends.length;
    ends[lane] = b.end.getTime();
    laneEnds.set(b.resource, ends);
    const from = positionIn(days, b.start);
    const to = positionIn(days, b.end);
    const row = rows.get(b.resource) ?? { bars: [], lanes: 0 };
    row.bars.push({
      id: b.id,
      resource: b.resource,
      left: (from / days.length) * 100,
      width: Math.max(((to - from) / days.length) * 100, MIN_BAR),
      lane,
      clippedStart: b.start.getTime() < first,
      clippedEnd: b.end.getTime() > last,
    });
    row.lanes = ends.length;
    rows.set(b.resource, row);
  }
  return rows;
}

/** The days each resource is away (approved or pending leave), by resource id: `day -> status`. */
export function leaveDaysByResource(leaves: Leave[], days: string[]): Map<string, Map<string, string>> {
  const shown = new Set(days);
  const away = new Map<string, Map<string, string>>();
  for (const l of leaves) {
    if (l.status !== 'Approved' && l.status !== 'Pending') continue;
    for (const key of daysBetween(l.start_date.slice(0, 10), l.end_date.slice(0, 10))) {
      if (!shown.has(key)) continue;
      const mine = away.get(l.resource) ?? new Map<string, string>();
      mine.set(key, l.status);
      away.set(l.resource, mine);
    }
  }
  return away;
}

/** The holidays of each work calendar, by calendar id: `day -> holiday`. */
export function holidaysByCalendar(holidays: Holiday[], days: string[]): Map<string, Map<string, Holiday>> {
  const shown = new Set(days);
  const byCalendar = new Map<string, Map<string, Holiday>>();
  for (const h of holidays) {
    const key = h.holiday_date.slice(0, 10);
    if (!shown.has(key)) continue;
    const mine = byCalendar.get(h.calendar) ?? new Map<string, Holiday>();
    mine.set(key, h);
    byCalendar.set(h.calendar, mine);
  }
  return byCalendar;
}

export interface DayAgenda {
  /** All-day events, milestones, holidays and leave of the day. */
  allDay: DayItem[];
  /** Timed events that touch the day. */
  timed: Placed[];
}

/** One day split for a time grid: what has no clock time, and the timed events placed in lanes. */
export function dayAgenda(data: CalendarData, day: string): DayAgenda {
  const timedEvents = data.events.filter((e) => e.status !== 'Cancelled' && !e.is_all_day);
  const timedIds = new Set(timedEvents.map((e) => `event-${e.id}`));
  const items = itemsByDay(data).get(day) ?? [];
  return {
    allDay: items.filter((i) => !timedIds.has(i.key)),
    timed: placeTimed(timedEvents.map((e) => ({ id: e.id, start: e.start_time, end: e.end_time })), day),
  };
}
