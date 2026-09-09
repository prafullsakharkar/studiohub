Time Tracking — Model & Workflows

Purpose

Describe TimeEntry and Timesheet models, approvals, billable classifications, and rules for financial calculations.

TimeEntry fields

- id UUID
- user_id
- project_id
- task_id
- date
- duration_minutes
- duration_hours (decimal representation)
- billing_classification (billable|non-billable|internal|training)
- notes
- status (draft|submitted|approved|rejected|locked)
- internal_cost_rate_id
- billing_rate_id
- cost_amount (calculated)

Workflows

- Users create TimeEntries (daily). Entries may be grouped into Timesheets by period.
- Submission -> Approval by Lead/Department Manager/Production Manager.
- Approved entries are included in cost rollups and billing calculations.

Approval & immutability

- Once approved, entries should not be silently changed; use adjustments with audit metadata.

Next steps

- Define timesheet aggregation endpoints and approval UI.
- Map to cost calculation services (separate from billing rate calculations).