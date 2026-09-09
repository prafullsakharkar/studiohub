Shifts — Scheduling & Assignment

Purpose

Document shift concepts for studios that operate non-standard hours (render wrangling, global follow-the-sun work).

Shift record

- id
- name
- start_time, end_time
- timezone
- recurrence (cron-like or ISO rules)
- assigned_resource_ids
- effective_from, effective_to

Conflicts

- Detect conflicts with allocations, leave and other shifts.

Next steps

- Provide UI patterns for shift calendars and assignment.