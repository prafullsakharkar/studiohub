Assignments — Task & Project Assignments

Purpose

Clarify semantics for assignments (who is responsible) versus allocations (capacity reserved) and recommended data model.

Assignment model

- assignment_id UUID
- resource_id
- project_id
- task_id or shot_id
- role (project role string)
- assignment_type (primary|secondary|reviewer)
- start_date, end_date
- created_by, created_at

Notes

- Assignments are authoritative for production (who will work on the task) and should be surfaced in Task/Shot APIs.
- Keep assignment fast to update; allocation captures capacity reservation semantics.

Next steps

- Define API endpoints for assignment operations and permission checks.