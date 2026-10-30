import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { BOOKING_STATUSES, EVENT_STATUSES, EVENT_TYPES, EVENT_VISIBILITIES, LEAVE_TYPES, MILESTONE_KINDS, MILESTONE_STATUSES, RESOURCE_TYPES, WRITABLE_RESOURCE_STATUSES } from '../scheduling';
import { isCalendarDeletable, isLeaveEditable, LEAVE_ACTIONS, leaveActionsFrom, MILESTONE_ACTIONS, milestoneActionsFrom, occupiesTime } from '../schedulingFlow';
import * as K from '../schedulingRowKeys';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('scheduling/_flow.json');
const keys = (o: object) => Object.keys(o).sort();
/** A bare-array body is stored as `{_bare_list, _len, items}`; `_len` is the real length. */
const items = (key: string): any[] => flow[key].body.items ?? flow[key].body;
const count = (key: string): number => flow[key].body._len ?? flow[key].body.length;
const without = (list: readonly string[], drop: readonly string[]) => list.filter((k) => !drop.includes(k));

describe('row types match the captured responses', () => {
  it.each([
    ['ResourceRow', items('resources_list')[0], K.RESOURCEROW_KEYS, []],
    ['Resource (the detail)', flow.resources_detail.body, K.RESOURCE_KEYS, ['team', 'team_name']],
    ['Booking', flow.schedules_detail.body, K.BOOKING_KEYS, []],
    ['Leave', flow.leaves_detail_manager.body, K.LEAVE_KEYS, []],
    ['Holiday', flow.holidays_detail.body, K.HOLIDAY_KEYS, []],
    ['WorkCalendar', flow.calendars_detail.body, K.WORKCALENDAR_KEYS, []],
    ['Milestone', flow.milestones_detail.body, K.MILESTONE_KEYS, []],
    ['CalendarEventRow', items('events_list')[0], K.EVENTROW_KEYS, []],
    ['CalendarEvent (the detail)', flow.events_detail.body, K.EVENT_KEYS, []],
    ['CapacitySummary', items('capacity_get_over')[0], K.CAPACITY_KEYS, []],
    ['OverbookingAlert', items('overbooking_get')[0], K.OVERBOOKING_KEYS, []],
  ] as const)('%s', (_label, row, expected, absent) => {
    // A department or team the resource lacks is an absent key, not a null one.
    expect(keys(row)).toEqual(without(keys(expected), [...K.RESOURCE_OPTIONAL_KEYS, ...absent].filter((k) => !(k in row) && k in expected)));
  });

  it('a resource with a department and no team has department_name but not team_name', () => {
    const row = items('resources_list')[0];
    expect(row.department_name).toBe('Scheduling Comp');
    expect(row).toHaveProperty('team', null);
    expect(row).not.toHaveProperty('team_name');
  });
});

describe('the closed lists the forms offer', () => {
  it('event types, statuses and visibilities are the ones the API accepts', () => {
    expect(EVENT_TYPES).toContain(flow.events_create.body.event_type ?? 'Review Session');
    expect(flow.events_create_bad_type.body.event_type[0]).toMatch(/not a valid choice/);
    expect(flow.events_patch_bad_status.body.status[0]).toMatch(/not a valid choice/);
    expect(EVENT_STATUSES).toContain(flow.events_update_status.body.status);
    expect(EVENT_VISIBILITIES).toContain(flow.events_detail.body.visibility);
  });
  it('leave types, milestone kinds and statuses, booking statuses and resource types are the ones the API accepts', () => {
    expect(flow.leaves_create_bad_type.body.leave_type[0]).toMatch(/not a valid choice/);
    expect(LEAVE_TYPES).toContain(flow.leaves_detail_manager.body.leave_type);
    expect(flow.milestones_create_bad_kind.body.kind[0]).toMatch(/not a valid choice/);
    expect(MILESTONE_KINDS).toContain(flow.milestones_detail.body.kind);
    expect(MILESTONE_STATUSES).toContain(flow.milestones_detail.body.status);
    expect(flow.schedules_create_bad_status.body.status[0]).toMatch(/not a valid choice/);
    expect(BOOKING_STATUSES).toContain(flow.schedules_detail.body.status);
    expect(flow.resources_create_bad_type.body.resource_type[0]).toMatch(/not a valid choice/);
    expect(RESOURCE_TYPES).toContain(flow.resources_detail.body.resource_type);
  });
  it('"On Leave" is shown, never written', () => {
    expect(flow.resources_create_on_leave.status).toBe(400);
    expect(flow.resources_patch_on_leave.status).toBe(400);
    expect(WRITABLE_RESOURCE_STATUSES).not.toContain('On Leave');
    expect(flow.resources_patch_unavailable.body.status).toBe('Unavailable');
  });
});

