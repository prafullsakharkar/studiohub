Allocations — Planning vs Commitment

Purpose

Describe allocation constructs used for planning and commitment (soft vs hard allocations), and how allocations map to capacity calculations and commercial planning.

Allocation model

- allocation_id UUID
- resource_id
- project_id
- allocation_type (soft|hard)
- planned_hours (or allocation_percent)
- start_datetime, end_datetime
- status (draft|proposed|approved|committed|cancelled)
- created_by, approved_by, audit_info

Soft vs Hard

- Soft allocation: planning intent, can be overbooked and adjusted easily.
- Hard allocation: approved commitment (may create commercial committed cost entries via Part 11 integration).

Conflict detection

- On creation/update perform capacity check according to resource calendar and existing approved allocations; flag but do not necessarily block soft allocations.

Transactional semantics

- Allocation creation that affects multiple resources or project-level capacity should be transactional; consider optimistic locking for concurrently updated allocations.

Next steps

- Draft examples: creating an allocation for a 50% allocation from 2026-09-01 to 2026-09-14; precompute planned hours using calendar rules.