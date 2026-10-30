/**
 * What may be done to a scheduling record in each state, from docs/sync/samples/scheduling/_flow.json
 * (Phase 10). One table per record so the screens and the tests read the same rules; the server decides again.
 */

export interface ScheduleAction {
  action: string;
  label: string;
  /** The backend permission code that shows the control. */
  permission: string;
  confirm: string;
  destructive?: boolean;
  /** A reason is asked for first. */
  ask?: { label: string; required: boolean };
}

// ------------------------------------------------------------------------------------------------ leave

export const LEAVE_ACTIONS: ReadonlyArray<ScheduleAction & { from: readonly string[] }> = [
  { action: 'approve', label: 'Approve', permission: 'schedule.approve', from: ['Pending'], confirm: 'Approve this leave? Capacity for those days drops, and the person shows as On Leave.' },
  { action: 'reject', label: 'Reject', permission: 'schedule.approve', from: ['Pending'], confirm: 'Reject this leave?', destructive: true, ask: { label: 'Reason', required: true } },
];
export const leaveActionsFrom = (status: string) => LEAVE_ACTIONS.filter((a) => a.from.includes(status));
/** Only a request nobody has decided can be edited. */
export const isLeaveEditable = (status: string) => status === 'Pending';

// ------------------------------------------------------------------------------------------------ milestones

export const MILESTONE_ACTIONS: ReadonlyArray<ScheduleAction & { from: readonly string[] }> = [
  { action: 'complete', label: 'Complete', permission: 'schedule.manage', from: ['Pending', 'In Progress'], confirm: 'Mark this milestone completed?' },
  { action: 'reopen', label: 'Reopen', permission: 'schedule.manage', from: ['Completed'], confirm: 'Reopen this milestone? It goes back to In Progress.' },
];
export const milestoneActionsFrom = (status: string) => MILESTONE_ACTIONS.filter((a) => a.from.includes(status));

// ------------------------------------------------------------------------------------------------ calendars

/** The default calendar cannot be deleted, and neither can one a resource or holiday uses (409 `calendar_in_use`). */
export const isCalendarDeletable = (calendar: { is_default: boolean; resource_count: number }) => !calendar.is_default && calendar.resource_count === 0;

// ------------------------------------------------------------------------------------------------ bookings

/** An Available slot is open time: it never conflicts and is shown apart from the bookings that occupy it. */
export const OCCUPYING_BOOKING_STATUSES = ['Booked', 'Blocked', 'Overbooked'] as const;
export const occupiesTime = (status: string) => (OCCUPYING_BOOKING_STATUSES as readonly string[]).includes(status);