describe('resources', () => {
  it('a rate is hidden from whoever lacks schedule.view_rates, unless the resource is their own', () => {
    const rate = (key: string, code: string) => items(key).find((r) => r.code === code)?.hourly_rate_usd;
    expect(rate('resources_list', 'ALICE')).toBe('55.00');
    expect(rate('resources_list_supervisor', 'BOB')).toBe('70.00');
    expect(rate('resources_list_lead', 'ALICE')).toBeNull();
    expect(rate('resources_list_lead', 'BOB')).toBe('70.00'); // the lead's own resource
    expect(rate('resources_list_artist', 'ALICE')).toBe('55.00');
    expect(rate('resources_list_artist', 'BOB')).toBeNull();
    expect(items('resources_list_lead').find((r) => r.code === 'ALICE').user_email).toBe('');
  });
  it('ordering by rate is honoured only with the code', () => {
    expect(items('resources_order_rate_admin').slice(0, 2).map((r) => r.code)).toEqual(['BOB', 'ALICE']);
    expect(items('resources_order_rate_artist').slice(0, 2).map((r) => r.code)).not.toEqual(['BOB', 'ALICE']);
  });
  it('the list filters by type, status (as shown, so On Leave follows approved leave), calendar and department (CR-25)', () => {
    const all = count('resources_baseline');
    expect(count('resources_by_resource_type')).toBeLessThan(all);
    expect(count('resources_by_status_on_leave')).toBe(1);
    expect(count('resources_by_status_unavailable')).toBe(1);
    expect(count('resources_by_calendar_id')).toBeLessThan(all);
    expect(count('resources_by_nonsense')).toBe(all);
  });
  it('is created by schedule.manage only, and the create answers with the fields that were sent', () => {
    expect(flow.resources_create.status).toBe(201);
    expect(flow.resources_create_artist.status).toBe(403);
    expect(flow.resources_create_supervisor.status).toBe(201);
    expect(flow.resources_create.body).toHaveProperty('department_id');
    expect(flow.resources_create.body).not.toHaveProperty('department_name');
    expect(flow.resources_patch_artist.status).toBe(403);
  });
  it('validation sentences', () => {
    expect(flow.resources_create_duplicate.body.code).toEqual(['A resource with this code already exists.']);
    expect(flow.resources_create_negative_rate.body.hourly_rate_usd[0]).toMatch(/greater than or equal to 0/);
    expect(flow.resources_create_unknown_user.body.user_id).toEqual(['Unknown user.']);
    expect(flow.resources_create_unknown_calendar.body.calendar_id).toEqual(['Unknown calendar.']);
  });
  it('deleting a resource that has bookings succeeds (it is archived)', () => {
    expect(flow.resources_delete_with_bookings.status).toBe(204);
  });
});

