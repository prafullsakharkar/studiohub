import { apiClient } from '@/api/client/ApiClient';
import { resourceApi } from '@/api/masterdata/resource';

/**
 * Scheduling: resources, bookings ("schedules"), leave, holidays, work calendars, milestones, events and the
 * capacity figures. Row types are pinned to docs/sync/samples/scheduling/_flow.json (see
 * backend-change-requests.md, "Phase 10 findings"; the backend's own contracts are docs/scheduling/CONTRACTS.md).
 *
 * Rules the capture established:
 *  - every list is a bare array (one page), and the server filters almost nothing (CR-25): only `search`,
 *    `ordering`, bookings `start`/`end`, holidays `calendar_id` and milestones `project_id` (a uuid) work, so the
 *    screens narrow the array in the browser (`narrow` in `schedulingFlow.ts`);
 *  - date-times carry a zone (`Z` or an offset), a naive one is a 400; leave, holidays and milestones use plain days;
 *  - a pay rate (`hourly_rate_usd`) and the user's e-mail are `null` / "" unless the caller holds
 *    `schedule.view_rates` or the resource is their own;
 *  - a resource's `status` is derived: "On Leave" while an approved leave covers today, and it cannot be written;
 *  - leave starts Pending and moves only through `approve` / `reject`; milestones through `complete` / `reopen`;
 *  - a create answers with the fields that were sent (plus `id`), not the full row: read the row again.
 */
const V1 = '/api/v1/scheduling';

export const RESOURCE_TYPES = ['Person', 'Equipment', 'Room', 'Studio'] as const;
export const RESOURCE_STATUSES = ['Active', 'On Leave', 'Unavailable'] as const;
/** What a caller may write: "On Leave" is shown, never set. */
export const WRITABLE_RESOURCE_STATUSES = ['Active', 'Unavailable'] as const;
export const BOOKING_STATUSES = ['Booked', 'Available', 'Blocked', 'Overbooked'] as const;
export const LEAVE_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'Unpaid', 'Parental', 'Bereavement', 'Other'] as const;
export const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const;
export const EVENT_TYPES = ['Meeting', 'Deadline', 'Milestone', 'Review Session', 'Holiday', 'Leave', 'Work Block'] as const;
export const EVENT_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Postponed'] as const;
export const EVENT_VISIBILITIES = ['Private', 'Team', 'Organization', 'Public'] as const;
export const MILESTONE_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;
export const MILESTONE_KINDS = ['general', 'delivery'] as const;
/** ISO weekdays: 1 is Monday. */
export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const;

// ------------------------------------------------------------------------------------------------ resources

export interface ResourceRow {
  id: string;
  name: string;
  code: string;
  resource_type: string;
  resource_type_display: string;
  /** Derived: "On Leave" while an approved leave covers today. */
  status: string;
  status_display: string;
  department: string | null;
  /** Absent when the resource has no department. */
  department_name?: string;
  team: string | null;
  /** Absent when the resource has no team. */
  team_name?: string;
  user: string | null;
  /** "" without `schedule.view_rates` (unless it is the caller's own resource). */
  user_email: string | null;
  capacity_hours_per_week: number;
  /** A decimal string; `null` without `schedule.view_rates` (unless it is the caller's own resource). */
  hourly_rate_usd: string | null;
  location: string;
  calendar: string | null;
  calendar_name: string;
  created_at: string;
  updated_at: string;
}

export interface Resource extends Omit<ResourceRow, 'department' | 'team'> {
  department?: string;
  team?: string;
  metadata: Record<string, unknown>;
}

export interface ResourceInput {
  name: string;
  code: string;
  resource_type?: string;
  /** Active or Unavailable; "On Leave" is a 400. */
  status?: string;
  department_id?: string | null;
  team_id?: string | null;
  user_id?: string | null;
  calendar_id?: string | null;
  capacity_hours_per_week?: number;
  hourly_rate_usd?: string;
  location?: string;
}

