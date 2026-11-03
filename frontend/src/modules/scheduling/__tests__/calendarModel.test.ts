import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { MIN_BAR, MIN_MINUTES, addDays, dayAgenda, daysBetween, eventDays, holidaysByCalendar, itemsByDay, layoutBars, leaveDaysByResource, monthGrid, placeTimed, positionIn, weekOf, windowOf } from '../calendarModel';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('scheduling/_flow.json');
const items = (key: string): any[] => flow[key].body.items ?? flow[key].body;

describe('a week that starts on Sunday (the studio localization’s week_start 0)', () => {
  it('moves the month grid’s first column to Sunday and keeps 7 days a row', () => {
    const weeks = monthGrid(2026, 9, 0); // October 2026 starts on a Thursday
    expect(weeks[0][0]).toBe('2026-09-27');
    expect(weeks[0][6]).toBe('2026-10-03');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((k) => k.startsWith('2026-10-'))).toHaveLength(31);
    expect(monthGrid(2026, 9, 1)[0][0]).toBe('2026-09-28'); // Monday-first, the default
    expect(monthGrid(2026, 9)[0][0]).toBe('2026-09-28');
  });
  it('starts the week on the Sunday on or before the day', () => {
    expect(weekOf('2026-11-04', 0)[0]).toBe('2026-11-01'); // a Wednesday
    expect(weekOf('2026-11-04', 0)[6]).toBe('2026-11-07');
    expect(weekOf('2026-11-01', 0)[0]).toBe('2026-11-01'); // a Sunday starts its own week
    expect(weekOf('2026-11-01', 1)[0]).toBe('2026-10-26'); // ... and ends the Monday-first one
    expect(weekOf('2026-11-04')[0]).toBe('2026-11-02');
  });
});

describe('month grid', () => {
  it('starts on a Monday, has 7 days a row and covers the whole month', () => {
    const weeks = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(weeks[0][0]).toBe('2026-10-26');
    expect(weeks[0][6]).toBe('2026-11-01');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const all = weeks.flat();
    expect(all).toContain('2026-11-30');
    expect(all.filter((k) => k.startsWith('2026-11-'))).toHaveLength(30);
  });
  it('February of a non-leap year starting on a Monday takes four rows', () => {
    expect(monthGrid(2027, 1)).toHaveLength(4); // 1 Feb 2027 is a Monday
  });
  it('days between are inclusive, in order, and a backwards range is empty', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(daysBetween('2026-12-05', '2026-12-01')).toEqual([]);
  });
});

describe('events on days', () => {
  it('an event covers the local days it spans; ending at midnight does not touch the next day', () => {
    expect(eventDays({ start_time: new Date(2026, 10, 4, 10).toISOString(), end_time: new Date(2026, 10, 4, 11).toISOString() })).toEqual(['2026-11-04']);
    expect(eventDays({ start_time: new Date(2026, 10, 6, 0).toISOString(), end_time: new Date(2026, 10, 7, 0).toISOString() })).toEqual(['2026-11-06']);
    expect(eventDays({ start_time: new Date(2026, 10, 6, 22).toISOString(), end_time: new Date(2026, 10, 7, 2).toISOString() })).toEqual(['2026-11-06', '2026-11-07']);
    expect(eventDays({ start_time: 'soon', end_time: 'later' })).toEqual([]);
  });
});