describe('bookings', () => {
  it('overlap is a 409 that names the other booking; adjacent and Available slots are fine', () => {
    expect(flow.schedules_create_overlap.status).toBe(409);
    expect(flow.schedules_create_overlap.body.detail).toMatch(/already taken by booking/);
    expect(flow.resources_book_overlap.status).toBe(409);
    expect(flow.resources_block_overlap.status).toBe(409);
    expect(flow.schedules_patch_into_overlap.status).toBe(409);
    expect(flow.schedules_create_adjacent.status).toBe(201);
    expect(flow.schedules_create_available_overlap.status).toBe(201);
    expect(occupiesTime('Available')).toBe(false);
    expect(occupiesTime('Overbooked') && occupiesTime('Blocked') && occupiesTime('Booked')).toBe(true);
  });
  it('a date-time needs a zone and an end after the start', () => {
    expect(flow.schedules_create_naive.body.end_time[0]).toMatch(/Send the time zone too/);
    expect(flow.resources_book_naive.status).toBe(400);
    expect(flow.schedules_create_end_before_start.body.end_time).toEqual(['The end cannot be before the start.']);
    expect(flow.schedules_create_equal.body.end_time).toEqual(['The end must be after the start.']);
  });
  it('only a manager books or blocks; deleting needs schedule.delete', () => {
    expect(flow.schedules_create_artist.status).toBe(403);
    expect(flow.schedules_delete_artist.status).toBe(403);
    expect(flow.resources_book.status).toBe(201);
    expect(flow.resources_block.body.status).toBe('Blocked');
    expect(flow.resources_block.body.notes).toBe('Maintenance');
  });
  it('the list filters by resource (both spellings), status and a start/end window; a bad window names its parameter (CR-25)', () => {
    expect(count('schedules_window')).toBeLessThan(count('schedules_baseline'));
    expect(flow.schedules_window_bad.status).toBe(400);
    expect(flow.schedules_window_bad.body.start[0]).toMatch(/ISO 8601/);
    expect(flow.schedules_window_naive.body.start[0]).toMatch(/Send the time zone too/);
    expect(count('schedules_by_resource')).toBe(count('schedules_by_resource_id'));
    expect(count('schedules_by_resource')).toBeLessThan(count('schedules_baseline'));
    expect(count('schedules_by_status')).toBeLessThan(count('schedules_baseline'));
    expect(count('schedules_by_nonsense')).toBe(count('schedules_baseline')); // an unknown parameter is still ignored
  });
  it('searching finds the resource, not the notes', () => {
    expect(count('schedules_search_resource')).toBeGreaterThan(0);
    expect(count('schedules_search_notes')).toBe(0);
  });
  it('bulk delete: 400 for none, 207 with a result per id when one is missing, 403 without schedule.delete', () => {
    expect(flow.schedules_bulk_delete_empty.status).toBe(400);
    expect(flow.schedules_bulk_delete_artist.status).toBe(403);
    expect(flow.schedules_bulk_delete_partial.status).toBe(207);
    expect(flow.schedules_bulk_delete_partial.body).toMatchObject({ success: false, succeeded_count: 1, failed_count: 1 });
    expect(flow.schedules_bulk_delete_partial.body.results.map((r: any) => [r.ok, r.error])).toEqual([[true, null], [false, 'not_found']]);
    expect(flow.schedules_bulk_delete_all.status).toBe(200);
  });
  it('notes and titles of a booking outside the caller are hidden', () => {
    expect(items('schedules_list').map((b) => b.notes)).toContain('Comp shots');
  });
});

