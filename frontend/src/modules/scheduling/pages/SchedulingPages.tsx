import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { CalendarPage } from '../CalendarPage';
import { CapacityPage } from '../CapacityPage';
import { bookingFormConfig, calendarFormConfig, eventFormConfig, holidayFormConfig, leaveFormConfig, milestoneFormConfig, resourceFormConfig, useBookingsListConfig, useCalendarsListConfig, useEventsListConfig, useHolidaysListConfig, useLeavesListConfig, useMilestonesListConfig, useResourcesListConfig } from '../records';
import { ResourceWorkspace } from '../ResourceWorkspace';
import { SchedulingNav } from '../SchedulingNav';

/** Every scheduling screen sits under the section navigation. */
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <SchedulingNav />
    {children}
  </>
);

export const SchedulingCalendarPage: React.FC = () => (
  <Shell>
    <CalendarPage />
  </Shell>
);
export const SchedulingCapacityPage: React.FC = () => (
  <Shell>
    <CapacityPage />
  </Shell>
);

const Resources: React.FC = () => <DirectoryListPage config={useResourcesListConfig()} />;
const Bookings: React.FC = () => <DirectoryListPage config={useBookingsListConfig()} />;
const Leaves: React.FC = () => <DirectoryListPage config={useLeavesListConfig()} />;
const Events: React.FC = () => <DirectoryListPage config={useEventsListConfig()} />;
const Milestones: React.FC = () => <DirectoryListPage config={useMilestonesListConfig()} />;
const Holidays: React.FC = () => <DirectoryListPage config={useHolidaysListConfig()} />;
const Calendars: React.FC = () => <DirectoryListPage config={useCalendarsListConfig()} />;

const list = (Page: React.FC): React.FC => () => (
  <Shell>
    <Page />
  </Shell>
);
const form = (config: Parameters<typeof DirectoryFormPage>[0]['config']): React.FC => () => (
  <Shell>
    <DirectoryFormPage config={config} />
  </Shell>
);

export const ResourcesPage = list(Resources);
export const ResourceFormPage = form(resourceFormConfig as never);
export const ResourceWorkspacePage: React.FC = () => (
  <Shell>
    <ResourceWorkspace />
  </Shell>
);
export const BookingsPage = list(Bookings);
export const BookingFormPage = form(bookingFormConfig as never);
export const LeavesPage = list(Leaves);
export const LeaveFormPage = form(leaveFormConfig as never);
export const EventsPage = list(Events);
export const EventFormPage = form(eventFormConfig as never);
export const MilestonesPage = list(Milestones);
export const MilestoneFormPage = form(milestoneFormConfig as never);
export const HolidaysPage = list(Holidays);
export const HolidayFormPage = form(holidayFormConfig as never);
export const WorkCalendarsPage = list(Calendars);
export const WorkCalendarFormPage = form(calendarFormConfig as never);