describe('what happens each day', () => {
  const data = {
    events: items('events_list'),
    milestones: items('milestones_list'),
    holidays: items('holidays_list'),
    leaves: items('leaves_list_manager'),
  };
  it('puts the captured milestones, holidays and leave on their days', () => {
    const days = itemsByDay(data);
    const milestone = data.milestones[0];
    expect(days.get(milestone.due_date)?.some((i) => i.kind === 'milestone' && i.title === milestone.name)).toBe(true);
    const holiday = data.holidays[0];
    expect(days.get(holiday.holiday_date)?.some((i) => i.kind === 'holiday')).toBe(true);
    const leave = data.leaves.find((l) => l.start_date === '2026-12-21');
    expect(days.get('2026-12-24')?.some((i) => i.kind === 'leave' && i.title === `${leave.resource_name} off`)).toBe(true);
    expect(days.get(leave.end_date)?.some((i) => i.kind === 'leave')).toBe(true);
    expect(days.get('2027-01-01')?.some((i) => i.kind === 'leave')).toBeFalsy(); // the day after the request ends
  });
  it('leaves out a cancelled event and rejected leave, and draws pending leave lighter', () => {
    const base = { ...data.events[0], start_time: new Date(2026, 10, 9, 9).toISOString(), end_time: new Date(2026, 10, 9, 10).toISOString() };
    const days = itemsByDay({ events: [{ ...base, id: 'e1', status: 'Cancelled' }, { ...base, id: 'e2', status: 'Scheduled' }], milestones: [], holidays: [], leaves: [{ ...data.leaves[0], id: 'l1', status: 'Rejected', start_date: '2026-11-09', end_date: '2026-11-09' }, { ...data.leaves[0], id: 'l2', status: 'Pending', start_date: '2026-11-09', end_date: '2026-11-09' }] });
    const day = days.get('2026-11-09') ?? [];
    expect(day.map((i) => i.key).sort()).toEqual(['event-e2', 'leave-l2']);
    expect(day.find((i) => i.kind === 'leave')?.muted).toBe(true);
  });
});

/** A local clock time as the ISO instant the API would send. */
const at = (day: string, h: number, m = 0) => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
};

describe('week and window', () => {
  it('moves days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-01', 7)).toBe('2026-03-08');
  });
  it('a week is Monday to Sunday whichever day inside it is asked for', () => {
    const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
    for (const day of week) expect(weekOf(day)).toEqual(week);
    expect(weekOf('2027-01-01')[0]).toBe('2026-12-28'); // across the year
  });
  it('the window is local midnight to the next local midnight, as instants with a time zone', () => {
    const { start, end } = windowOf('2026-11-02', '2026-11-08');
    expect(start).toBe(new Date(2026, 10, 2).toISOString());
    expect(end).toBe(new Date(2026, 10, 9).toISOString());
    expect(start.endsWith('Z') && end.endsWith('Z')).toBe(true);
    expect(windowOf('2026-11-04', '2026-11-04').end).toBe(new Date(2026, 10, 5).toISOString());
  });
});

