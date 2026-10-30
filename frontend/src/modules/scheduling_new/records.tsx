import { useCan } from '@/core/permissions/useCan';
import { projectsApi } from '@/api/production/structure';
import { departmentsApi, departmentKeys } from '@/api/masterdata/departments';
import { bookingsApi, BOOKING_STATUSES, calendarsApi, EVENT_STATUSES, EVENT_TYPES, EVENT_VISIBILITIES, eventsApi, holidaysApi, LEAVE_STATUSES, LEAVE_TYPES, leavesApi, MILESTONE_KINDS, MILESTONE_STATUSES, milestonesApi, RESOURCE_TYPES, resourcesApi, WRITABLE_RESOURCE_STATUSES } from '@/api/scheduling/scheduling';
import type { Booking, CalendarEvent, CalendarEventRow, Holiday, Leave, Milestone, Resource, ResourceRow, WorkCalendar } from '@/api/scheduling/scheduling';
import { isCalendarDeletable, isLeaveEditable, leaveActionsFrom, milestoneActionsFrom } from '@/api/scheduling/schedulingFlow';
import { serverMessage } from '@/api/errors/serverMessage';
import { DepartmentPicker, OfficePicker, TeamPicker } from '@/modules/directory/pickers';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { ProjectPicker } from '@/modules/production/work/pickers';
import { Badge } from '@/shared/components/Badge';
import { withClientFilters } from '@/shared/data/clientFilters';
import { formatDay, formatMoment, formatRange, formatRate } from './format';
import { CalendarPicker, ResourcePicker, UserPicker } from './pickers';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));
const projectFilter = { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } } as const;
const resourceFilter = { key: 'resource_id', label: 'Resource', optionsFrom: { queryKey: resourcesApi.keys.all, fetchPage: resourcesApi.list as never, getLabel: ((r: { code: string }) => r.code) as never } } as const;

// -------------------------------------------------------------------------------------------- badges

export const resourceStatusVariant = (status: string) => (status === 'Active' ? 'success' : status === 'On Leave' ? 'warning' : 'neutral');
export const leaveStatusVariant = (status: string) => (status === 'Approved' ? 'success' : status === 'Rejected' ? 'destructive' : status === 'Pending' ? 'warning' : 'neutral');
export const bookingStatusVariant = (status: string) => (status === 'Booked' ? 'info' : status === 'Blocked' ? 'neutral' : status === 'Overbooked' ? 'destructive' : 'success');
export const milestoneStatusVariant = (status: string) => (status === 'Completed' ? 'success' : status === 'In Progress' ? 'info' : 'neutral');
export const eventStatusVariant = (status: string) => (status === 'Completed' ? 'success' : status === 'In Progress' ? 'info' : status === 'Cancelled' ? 'destructive' : status === 'Postponed' ? 'warning' : 'neutral');

// -------------------------------------------------------------------------------------------- resources

export function useResourcesListConfig(): DirectoryListConfig<ResourceRow> {
  const canSeeRates = useCan('schedule.view_rates');
  return {
    title: 'Resources',
    noun: 'resource',
    subtitle: 'The people, equipment and rooms that can be booked. A person shows as On Leave while an approved leave covers today.',
    queryKey: resourcesApi.keys.lists(),
    fetchPage: withClientFilters(resourcesApi.list, {
      resource_type: (row, value) => row.resource_type === value,
      status: (row, value) => row.status === value,
      department_id: (row, value) => row.department === value,
      calendar_id: (row, value) => row.calendar === value,
    }),
    remove: resourcesApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'schedule.delete',
    createPermission: 'schedule.manage',
    managePermission: 'schedule.update',
    rowName: (row) => row.code,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search name, code, location',
    basePath: '/scheduling/resources',
    filters: [
      { key: 'resource_type', label: 'Type', options: options(RESOURCE_TYPES) },
      { key: 'status', label: 'Status', options: options(['Active', 'On Leave', 'Unavailable']) },
      { key: 'department_id', label: 'Department', optionsFrom: { queryKey: departmentKeys.all, fetchPage: departmentsApi.list as never, getLabel: ((d: { name: string }) => d.name) as never } },
    ],
    columns: [
      { header: 'Resource', cell: (row) => `${row.code} · ${row.name}`, sortField: 'name' },
      { header: 'Type', cell: (row) => row.resource_type_display || row.resource_type },
      { header: 'Department', cell: (row) => row.department_name || '—' },
      { header: 'Calendar', cell: (row) => row.calendar_name || 'Default' },
      { header: 'Capacity', cell: (row) => `${row.capacity_hours_per_week} h/week`, sortField: 'capacity_hours_per_week' },
      ...(canSeeRates ? [{ header: 'Rate', cell: (row: ResourceRow) => formatRate(row.hourly_rate_usd), sortField: 'hourly_rate_usd' }] : []),
      { header: 'Status', cell: (row) => <Badge variant={resourceStatusVariant(row.status)}>{row.status}</Badge> },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Type', value: (r) => r.resource_type },
      { header: 'Department', value: (r) => r.department_name ?? '' },
      { header: 'Capacity (h/week)', value: (r) => r.capacity_hours_per_week },
      { header: 'Status', value: (r) => r.status },
    ],
  };
}

