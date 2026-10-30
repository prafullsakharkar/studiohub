import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { daysBetween, eventDays, itemsByDay, monthGrid } from '../calendarModel';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('scheduling/_flow.json');
const items = (key: string): any[] => flow[key].body.items ?? flow[key].body;

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