describe('timed items on a day', () => {
  const span = (id: string, start: string, end: string) => ({ id, start, end });
  const day = '2026-11-04';

  it('places one item at its clock time in the only lane', () => {
    expect(placeTimed([span('a', at(day, 10), at(day, 11))], day)).toEqual([{ id: 'a', startMinutes: 600, endMinutes: 660, lane: 0, lanes: 1 }]);
  });
  it('puts overlapping items side by side', () => {
    const placed = placeTimed([span('a', at(day, 10), at(day, 11)), span('b', at(day, 10, 30), at(day, 11, 30))], day);
    expect(placed.map((p) => [p.id, p.lane, p.lanes])).toEqual([['a', 0, 2], ['b', 1, 2]]);
  });
  it('shares the width along a chain of overlaps and reuses a lane that has ended', () => {
    const placed = placeTimed([span('a', at(day, 9), at(day, 10, 30)), span('b', at(day, 10), at(day, 11)), span('c', at(day, 10, 45), at(day, 12))], day);
    expect(placed.map((p) => [p.id, p.lane, p.lanes])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 2]]);
  });
  it('items that only touch are not side by side, and later ones start a fresh chain', () => {
    const placed = placeTimed([span('a', at(day, 10), at(day, 11)), span('b', at(day, 11), at(day, 12)), span('c', at(day, 10), at(day, 12))], day);
    expect(placed.find((p) => p.id === 'b')).toMatchObject({ lane: 1, lanes: 2 }); // c spans both: the chain holds all three
    const apart = placeTimed([span('a', at(day, 8), at(day, 9)), span('b', at(day, 9), at(day, 10))], day);
    expect(apart.map((p) => [p.lane, p.lanes])).toEqual([[0, 1], [0, 1]]);
  });
  it('an item that only follows an overlapping pair has the full width again', () => {
    const placed = placeTimed([span('a', at(day, 8), at(day, 9)), span('b', at(day, 8, 30), at(day, 9, 30)), span('c', at(day, 9, 30), at(day, 10))], day);
    expect(placed.map((p) => [p.id, p.lane, p.lanes])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 1]]);
  });
  it('clips an item that crosses midnight to each day it touches, and an item ending at midnight does not touch the next', () => {
    const night = span('n', at('2026-11-03', 22), at('2026-11-04', 2));
    expect(placeTimed([night], '2026-11-03')[0]).toMatchObject({ startMinutes: 1320, endMinutes: 1440 });
    expect(placeTimed([night], '2026-11-04')[0]).toMatchObject({ startMinutes: 0, endMinutes: 120 });
    expect(placeTimed([night], '2026-11-05')).toEqual([]);
    expect(placeTimed([span('m', at('2026-11-04', 22), at('2026-11-05', 0))], '2026-11-05')).toEqual([]);
  });
  it('draws a very short item tall enough to read, never past the end of the day', () => {
    expect(placeTimed([span('t', at(day, 10), at(day, 10, 5))], day)[0].endMinutes).toBe(600 + MIN_MINUTES);
    expect(placeTimed([span('t', at(day, 23, 55), at(day, 23, 58))], day)[0].endMinutes).toBe(1440);
  });
  it('ignores items outside the day and ones with no readable time', () => {
    expect(placeTimed([span('x', at('2026-11-06', 9), at('2026-11-06', 10)), span('y', 'soon', 'later')], day)).toEqual([]);
  });
});

describe('bookings as bars on a timeline', () => {
  const days = Array.from({ length: 14 }, (_, i) => addDays('2026-11-02', i));
  const booking = (id: string, resource: string, start: string, end: string) => ({ id, resource, start_time: start, end_time: end });

  it('positions where a booking begins and how far it runs, as a share of the row', () => {
    const rows = layoutBars([booking('b', 'r1', at('2026-11-02', 9), at('2026-11-02', 17))], days);
    const bar = rows.get('r1')?.bars[0];
    expect(bar?.left).toBeCloseTo((540 / 1440 / 14) * 100, 6);
    expect(bar?.width).toBeCloseTo((480 / 1440 / 14) * 100, 6);
    expect(bar?.lane).toBe(0);
  });
  it('a multi-day booking spans whole columns and a later day sits further right', () => {
    const rows = layoutBars([booking('b', 'r1', at('2026-11-04', 0), at('2026-11-07', 0))], days);
    const bar = rows.get('r1')?.bars[0];
    expect(bar?.left).toBeCloseTo((2 / 14) * 100, 6);
    expect(bar?.width).toBeCloseTo((3 / 14) * 100, 6);
  });
  it('stacks bookings of one resource that overlap, but not those of other resources', () => {
    const rows = layoutBars(
      [booking('a', 'r1', at('2026-11-02', 9), at('2026-11-02', 12)), booking('b', 'r1', at('2026-11-02', 10), at('2026-11-02', 11)), booking('c', 'r2', at('2026-11-02', 10), at('2026-11-02', 11)), booking('d', 'r1', at('2026-11-02', 12), at('2026-11-02', 13))],
      days
    );
    expect(rows.get('r1')?.bars.map((b) => [b.id, b.lane])).toEqual([['a', 0], ['b', 1], ['d', 0]]);
    expect(rows.get('r1')?.lanes).toBe(2);
    expect(rows.get('r2')?.lanes).toBe(1);
  });
  it('clips a booking that starts before or runs past the days shown, and says so', () => {
    const rows = layoutBars([booking('a', 'r1', at('2026-10-30', 9), at('2026-11-03', 12)), booking('b', 'r1', at('2026-11-14', 12), at('2026-11-20', 12))], days);
    const [a, b] = rows.get('r1')?.bars ?? [];
    expect(a).toMatchObject({ left: 0, clippedStart: true, clippedEnd: false });
    expect(b).toMatchObject({ clippedStart: false, clippedEnd: true });
    expect(b.left + b.width).toBeCloseTo(100, 6);
  });
  it('leaves out a booking outside the days, one that ends as the window opens, and nonsense', () => {
    const rows = layoutBars(
      [booking('x', 'r1', at('2026-12-01', 9), at('2026-12-01', 10)), booking('y', 'r1', at('2026-11-01', 9), at('2026-11-02', 0)), booking('z', 'r1', 'soon', 'later'), booking('w', 'r1', at('2026-11-03', 10), at('2026-11-03', 9))],
      days
    );
    expect(rows.size).toBe(0);
  });
  it('a short booking is still wide enough to see', () => {
    const rows = layoutBars([booking('s', 'r1', at('2026-11-02', 9), at('2026-11-02', 9, 5))], days);
    expect(rows.get('r1')?.bars[0].width).toBeGreaterThanOrEqual(MIN_BAR);
  });
  it('reads a position on a row of day columns, clamped to the row', () => {
    expect(positionIn(days, new Date(2026, 10, 5, 12))).toBeCloseTo(3.5, 6);
    expect(positionIn(days, new Date(2026, 9, 1))).toBe(0);
    expect(positionIn(days, new Date(2027, 0, 1))).toBe(14);
  });
});