export const resourceFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50, onlyOnCreate: true, hint: 'Unique, in any case. Chosen once.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'select', name: 'resource_type', label: 'Type', options: options(RESOURCE_TYPES), initial: 'Person', onlyOnCreate: true },
  { kind: 'select', name: 'status', label: 'Status', options: options(WRITABLE_RESOURCE_STATUSES), initial: 'Active', hint: 'On Leave is shown while an approved leave covers today; it cannot be set.' },
  { kind: 'entity', name: 'department_id', rowKey: 'department', label: 'Department', render: (p) => <DepartmentPicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'entity', name: 'team_id', rowKey: 'team', label: 'Team', render: (p) => <TeamPicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'entity', name: 'user_id', rowKey: 'user', label: 'User account', permission: 'identity.user.view', onlyOnCreate: true, render: (p) => <UserPicker label="User account" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'entity', name: 'calendar_id', rowKey: 'calendar', label: 'Work calendar', render: (p) => <CalendarPicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'number', name: 'capacity_hours_per_week', label: 'Capacity (hours per week)', initial: '40' },
  { kind: 'text', name: 'hourly_rate_usd', label: 'Hourly rate (USD)', permission: 'schedule.view_rates', hint: 'A number such as 55.00.' },
  { kind: 'text', name: 'location', label: 'Location', maxLength: 255 },
];

export const resourceFormConfig: DirectoryFormConfig<Resource> = {
  noun: 'resource',
  basePath: '/scheduling/resources',
  queryKey: resourcesApi.keys.lists(),
  fields: resourceFormFields,
  get: resourcesApi.get,
  // A create answers with the fields that were sent, so the form goes to the saved row by its id.
  create: (input) => resourcesApi.create(input as never) as unknown as Promise<Resource>,
  update: (id, patch) => resourcesApi.update(id, patch as never) as unknown as Promise<Resource>,
};

// -------------------------------------------------------------------------------------------- bookings

export function useBookingsListConfig(scope?: { resourceId: string }): DirectoryListConfig<Booking> {
  return {
    title: 'Bookings',
    noun: 'booking',
    subtitle: 'Time slots of resources. Two Booked, Blocked or Overbooked slots of one resource cannot overlap; an Available slot never conflicts.',
    queryKey: bookingsApi.keys.lists(),
    fetchPage: withClientFilters(bookingsApi.list, {
      resource_id: (row, value) => row.resource === value,
      status: (row, value) => row.status === value,
    }),
    remove: bookingsApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'schedule.delete',
    createPermission: 'schedule.manage',
    managePermission: 'schedule.manage',
    rowName: (row) => `${row.resource_code} ${formatMoment(row.start_time)}`,
    defaultOrdering: '-start_time',
    searchPlaceholder: 'Search resource name or code',
    basePath: '/scheduling/bookings',
    rowLink: () => null,
    scope: scope ? { resource_id: scope.resourceId } : undefined,
    createQuery: scope ? `resource=${scope.resourceId}` : undefined,
    filters: [resourceFilter, { key: 'status', label: 'Status', options: options(BOOKING_STATUSES) }],
    bulk: {
      actions: [
        {
          label: 'Delete bookings',
          destructive: true,
          confirm: (count) => `Delete ${count} booking${count === 1 ? '' : 's'}?`,
          run: async (ids) => {
            try {
              const result = await bookingsApi.bulkDelete(ids);
              return result.failed_count === 0 ? `${result.succeeded_count} deleted.` : `${result.succeeded_count} deleted, ${result.failed_count} not found.`;
            } catch (error) {
              throw new Error(serverMessage(error));
            }
          },
        },
      ],
    },
    columns: [
      { header: 'Resource', cell: (row) => `${row.resource_code} · ${row.resource_name}` },
      { header: 'When', cell: (row) => formatRange(row.start_time, row.end_time), sortField: 'start_time' },
      { header: 'Status', cell: (row) => <Badge variant={bookingStatusVariant(row.status)}>{row.status}</Badge> },
      { header: 'Notes', cell: (row) => row.notes || '—' },
    ],
  };
}