// ------------------------------------------------------------------------------------------------ bookings

export interface Booking {
  id: string;
  resource: string;
  resource_name: string;
  resource_code: string;
  start_time: string;
  end_time: string;
  status: string;
  event: string | null;
  task: string | null;
  /** "" for a booking outside the caller's projects. */
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BookingInput {
  resource: string;
  start_time: string;
  end_time: string;
  status?: string;
  event?: string | null;
  task?: string | null;
  notes?: string;
}

export interface BulkDeleteResult {
  success: boolean;
  succeeded_count: number;
  failed_count: number;
  results: Array<{ id: string; ok: boolean; error: string | null }>;
}

// ------------------------------------------------------------------------------------------------ leave

export interface Leave {
  id: string;
  resource: string;
  resource_name: string;
  resource_code: string;
  leave_type: string;
  leave_type_display: string;
  status: string;
  status_display: string;
  start_date: string;
  end_date: string;
  /** Working days of the resource's calendar, computed by the server. */
  total_days: number;
  /** "" unless the caller is the person or an approver. */
  reason: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveInput {
  resource?: string;
  leave_type?: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

// ------------------------------------------------------------------------------------------------ holidays, calendars

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  calendar: string;
  calendar_name: string;
  is_paid: boolean;
  is_optional: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}
export interface HolidayInput {
  name: string;
  holiday_date: string;
  /** The default calendar when omitted. */
  calendar_id?: string;
  is_paid?: boolean;
  is_optional?: boolean;
  description?: string;
}

export interface WorkCalendar {
  id: string;
  code: string;
  name: string;
  time_zone: string;
  office: string | null;
  office_name: string;
  working_weekdays: number[];
  /** A decimal string. */
  hours_per_day: string;
  is_default: boolean;
  resource_count: number;
  created_at: string;
  updated_at: string;
}
export interface WorkCalendarInput {
  code: string;
  name: string;
  time_zone?: string;
  office_id?: string | null;
  working_weekdays?: number[];
  hours_per_day?: string;
  is_default?: boolean;
}

// ------------------------------------------------------------------------------------------------ milestones

export interface Milestone {
  id: string;
  project: string;
  project_code: string;
  project_name: string;
  name: string;
  due_date: string;
  status: string;
  order: number;
  kind: string;
  delivery_package_id: string | null;
  notes: string;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface MilestoneInput {
  /** An id or a code; cannot change after creation. */
  project_id: string;
  name: string;
  due_date: string;
  order?: number;
  kind?: string;
  delivery_package_id?: string | null;
  notes?: string;
}

// ------------------------------------------------------------------------------------------------ events

export interface CalendarEventRow {
  id: string;
  title: string;
  description: string;
  event_type: string;
  event_type_display: string;
  status: string;
  status_display: string;
  visibility: string;
  visibility_display: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string;
  meeting_url: string;
  /** The row has the project's name but not its id (CR-25); the detail has both. */
  project_name: string;
  created_at: string;
  updated_at: string;
}
export interface CalendarEvent extends CalendarEventRow {
  project: string | null;
  notes: string;
  metadata: Record<string, unknown>;
}
export interface CalendarEventInput {
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  event_type?: string;
  /** Scheduled when omitted; `PATCH` takes it too, as does `update-status`. */
  status?: string;
  visibility?: string;
  project_id?: string | null;
  location?: string;
  meeting_url?: string;
  is_all_day?: boolean;
  notes?: string;
}

// ------------------------------------------------------------------------------------------------ capacity

/** The current week, one row per department. */
export interface CapacitySummary {
  department: string;
  total_resources: number;
  total_capacity_hours: number;
  allocated_hours: number;
  free_hours: number;
  utilization_pct: number;
  overbooked_count: number;
}

export interface OverbookingAlert {
  id: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  department: string | null;
  /** The Monday of the week. */
  date: string;
  max_capacity_hours: number;
  scheduled_hours: number;
  excess_hours: number;
  suggested_resolution: string;
  conflicting_events: Array<{ id: string; title: string; event_type: string; hours: number; project_code: string | null }>;
}

export interface ResolveResult {
  success: boolean;
  message: string;
}

// -------------------------------------------------------------------------------------------- the API

const act = <T>(path: string, id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<T>(`${V1}/${path}/${id}/${action}/`, body);

export const resourcesApi = {
  ...resourceApi<ResourceRow, ResourceInput>('scheduling-resources', `${V1}/resources/`),
  get: (id: string, signal?: AbortSignal) => apiClient.get<Resource>(`${V1}/resources/${id}/`, { signal }),
  /** Overlap with a Booked, Blocked or Overbooked slot of the resource is a 409 `booking_overlap`. */
  book: (id: string, input: { start_time: string; end_time: string; status?: string; notes?: string }) => act<Booking>('resources', id, 'book', input),
  block: (id: string, input: { start_time: string; end_time: string; reason?: string }) => act<Booking>('resources', id, 'block', input),
};

export const bookingsApi = {
  ...resourceApi<Booking, BookingInput>('scheduling-bookings', `${V1}/schedules/`),
  /** Up to 100 ids; 200 when all went, 207 otherwise. */
  bulkDelete: (ids: string[]) => apiClient.post<BulkDeleteResult>(`${V1}/schedules/bulk-delete/`, { ids }),
};

export const leavesApi = {
  ...resourceApi<Leave, LeaveInput>('scheduling-leaves', `${V1}/leaves/`),
  /** Needs `schedule.approve`; nobody decides their own leave. */
  approve: (id: string) => act<Leave>('leaves', id, 'approve'),
  reject: (id: string, rejection_reason: string) => act<Leave>('leaves', id, 'reject', { rejection_reason }),
};

export const holidaysApi = resourceApi<Holiday, HolidayInput>('scheduling-holidays', `${V1}/holidays/`);

export const calendarsApi = {
  ...resourceApi<WorkCalendar, WorkCalendarInput>('scheduling-calendars', `${V1}/calendars/`),
  setDefault: (id: string) => act<WorkCalendar>('calendars', id, 'set-default'),
};

export const milestonesApi = {
  ...resourceApi<Milestone, MilestoneInput>('scheduling-milestones', `${V1}/milestones/`),
  update: (id: string, patch: Partial<Omit<MilestoneInput, 'project_id'>>) => apiClient.patch<Milestone>(`${V1}/milestones/${id}/`, patch),
  complete: (id: string) => act<Milestone>('milestones', id, 'complete'),
  /** Back to In Progress. */
  reopen: (id: string) => act<Milestone>('milestones', id, 'reopen'),
};

export const eventsApi = {
  ...resourceApi<CalendarEventRow, CalendarEventInput>('scheduling-events', `${V1}/events/`),
  get: (id: string, signal?: AbortSignal) => apiClient.get<CalendarEvent>(`${V1}/events/${id}/`, { signal }),
  /** Needs `schedule.update` (an artist who created the event cannot change it). */
  updateStatus: (id: string, status: string) => act<CalendarEvent>('events', id, 'update-status', { status }),
};

export const capacityApi = {
  keys: { all: ['scheduling-capacity'] as const, overbooking: ['scheduling-overbooking'] as const },
  summary: (signal?: AbortSignal) => apiClient.get<CapacitySummary[]>(`${V1}/capacity/`, { signal }),
  overbooking: (signal?: AbortSignal) => apiClient.get<OverbookingAlert[]>(`${V1}/overbooking/`, { signal }),
  /** Flags the week's bookings Overbooked; the alert stays until the hours are fixed. Needs `schedule.update`. */
  resolve: (alert_id: string, resource_id?: string) => apiClient.post<ResolveResult>(`${V1}/resolve-overbooking/`, resource_id ? { alert_id, resource_id } : { alert_id }),
};
