Resource Costs — Planned vs Actual (integration with Part 11)

Purpose

Document how Workforce provides planned resource costs to Commercial and how actual time flows back for costing.

Planned resource cost

- Derived from allocation planned_hours × resource internal cost rate (versioned, effective date aware)
- Allocation may carry a cost_code to map to budget/contract lines

Actual cost

- Calculated from TimeEntry (Part 11) × resource internal cost rate
- Reconciliation required since actual hours may differ from planned

Integration guidance

- Use events: Allocation.approved -> commercial.allocation_committed (create committed cost entry)
- TimeEntry.approved -> commercial.time_entry_recorded (creates actual cost entry)
- Ensure monetary types and rounding follow ADR for Money (Part 11)

Next steps

- Provide example payloads for allocation commits and time-entry cost events.