export const bookingFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'resource', label: 'Resource', required: true, onlyOnCreate: true, render: (p) => <ResourcePicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'datetime', name: 'start_time', label: 'Starts', required: true },
  { kind: 'datetime', name: 'end_time', label: 'Ends', required: true },
  { kind: 'select', name: 'status', label: 'Status', options: options(BOOKING_STATUSES), initial: 'Booked' },
  { kind: 'textarea', name: 'notes', label: 'Notes' },
];

export const bookingFormConfig: DirectoryFormConfig<Booking> = {
  noun: 'booking',
  basePath: '/scheduling/bookings',
  queryKey: bookingsApi.keys.lists(),
  fields: bookingFormFields,
  get: bookingsApi.get,
  create: (input) => bookingsApi.create(input as never),
  update: (id, patch) => bookingsApi.update(id, patch as never),
  afterSavePath: () => '/scheduling/bookings',
};

// -------------------------------------------------------------------------------------------- leave

export function useLeavesListConfig(): DirectoryListConfig<Leave> {
  const canApprove = useCan('schedule.approve');
  const rowActions = (row: Leave): RowAction[] =>
    canApprove
      ? leaveActionsFrom(row.status).map((a) => ({
          label: a.label,
          confirm: a.confirm,
          destructive: a.destructive,
          askText: a.ask,
          run: (_date?: string, text?: string) => (a.action === 'approve' ? leavesApi.approve(row.id) : leavesApi.reject(row.id, text ?? '')),
        }))
      : [];
  return {
    title: 'Leave',
    noun: 'leave request',
    subtitle: 'Time off. A request starts Pending and is decided by someone with approval rights, never by the person it is for. Days count the working days of the person’s calendar.',
    queryKey: leavesApi.keys.lists(),
    fetchPage: withClientFilters(leavesApi.list, {
      status: (row, value) => row.status === value,
      resource_id: (row, value) => row.resource === value,
      leave_type: (row, value) => row.leave_type === value,
    }),
    remove: leavesApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'schedule.delete',
    createPermission: 'schedule.create',
    // Filing and editing one's own leave needs only schedule.create; the server decides whose it is.
    managePermission: 'schedule.create',
    canEdit: (row) => isLeaveEditable(row.status),
    canRemove: () => true,
    rowActions,
    rowName: (row) => `${row.resource_code} ${row.start_date}`,
    defaultOrdering: '-start_date',
    searchPlaceholder: 'Search resource name or code',
    basePath: '/scheduling/leaves',
    rowLink: () => null,
    filters: [{ key: 'status', label: 'Status', options: options(LEAVE_STATUSES) }, resourceFilter, { key: 'leave_type', label: 'Type', options: options(LEAVE_TYPES) }],
    columns: [
      { header: 'Person', cell: (row) => `${row.resource_code} · ${row.resource_name}` },
      { header: 'Type', cell: (row) => row.leave_type_display || row.leave_type },
      { header: 'From', cell: (row) => formatDay(row.start_date), sortField: 'start_date' },
      { header: 'To', cell: (row) => formatDay(row.end_date) },
      { header: 'Working days', cell: (row) => row.total_days },
      { header: 'Reason', cell: (row) => row.reason || '—' },
      { header: 'Status', cell: (row) => <Badge variant={leaveStatusVariant(row.status)}>{row.status}</Badge> },
    ],
  };
}

export const leaveFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'resource', label: 'Person', onlyOnCreate: true, render: (p) => <ResourcePicker label="Person" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} />, },
  { kind: 'select', name: 'leave_type', label: 'Type', options: options(LEAVE_TYPES), initial: 'Vacation' },
  { kind: 'date', name: 'start_date', label: 'From', required: true },
  { kind: 'date', name: 'end_date', label: 'To', required: true },
  { kind: 'textarea', name: 'reason', label: 'Reason', hint: 'Only you and the people who decide leave can read it.' },
];

