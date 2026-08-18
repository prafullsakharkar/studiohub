Leave — Requests, Types & Approval

Purpose

Define leave request model, types, approvals and impact on capacity and allocation.

Leave model

- leave_id UUID
- resource_id
- person_id (nullable)
- leave_type (vacation|sick|personal|other)
- start_date, end_date
- full_day_flag or partial_day windows
- status (draft|submitted|approved|rejected|cancelled)
- approver_id
- created_at, updated_at
- metadata

Approval flow

- User creates leave request -> Notify manager -> Manager reviews/approves -> On approval, capacity recalculation triggered and conflicting allocations flagged.

Constraints

- Approved leave must be captured in capacity snapshots and not silently removed.

Next steps

- Integrate leave approval notifications with docs/communication and audit trail.