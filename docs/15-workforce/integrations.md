Integrations — HR/HRIS, Identity, Commercial & Production

Purpose

Describe integration surface for workforce: syncing employee data from HR, identity account linkage, commercial planned-cost events and production scheduling.

Integration points

- Identity (Identity/Authentication): link Person to UserAccount; do not duplicate credentials. Use invites for account creation.
- HR/HRIS: sync employee records, org structure and role updates. Implement sync adapters with dry-run and field ownership semantics.
- Commercial (Part 11): Allocation.approved -> commercial.allocation_committed events; TimeEntry -> commercial.time_entry events.
- Production: Assignments ↔ Task APIs; scheduling integration for project timelines.
- Notifications (Part 10): leave approvals, allocation conflicts, staffing request updates should trigger notifications.

Guidelines

- Use adapter pattern for external systems, support incremental/delta sync and idempotency keys.
- Respect system-of-record ownership; do not overwrite HR-owned fields without explicit mapping rules.

Next steps

- Draft example API payloads for HR sync and allocation events.