describe('what shades a timeline row', () => {
  const days = ['2026-11-02', '2026-11-03', '2026-11-04'];
  const leave = (resource: string, status: string, from: string, to: string) => ({ id: `${resource}-${from}`, resource, status, start_date: from, end_date: to }) as never;
  it('lists the days of approved and pending leave inside the window, per resource, and no rejected leave', () => {
    const away = leaveDaysByResource([leave('r1', 'Approved', '2026-11-01', '2026-11-03'), leave('r1', 'Rejected', '2026-11-04', '2026-11-04'), leave('r2', 'Pending', '2026-11-04', '2026-11-09')], days);
    expect([...(away.get('r1') ?? [])]).toEqual([['2026-11-02', 'Approved'], ['2026-11-03', 'Approved']]);
    expect([...(away.get('r2') ?? [])]).toEqual([['2026-11-04', 'Pending']]);
  });
  it('lists holidays by their work calendar, inside the window only', () => {
    const holiday = (calendar: string, date: string) => ({ id: `${calendar}-${date}`, calendar, holiday_date: `${date}T00:00:00`, name: 'H' }) as never;
    const by = holidaysByCalendar([holiday('c1', '2026-11-03'), holiday('c2', '2026-11-04'), holiday('c1', '2026-12-25')], days);
    expect([...(by.get('c1')?.keys() ?? [])]).toEqual(['2026-11-03']);
    expect([...(by.get('c2')?.keys() ?? [])]).toEqual(['2026-11-04']);
  });
});

describe('a day split for a time grid', () => {
  it('keeps timed events for the grid and everything else in the all-day band, without cancelled events', () => {
    const event = (id: string, extra: object) => ({ id, title: id, status: 'Scheduled', is_all_day: false, location: '', start_time: at('2026-11-04', 10), end_time: at('2026-11-04', 11), ...extra }) as never;
    const agenda = dayAgenda(
      {
        events: [event('timed', {}), event('allday', { is_all_day: true, start_time: at('2026-11-04', 0), end_time: at('2026-11-05', 0) }), event('gone', { status: 'Cancelled' })],
        milestones: [{ id: 'm', name: 'Delivery', due_date: '2026-11-04', status: 'Pending', project_code: 'P' }] as never,
        holidays: [],
        leaves: [],
      },
      '2026-11-04'
    );
    expect(agenda.timed.map((p) => p.id)).toEqual(['timed']);
    expect(agenda.allDay.map((i) => i.key).sort()).toEqual(['event-allday', 'milestone-m']);
  });
});

