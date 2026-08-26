import { CalendarEvent, CalendarEventType, CalendarEventPriority } from '@/types/scheduling';

export function getEventTypeBadge(type: CalendarEventType) {
  switch (type) {
    case 'milestone':
      return {
        label: 'Milestone',
        bg: 'bg-pink-500/20',
        text: 'text-pink-400',
        border: 'border-pink-500/40',
        dot: 'bg-pink-400',
        iconName: 'Flag',
      };
    case 'review':
      return {
        label: 'Review / Dailies',
        bg: 'bg-cyan-500/20',
        text: 'text-cyan-400',
        border: 'border-cyan-500/40',
        dot: 'bg-cyan-400',
        iconName: 'PlayCircle',
      };
    case 'delivery':
      return {
        label: 'Delivery',
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        dot: 'bg-emerald-400',
        iconName: 'Send',
      };
    case 'task':
      return {
        label: 'Task Assignment',
        bg: 'bg-indigo-500/20',
        text: 'text-indigo-400',
        border: 'border-indigo-500/40',
        dot: 'bg-indigo-400',
        iconName: 'CheckSquare',
      };
    case 'project':
      return {
        label: 'Project Phase',
        bg: 'bg-rose-500/20',
        text: 'text-rose-400',
        border: 'border-rose-500/40',
        dot: 'bg-rose-400',
        iconName: 'Film',
      };
    case 'meeting':
      return {
        label: 'Meeting / Scrum',
        bg: 'bg-purple-500/20',
        text: 'text-purple-400',
        border: 'border-purple-500/40',
        dot: 'bg-purple-400',
        iconName: 'Users',
      };
    case 'leave':
      return {
        label: 'Artist Leave',
        bg: 'bg-slate-500/20',
        text: 'text-slate-400',
        border: 'border-slate-500/40',
        dot: 'bg-slate-400',
        iconName: 'CalendarOff',
      };
    case 'holiday':
      return {
        label: 'Studio Holiday',
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        dot: 'bg-amber-400',
        iconName: 'Sun',
      };
    case 'availability':
      return {
        label: 'Free Capacity',
        bg: 'bg-green-500/20',
        text: 'text-green-400',
        border: 'border-green-500/40',
        dot: 'bg-green-400',
        iconName: 'Zap',
      };
    default:
      return {
        label: 'Event',
        bg: 'bg-slate-800',
        text: 'text-slate-300',
        border: 'border-slate-700',
        dot: 'bg-slate-400',
        iconName: 'Calendar',
      };
  }
}

export function getPriorityBadge(priority: CalendarEventPriority) {
  switch (priority) {
    case 'Critical':
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'High':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'Medium':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'Low':
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
  }
}

export function formatEventDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatEventTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function getMonthDays(currentDate: Date): Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week for first day (0 = Sun, 1 = Mon ... 6 = Sat)
  // Let's use Monday as week start (0 = Mon ... 6 = Sun)
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: isSameDay(d, new Date(2026, 7, 26)), // Reference current simulation date
    });
  }

  // Current month days
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({
      date: d,
      isCurrentMonth: true,
      isToday: isSameDay(d, new Date(2026, 7, 26)),
    });
  }

  // Next month leading days to complete 35 or 42 grid cells
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: isSameDay(d, new Date(2026, 7, 26)),
    });
  }

  return days;
}

export function getWeekDays(currentDate: Date): Date[] {
  const start = new Date(currentDate);
  const day = start.getDay();
  // Monday start
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function isEventOnDate(event: CalendarEvent, date: Date): boolean {
  const eventStart = new Date(event.start_date.split('T')[0]);
  const eventEnd = new Date(event.end_date.split('T')[0]);
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return checkDate >= eventStart && checkDate <= eventEnd;
}
