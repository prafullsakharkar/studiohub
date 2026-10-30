/**
 * Exhaustive field lists for the hand-written row types in `scheduling.ts`. They live here, outside `__tests__`,
 * because tsconfig excludes tests from `tsc`: `Record<keyof T, true>` only fails to compile when this file is
 * compiled. The tests then compare these lists with the captured responses.
 */
import type { Booking, CalendarEvent, CalendarEventRow, CapacitySummary, Holiday, Leave, Milestone, OverbookingAlert, Resource, ResourceRow, WorkCalendar } from './scheduling';

export const RESOURCEROW_KEYS: Record<keyof ResourceRow, true> = { calendar: true, calendar_name: true, capacity_hours_per_week: true, code: true, created_at: true, department: true, department_name: true, hourly_rate_usd: true, id: true, location: true, name: true, resource_type: true, resource_type_display: true, status: true, status_display: true, team: true, team_name: true, updated_at: true, user: true, user_email: true };
/** Keys that are absent (not null) when the resource has no department or team. */
export const RESOURCE_OPTIONAL_KEYS = ['department_name', 'team_name'] as const;
export const RESOURCE_KEYS: Record<keyof Resource, true> = { calendar: true, calendar_name: true, capacity_hours_per_week: true, code: true, created_at: true, department: true, department_name: true, hourly_rate_usd: true, id: true, location: true, metadata: true, name: true, resource_type: true, resource_type_display: true, status: true, status_display: true, team: true, team_name: true, updated_at: true, user: true, user_email: true };
export const BOOKING_KEYS: Record<keyof Booking, true> = { created_at: true, end_time: true, event: true, id: true, notes: true, resource: true, resource_code: true, resource_name: true, start_time: true, status: true, task: true, updated_at: true };
export const LEAVE_KEYS: Record<keyof Leave, true> = { approved_at: true, approved_by: true, created_at: true, end_date: true, id: true, leave_type: true, leave_type_display: true, reason: true, rejected_at: true, rejected_by: true, rejection_reason: true, resource: true, resource_code: true, resource_name: true, start_date: true, status: true, status_display: true, total_days: true, updated_at: true };
export const HOLIDAY_KEYS: Record<keyof Holiday, true> = { calendar: true, calendar_name: true, created_at: true, description: true, holiday_date: true, id: true, is_optional: true, is_paid: true, name: true, updated_at: true };
export const WORKCALENDAR_KEYS: Record<keyof WorkCalendar, true> = { code: true, created_at: true, hours_per_day: true, id: true, is_default: true, name: true, office: true, office_name: true, resource_count: true, time_zone: true, updated_at: true, working_weekdays: true };
export const MILESTONE_KEYS: Record<keyof Milestone, true> = { completed_at: true, completed_by: true, created_at: true, delivery_package_id: true, due_date: true, id: true, kind: true, name: true, notes: true, order: true, project: true, project_code: true, project_name: true, status: true, updated_at: true };
export const EVENTROW_KEYS: Record<keyof CalendarEventRow, true> = { created_at: true, description: true, end_time: true, event_type: true, event_type_display: true, id: true, is_all_day: true, location: true, meeting_url: true, project_id: true, project_name: true, start_time: true, status: true, status_display: true, title: true, updated_at: true, visibility: true, visibility_display: true };
const { project_id: _rowOnly, ...EVENTROW_SHARED } = EVENTROW_KEYS;
export const EVENT_KEYS: Record<keyof CalendarEvent, true> = { ...EVENTROW_SHARED, metadata: true, notes: true, project: true };
export const CAPACITY_KEYS: Record<keyof CapacitySummary, true> = { allocated_hours: true, department: true, free_hours: true, overbooked_count: true, total_capacity_hours: true, total_resources: true, utilization_pct: true };
export const OVERBOOKING_KEYS: Record<keyof OverbookingAlert, true> = { conflicting_events: true, date: true, department: true, excess_hours: true, id: true, max_capacity_hours: true, resource_id: true, resource_name: true, resource_type: true, scheduled_hours: true, suggested_resolution: true };
