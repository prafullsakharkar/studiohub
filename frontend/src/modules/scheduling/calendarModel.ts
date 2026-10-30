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