export const leaveFormConfig: DirectoryFormConfig<Leave> = {
  noun: 'leave request',
  basePath: '/scheduling/leaves',
  queryKey: leavesApi.keys.lists(),
  fields: leaveFormFields,
  get: leavesApi.get,
  create: (input) => leavesApi.create(input as never),
  update: (id, patch) => leavesApi.update(id, patch as never),
  afterSavePath: () => '/scheduling/leaves',
};

// -------------------------------------------------------------------------------------------- holidays

export function useHolidaysListConfig(): DirectoryListConfig<Holiday> {
  return {
    title: 'Holidays',
    noun: 'holiday',
    subtitle: 'Days off for a work calendar. A paid or unpaid holiday is not a working day; an optional one still is.',
    queryKey: holidaysApi.keys.lists(),
    fetchPage: holidaysApi.list,
    remove: holidaysApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'schedule.manage',
    createPermission: 'schedule.manage',
    managePermission: 'schedule.manage',
    rowName: (row) => row.name,
    defaultOrdering: 'holiday_date',
    searchPlaceholder: 'Search name, description',
    basePath: '/scheduling/holidays',
    rowLink: () => null,
    filters: [{ key: 'calendar_id', label: 'Calendar', optionsFrom: { queryKey: calendarsApi.keys.all, fetchPage: calendarsApi.list as never, getLabel: ((c: { name: string }) => c.name) as never } }],
    columns: [
      { header: 'Date', cell: (row) => formatDay(row.holiday_date), sortField: 'holiday_date' },
      { header: 'Holiday', cell: (row) => row.name },
      { header: 'Calendar', cell: (row) => row.calendar_name },
      { header: 'Paid', cell: (row) => (row.is_paid ? 'Paid' : 'Unpaid') },
      { header: 'Optional', cell: (row) => (row.is_optional ? <Badge variant="neutral">Optional</Badge> : '—') },
    ],
  };
}

export const holidayFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'date', name: 'holiday_date', label: 'Date', required: true },
  { kind: 'entity', name: 'calendar_id', rowKey: 'calendar', label: 'Calendar', render: (p) => <CalendarPicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} />, },
  { kind: 'checkbox', name: 'is_paid', label: 'Paid', initial: true },
  { kind: 'checkbox', name: 'is_optional', label: 'Optional (still a working day)' },
  { kind: 'textarea', name: 'description', label: 'Description' },
];

export const holidayFormConfig: DirectoryFormConfig<Holiday> = {
  noun: 'holiday',
  basePath: '/scheduling/holidays',
  queryKey: holidaysApi.keys.lists(),
  fields: holidayFormFields,
  get: holidaysApi.get,
  create: (input) => holidaysApi.create(input as never),
  update: (id, patch) => holidaysApi.update(id, patch as never),
  afterSavePath: () => '/scheduling/holidays',
};

// -------------------------------------------------------------------------------------------- work calendars

export function useCalendarsListConfig(): DirectoryListConfig<WorkCalendar> {
  return {
    title: 'Work calendars',
    noun: 'work calendar',
    subtitle: 'A time zone, a working week and holidays. A resource follows its own calendar, or the default one.',
    queryKey: calendarsApi.keys.lists(),
    fetchPage: calendarsApi.list,
    remove: calendarsApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'schedule.manage',
    createPermission: 'schedule.manage',
    managePermission: 'schedule.manage',
    // The default calendar, and one a resource or holiday uses, cannot be deleted (409 calendar_in_use).
    canRemove: isCalendarDeletable,
    rowActions: (row) => (row.is_default ? [] : [{ label: 'Make default', confirm: `Make ${row.name} the default calendar? Resources without a calendar and new holidays will follow it.`, run: () => calendarsApi.setDefault(row.id) }]),
    rowName: (row) => row.name,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search code, name',
    basePath: '/scheduling/calendars',
    rowLink: () => null,
    columns: [
      { header: 'Calendar', cell: (row) => `${row.code} · ${row.name}`, sortField: 'name' },
      { header: 'Time zone', cell: (row) => row.time_zone },
      { header: 'Working days', cell: (row) => weekdayNames(row.working_weekdays) },
      { header: 'Hours/day', cell: (row) => row.hours_per_day },
      { header: 'Office', cell: (row) => row.office_name || '—' },
      { header: 'Resources', cell: (row) => row.resource_count },
      { header: 'Default', cell: (row) => (row.is_default ? <Badge variant="info">Default</Badge> : '—') },
    ],
  };
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const weekdayNames = (days: number[]) => [...days].sort((a, b) => a - b).map((d) => DAY_NAMES[d - 1] ?? d).join(' ');

export const calendarFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50, hint: 'Unique, in any case.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'text', name: 'time_zone', label: 'Time zone', maxLength: 64, initial: 'UTC', hint: 'An IANA name such as Europe/London.' },
  { kind: 'json', name: 'working_weekdays', label: 'Working weekdays', shape: 'array', hint: 'ISO weekdays, 1 is Monday: [1,2,3,4,5].' },
  { kind: 'text', name: 'hours_per_day', label: 'Hours per day', hint: 'Up to 24, e.g. 7.5.' },
  { kind: 'entity', name: 'office_id', rowKey: 'office', label: 'Office', render: (p) => <OfficePicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'checkbox', name: 'is_default', label: 'The default calendar' },
];

