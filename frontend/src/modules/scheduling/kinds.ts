import type { DayItemKind } from './calendarModel';

export const KIND_STYLE: Record<DayItemKind, string> = {
  event: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/30',
  milestone: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
  holiday: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  leave: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
};
export const KIND_LABEL: Record<DayItemKind, string> = { event: 'Event', milestone: 'Milestone', holiday: 'Holiday', leave: 'Leave' };
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