describe('leave', () => {
  it('starts Pending; an artist files it for their own resource, with or without naming it', () => {
    expect(flow.leaves_create_own.body).toMatchObject({ status: 'Pending', total_days: 9 });
    expect(flow.leaves_create_no_resource.status).toBe(201);
    expect(flow.leaves_create_no_resource.body.resource_code).toBe('ALICE');
    expect(flow.leaves_create_other.body.resource).toEqual(['Unknown resource.']);
    expect(flow.leaves_create_norole.status).toBe(403);
  });
  it('status, total days and the decision fields cannot be sent', () => {
    expect(flow.leaves_create_set_status.body.status[0]).toMatch(/Cannot be set directly/);
    expect(flow.leaves_create_total_days.body.total_days[0]).toMatch(/Cannot be set directly/);
  });
  it('validation sentences', () => {
    expect(flow.leaves_create_end_before_start.body.end_date).toEqual(['The end date cannot be before the start date.']);
    expect(flow.leaves_create_overlap.body.start_date[0]).toMatch(/already has pending leave from/);
    expect(flow.leaves_create_empty.body).toMatchObject({ start_date: ['This field is required.'], end_date: ['This field is required.'] });
  });
  it('only a pending request is edited, and only by its person or a manager', () => {
    expect(flow.leaves_patch_own_pending.status).toBe(200);
    expect(flow.leaves_patch_approved.body.status).toEqual(['Only a pending leave can be changed.']);
    expect(flow.leaves_patch_other.status).toBe(403);
    expect(flow.leaves_patch_move_resource.status).toBe(400);
    expect(isLeaveEditable('Pending') && !isLeaveEditable('Approved') && !isLeaveEditable('Rejected')).toBe(true);
  });
  it('approve and reject need schedule.approve; nobody decides their own; a pending one only', () => {
    expect(flow.leaves_approve.body.status).toBe('Approved');
    expect(flow.leaves_approve_own.status).toBe(403);
    expect(flow.leaves_approve_lead.status).toBe(403);
    expect(flow.leaves_approve_sup_own_by_supervisor.body.detail).toBe('You cannot decide your own leave.');
    expect(flow.leaves_approve_again.body.status[0]).toMatch(/Only a pending leave can be decided/);
    expect(flow.leaves_reject_empty.body.rejection_reason).toEqual(['A reason is required to reject a leave.']);
    expect(flow.leaves_reject.body).toMatchObject({ status: 'Rejected', rejection_reason: "Need a doctor's note" });
    expect(leaveActionsFrom('Pending').map((a) => a.action)).toEqual(['approve', 'reject']);
    expect(leaveActionsFrom('Approved')).toEqual([]);
    expect(LEAVE_ACTIONS.every((a) => a.permission === 'schedule.approve')).toBe(true); // a lead-artist and an artist were refused (403)
  });
  it('an approved leave that covers today puts the resource On Leave; a pending or later one does not', () => {
    expect(flow.resources_detail_before_leave_approved.body.status).toBe('Active');
    expect(flow.resources_detail_on_leave.body).toMatchObject({ status: 'On Leave', status_display: 'On Leave' });
    expect(flow.resources_detail.body.status).toBe('Active'); // the December leave is not today
  });
  it('reasons are shown to the person and to approvers only', () => {
    const reasons = (key: string) => Object.fromEntries(items(key).map((l) => [l.resource_code, l.reason]));
    expect(reasons('leaves_list_artist')).toMatchObject({ ALICE: 'Holiday trip', BOB: '' });
    expect(reasons('leaves_list_lead')).toMatchObject({ ALICE: '', BOB: 'Flu' });
    expect(reasons('leaves_list_manager')).toMatchObject({ ALICE: 'Holiday trip', BOB: 'Flu' });
    expect(count('leaves_search_reason')).toBe(0);
  });
  it('the list filters by status (any case), type, resource and a day window (CR-25)', () => {
    for (const key of ['leaves_by_status', 'leaves_by_resource', 'leaves_by_resource_id', 'leaves_by_leave_type', 'leaves_by_window']) expect(count(key)).toBeLessThan(count('leaves_baseline'));
    expect(count('leaves_by_status_lower')).toBe(count('leaves_by_status'));
    expect(count('leaves_by_nonsense')).toBe(count('leaves_baseline'));
    expect(count('leaves_by_start_date')).toBe(count('leaves_baseline')); // `start_date` is not a filter: `start` is
  });
});

describe('holidays and calendars', () => {
  it('a holiday goes to the default calendar unless it names one, and a date is used once per calendar', () => {
    expect(flow.holidays_create.body.calendar_name).toBe('Studio');
    expect(flow.holidays_create_duplicate.body.holiday_date).toEqual(['This calendar already has a holiday on this date.']);
    expect(flow.holidays_create_on_calendar.status).toBe(201);
    expect(flow.holidays_create_unknown_calendar.body.calendar_id).toEqual(['Unknown calendar.']);
    expect(flow.holidays_create_bad_date.body.holiday_date[0]).toMatch(/YYYY-MM-DD/);
    expect(count('holidays_by_calendar')).toBeLessThan(count('holidays_list'));
  });
  it('a holiday is written by schedule.manage only', () => {
    expect(flow.holidays_create_artist.status).toBe(403);
    expect(flow.holidays_delete_artist.status).toBe(403);
    expect(flow.holidays_delete.status).toBe(204);
  });
  it('a calendar: code unique, zone and weekdays checked, one default', () => {
    expect(flow.calendars_create_duplicate.body.code).toEqual(['A calendar with this code already exists.']);
    expect(flow.calendars_create_bad_zone.body.time_zone[0]).toMatch(/Unknown time zone/);
    expect(flow.calendars_create_bad_weekdays.body.working_weekdays[0]).toMatch(/Weekdays are whole numbers/);
    expect(flow.calendars_create_bad_hours.body.hours_per_day[0]).toMatch(/less than or equal to 24/);
    expect(flow.calendars_create_empty.body.code).toEqual(['A code is required.']);
    expect(flow.calendars_set_default.body.is_default).toBe(true);
    expect(items('calendars_list_after_default').filter((c) => c.is_default)).toHaveLength(1);
  });
  it('the default calendar cannot be deleted; an unused one can; any role reads, a role-less user cannot', () => {
    expect(flow.calendars_delete_default.status).toBe(409);
    expect(flow.calendars_delete_unused.status).toBe(204);
    expect(flow.calendars_list_artist.status).toBe(200);
    expect(flow.calendars_list_norole.status).toBe(403);
    expect(isCalendarDeletable({ is_default: true, resource_count: 0 })).toBe(false);
    expect(isCalendarDeletable({ is_default: false, resource_count: 2 })).toBe(false);
    expect(isCalendarDeletable({ is_default: false, resource_count: 0 })).toBe(true);
  });
});