export const calendarFormConfig: DirectoryFormConfig<WorkCalendar> = {
  noun: 'work calendar',
  basePath: '/scheduling/calendars',
  queryKey: calendarsApi.keys.lists(),
  fields: calendarFormFields,
  get: calendarsApi.get,
  create: (input) => calendarsApi.create(input as never),
  update: (id, patch) => calendarsApi.update(id, patch as never),
  afterSavePath: () => '/scheduling/calendars',
};

// -------------------------------------------------------------------------------------------- milestones

export function useMilestonesListConfig(scope?: { projectId: string }): DirectoryListConfig<Milestone> {
  const rowActions = (row: Milestone): RowAction[] =>
    milestoneActionsFrom(row.status).map((a) => ({ label: a.label, confirm: a.confirm, run: () => (a.action === 'complete' ? milestonesApi.complete(row.id) : milestonesApi.reopen(row.id)) }));
  return {
    title: 'Milestones',
    noun: 'milestone',
    subtitle: 'Dates a project is held to. Completing and reopening are their own actions; a delivery milestone points at a delivery.',
    queryKey: milestonesApi.keys.lists(),
    // The project filter by id is the one the server honours; status and kind are narrowed here (CR-25).
    fetchPage: withClientFilters(milestonesApi.list, {
      status: (row, value) => row.status === value,
      kind: (row, value) => row.kind === value,
    }),
    remove: milestonesApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'schedule.delete',
    createPermission: 'schedule.manage',
    managePermission: 'schedule.manage',
    rowActions,
    rowName: (row) => row.name,
    defaultOrdering: 'due_date',
    searchPlaceholder: 'Search name',
    basePath: '/scheduling/milestones',
    rowLink: () => null,
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project_id=${scope.projectId}` : undefined,
    filters: [...(scope ? [] : [projectFilter]), { key: 'status', label: 'Status', options: options(MILESTONE_STATUSES) }, { key: 'kind', label: 'Kind', options: options(MILESTONE_KINDS) }],
    columns: [
      { header: 'Milestone', cell: (row) => row.name, sortField: 'name' },
      ...(scope ? [] : [{ header: 'Project', cell: (row: Milestone) => `${row.project_code} · ${row.project_name}` }]),
      { header: 'Due', cell: (row) => formatDay(row.due_date), sortField: 'due_date' },
      { header: 'Kind', cell: (row) => row.kind },
      { header: 'Status', cell: (row) => <Badge variant={milestoneStatusVariant(row.status)}>{row.status}</Badge> },
      { header: 'Completed', cell: (row) => (row.completed_at ? formatMoment(row.completed_at) : '—') },
    ],
  };
}

export const milestoneFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project_id', rowKey: 'project', label: 'Project', required: true, onlyOnCreate: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255, hint: 'Unique within the project, in any case.' },
  { kind: 'date', name: 'due_date', label: 'Due', required: true },
  { kind: 'number', name: 'order', label: 'Order', hint: 'Where it shows among the project’s milestones.' },
  { kind: 'select', name: 'kind', label: 'Kind', options: options(MILESTONE_KINDS), initial: 'general' },
  { kind: 'text', name: 'delivery_package_id', label: 'Delivery id', visibleWhen: (v) => v.kind === 'delivery', hint: 'A delivery milestone needs the id of one of the project’s deliveries.' },
  { kind: 'textarea', name: 'notes', label: 'Notes' },
];

export const milestoneFormConfig: DirectoryFormConfig<Milestone> = {
  noun: 'milestone',
  basePath: '/scheduling/milestones',
  queryKey: milestonesApi.keys.lists(),
  fields: milestoneFormFields,
  get: milestonesApi.get,
  create: (input) => milestonesApi.create(input as never),
  update: (id, patch) => milestonesApi.update(id, patch as never),
  afterSavePath: () => '/scheduling/milestones',
};

// -------------------------------------------------------------------------------------------- events

export function useEventsListConfig(scope?: { projectName: string }): DirectoryListConfig<CalendarEventRow> {
  const canUpdate = useCan('schedule.update');
  const rowActions = (row: CalendarEventRow): RowAction[] =>
    canUpdate
      ? EVENT_STATUSES.filter((s) => s !== row.status).map((status) => ({ label: `Mark ${status}`, confirm: `Mark “${row.title}” ${status}?`, run: () => eventsApi.updateStatus(row.id, status) }))
      : [];
  return {
    title: 'Events',
    noun: 'event',
    subtitle: 'Meetings, deadlines, reviews and work blocks. Private events are seen by their owner only.',
    queryKey: eventsApi.keys.lists(),
    fetchPage: withClientFilters(eventsApi.list, {
      event_type: (row, value) => row.event_type === value,
      status: (row, value) => row.status === value,
      visibility: (row, value) => row.visibility === value,
      // The row has the project's name but not its id (CR-25).
      project_name: (row, value) => row.project_name === value,
    }),
    remove: eventsApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'schedule.delete',
    // Anyone with schedule.create makes an event; changing or deleting one needs schedule.update / delete.
    createPermission: 'schedule.create',
    managePermission: 'schedule.update',
    rowActions,
    rowName: (row) => row.title,
    defaultOrdering: 'start_time',
    searchPlaceholder: 'Search title, description, location',
    basePath: '/scheduling/events',
    rowLink: () => null,
    scope: scope ? { project_name: scope.projectName } : undefined,
    filters: [
      { key: 'event_type', label: 'Type', options: options(EVENT_TYPES) },
      { key: 'status', label: 'Status', options: options(EVENT_STATUSES) },
      { key: 'visibility', label: 'Visibility', options: options(EVENT_VISIBILITIES) },
    ],
    columns: [
      { header: 'Event', cell: (row) => row.title, sortField: 'start_time' },
      { header: 'When', cell: (row) => (row.is_all_day ? `${formatMoment(row.start_time)} (all day)` : formatRange(row.start_time, row.end_time)) },
      { header: 'Type', cell: (row) => row.event_type_display || row.event_type },
      ...(scope ? [] : [{ header: 'Project', cell: (row: CalendarEventRow) => row.project_name || '—' }]),
      { header: 'Where', cell: (row) => row.location || '—' },
      { header: 'Status', cell: (row) => <Badge variant={eventStatusVariant(row.status)}>{row.status}</Badge> },
    ],
  };
}

export const eventFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'title', label: 'Title', required: true, maxLength: 255 },
  { kind: 'select', name: 'event_type', label: 'Type', options: options(EVENT_TYPES), initial: 'Meeting', onlyOnCreate: true },
  { kind: 'datetime', name: 'start_time', label: 'Starts', required: true },
  { kind: 'datetime', name: 'end_time', label: 'Ends', required: true },
  { kind: 'checkbox', name: 'is_all_day', label: 'All day' },
  { kind: 'select', name: 'visibility', label: 'Visibility', options: options(EVENT_VISIBILITIES), initial: 'Team' },
  { kind: 'select', name: 'status', label: 'Status', options: options(EVENT_STATUSES), initial: 'Scheduled' },
  { kind: 'entity', name: 'project_id', rowKey: 'project', label: 'Project', onlyOnCreate: true, render: (p) => <ProjectPicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'location', label: 'Location', maxLength: 255 },
  { kind: 'url', name: 'meeting_url', label: 'Meeting link' },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'textarea', name: 'notes', label: 'Notes' },
];

export const eventFormConfig: DirectoryFormConfig<CalendarEvent> = {
  noun: 'event',
  basePath: '/scheduling/events',
  queryKey: eventsApi.keys.lists(),
  fields: eventFormFields,
  get: eventsApi.get,
  create: (input) => eventsApi.create(input as never) as unknown as Promise<CalendarEvent>,
  update: (id, patch) => eventsApi.update(id, patch as never) as unknown as Promise<CalendarEvent>,
  afterSavePath: () => '/scheduling/events',
};
