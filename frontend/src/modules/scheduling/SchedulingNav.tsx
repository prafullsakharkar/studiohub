import type React from 'react';
import { NavLink } from 'react-router-dom';
import { useCan } from '@/core/permissions/useCan';
import { cn } from '@/shared/utils/cn';

const SECTIONS: ReadonlyArray<{ to: string; label: string; end?: boolean; permission?: string }> = [
  { to: '/scheduling', label: 'Calendar', end: true },
  { to: '/scheduling/resources', label: 'Resources' },
  { to: '/scheduling/bookings', label: 'Bookings' },
  { to: '/scheduling/leaves', label: 'Leave' },
  { to: '/scheduling/events', label: 'Events' },
  { to: '/scheduling/milestones', label: 'Milestones' },
  { to: '/scheduling/capacity', label: 'Capacity' },
  { to: '/scheduling/holidays', label: 'Holidays' },
  { to: '/scheduling/calendars', label: 'Work calendars' },
];

/** The scheduling sections, above every scheduling screen. All of them are read with schedule.view. */
export const SchedulingNav: React.FC = () => {
  const canView = useCan('schedule.view');
  if (!canView) return null;
  return (
    <nav aria-label="Scheduling sections" className="flex flex-wrap gap-1 border-b border-slate-800 px-4 sm:px-6 pt-4">
      {SECTIONS.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end={section.end}
          className={({ isActive }) => cn('px-3 py-2 text-xs font-semibold border-b-2', isActive ? 'text-cyan-300 border-cyan-400' : 'text-slate-400 border-transparent hover:text-slate-200')}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
};