describe('milestones', () => {
  it('a project, a name unique per project in any case, a date and a delivery for the delivery kind', () => {
    expect(flow.milestones_create.status).toBe(201);
    expect(flow.milestones_create_empty.body).toMatchObject({ name: ['This field is required.'], due_date: ['This field is required.'], project_id: ['This field is required.'] });
    expect(flow.milestones_create_duplicate.body.name).toEqual(['This project already has a milestone with this name.']);
    expect(flow.milestones_create_delivery_without_package.body.delivery_package_id).toEqual(['A delivery milestone needs a delivery.']);
    expect(flow.milestones_create_other_project.body.project_id).toEqual(['Unknown project.']);
    expect(flow.milestones_create_stranger.status).toBe(403);
    expect(flow.milestones_patch_project.body.project_id).toEqual(['Cannot be changed.']);
  });
  it('complete and reopen are the only way to move to and from Completed', () => {
    expect(flow.milestones_patch_completed_status.body.status).toEqual(['Use the complete action.']);
    expect(flow.milestones_complete.body).toMatchObject({ status: 'Completed' });
    expect(flow.milestones_complete.body.completed_at).toBeTruthy();
    expect(flow.milestones_complete_again.body.status).toEqual(['This milestone is already completed.']);
    expect(flow.milestones_reopen.body.status).toBe('In Progress');
    expect(flow.milestones_reopen_again.body.status).toEqual(['Only a completed milestone can be reopened.']);
    expect(flow.milestones_complete_artist.status).toBe(403);
    expect(milestoneActionsFrom('Pending').map((a) => a.action)).toEqual(['complete']);
    expect(milestoneActionsFrom('In Progress').map((a) => a.action)).toEqual(['complete']);
    expect(milestoneActionsFrom('Completed').map((a) => a.action)).toEqual(['reopen']);
    expect(MILESTONE_ACTIONS.every((a) => a.permission === 'schedule.manage')).toBe(true);
  });
  it('a status sent on create is ignored (it is always Pending)', () => {
    expect(flow.milestones_create_completed.body.status).toBe('Pending');
  });
  it('a stranger sees none and 404s on one; the list filters by status, kind and project, by id or by code (CR-25)', () => {
    expect(count('milestones_list_stranger')).toBe(0);
    expect(flow.milestones_detail_stranger.status).toBe(404);
    for (const key of ['milestones_by_project_id', 'milestones_by_project', 'milestones_by_project_code']) expect(count(key)).toBe(count('milestones_baseline'));
    expect(count('milestones_by_status')).toBeLessThan(count('milestones_baseline'));
    expect(count('milestones_by_kind')).toBe(0); // no delivery milestone was made
    expect(count('milestones_by_nonsense')).toBe(count('milestones_baseline'));
  });
  it('the project schedule route lists the milestones', () => {
    expect(flow.projects_schedule_route.body.milestones.length).toBeGreaterThan(0);
    expect(keys(flow.projects_schedule_route.body.milestones[0])).toEqual(['date', 'id', 'name', 'status']);
  });
});

