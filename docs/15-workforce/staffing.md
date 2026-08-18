Staffing — Requests, Search & Fulfilment

Purpose

Document the staffing request lifecycle and candidate matching primitives.

StaffingRequest model

- request_id UUID
- project_id
- required_roles (list)
- required_skills (list)
- count
- priority
- start_date, end_date
- status (draft|submitted|reviewing|approved|fulfilled|rejected|cancelled)
- created_by, approver_id

Workflow

1. Production creates StaffingRequest
2. Staffing team searches candidates by skills, availability, capacity and cost
3. Candidate shortlist created and proposed allocations made
4. Approval -> Allocation -> Assignment

Candidate search factors (deterministic)

- skill match
- proficiency level
- availability (calendar & leave)
- historical project experience
- cost/rate (optional)
- location/timezone

Next steps

- Provide UI/UX mockups for the staffing workflow and candidate shortlist export.