describe('events', () => {
  it('the body has start_time and end_time with a zone; the old start_date/end_date form is a 400', () => {
    expect(flow.events_create.status).toBe(201);
    expect(flow.events_create_start_date_form.body).toMatchObject({ start_time: ['This field is required.'], end_time: ['This field is required.'] });
    expect(flow.events_create_naive.body.start_time[0]).toMatch(/Send the time zone too/);
    expect(flow.events_create_end_before_start.body.end_time).toEqual(['The end cannot be before the start.']);
    expect(flow.events_create_unknown_project.body.project_id).toEqual(['Unknown project.']);
  });
  it('an artist creates events but cannot edit, change the status of or delete one', () => {
    expect(flow.events_create.status).toBe(201);
    for (const key of ['events_patch_artist', 'events_update_status_artist', 'events_delete_artist']) expect(flow[key].status).toBe(403);
    expect(flow.events_patch.status).toBe(200);
    expect(flow.events_patch_supervisor.status).toBe(200);
    expect(flow.events_update_status.body.status).toBe('In Progress');
    expect(flow.events_update_status_bad.body.status).toEqual(['Unknown status "Banana".']);
    expect(flow.events_update_status_missing.body.detail).toBe('status is required.');
    expect(flow.events_delete.status).toBe(204);
    expect(flow.events_create_norole.status).toBe(403);
  });
  it('visibility narrows the list: a stranger sees the Organization events only; a private event is a 404', () => {
    expect(items('events_list_stranger').map((e) => e.visibility)).toEqual(['Organization']);
    expect(flow.events_detail_private_stranger.status).toBe(404);
  });
  it('the row carries the project id and name; the list filters by project, type, status and a window (CR-25)', () => {
    expect(items('events_list')[0].project_id).toBe(flow.events_detail.body.project);
    for (const key of ['events_by_project_id', 'events_by_project', 'events_by_event_type', 'events_by_status', 'events_by_start', 'events_by_end']) expect(count(key)).toBeLessThan(count('events_baseline'));
    expect(count('events_by_window')).toBe(0);
    expect(count('events_by_type_lower')).toBe(count('events_by_event_type'));
    expect(flow.events_by_window_naive.status).toBe(400);
    expect(flow.events_by_window_naive.body.start[0]).toMatch(/Send the time zone too/);
    expect(count('events_by_nonsense')).toBe(count('events_baseline'));
    expect(count('events_search')).toBeLessThan(count('events_baseline'));
  });
});

describe('capacity and overbooking', () => {
  it('describe the current week, one capacity row per department, and need schedule.view', () => {
    const unassigned = items('capacity_get_over').find((row) => row.department === 'Unassigned');
    expect(unassigned).toMatchObject({ overbooked_count: 1, allocated_hours: 12 });
    expect(items('capacity_get_over').length).toBeGreaterThan(1);
    expect(flow.capacity_norole.status).toBe(403);
    expect(flow.capacity_artist.status).toBe(200);
    expect(flow.capacity_post.status).toBe(403);
  });
  it('an alert carries its excess hours and the bookings behind it, anonymously', () => {
    const alert = items('overbooking_get')[0];
    expect(alert).toMatchObject({ resource_name: 'Small box', max_capacity_hours: 8, scheduled_hours: 12, excess_hours: 4 });
    expect(alert.id).toMatch(/^ob-/);
    expect(alert.conflicting_events).toHaveLength(2);
    expect(flow.overbooking_norole.status).toBe(403);
  });
  it('resolving flags the bookings but leaves the alert; it needs schedule.update', () => {
    expect(flow.resolve.body).toMatchObject({ success: true });
    expect(flow.resolve.body.message).toMatch(/Flagged 2 booking\(s\)/);
    expect(items('overbooking_after')).toHaveLength(1);
    expect(flow.resolve_artist.status).toBe(403);
    expect(flow.resolve_empty.body.alert_id).toEqual(['This field is required.']);
    expect(flow.resolve_unknown_key.body.nope).toEqual(['Unknown field.']);
    expect(flow.resolve_unknown_alert.body.detail).toBe('Unknown overbooking alert.');
    expect(flow.resolve_get.status).toBe(403);
  });
});
