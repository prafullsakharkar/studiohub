Workforce — Conceptual Domain Model

Overview

This document captures the canonical domain model for the Workforce bounded context. It is intentionally implementation-agnostic and focuses on aggregates, relationships, invariants, and integration points with Identity, Production and Commercial.

Primary aggregates

- Person (aggregate root)
  - canonical human record: name, preferred name, emails, phone, timezone, locale, profile metadata
  - relationships: 0..* UserAccount, 0..* EmployeeRecord, 0..* ContractorRecord
  - system-of-record: Identity (for username/credentials) vs HR (for employment details). See System-of-Record matrix.

- Resource (aggregate root)
  - schedulable entity representing capacity. Types: Human, Team, Facility, Machine, RenderPool
  - attributes: resource_type, display_name, organization_id, department_id, timezone, resource_profile_id
  - links: Person (optional), Vendor (optional)

- Skill (entity/value-object)
  - taxonomy entry: name, category, description, active_flag

- SkillProficiency (value object or child entity)
  - skill_id, resource_id, level, years_experience, verified_by, verified_at, valid_from, valid_to, source

- Employment / EmployeeRecord
  - person_id, employment_type (permanent/contract/temp), employee_number, department, manager_id, start_date, end_date, cost_classification

- ContractorRecord
  - person_id, vendor_id, contract_start, contract_end, billing_rate_reference

- Team / ResourcePool
  - name, department_id, members (resource membership), capacity_policy

- Calendar & WorkingHours
  - calendar_id, scope (org|department|team|resource|project), rules, exceptions, holidays

- Availability & Leave
  - resource_id, date_range, availability_percentage, reason, status, approval_metadata

- Assignment (production-facing)
  - links: resource_id, project_id, task_id/shot_id, role, assignment_type (primary/secondary), start, end

- Allocation (planning-facing)
  - resource_id, project_id, planned_hours, allocation_percent, start, end, allocation_type (soft/hard), status

- StaffingRequest
  - project_id, required_skillset, count, start, end, priority, status, created_by

- CapacitySnapshot (reporting aggregate)
  - snapshot_id, period_start, period_end, department, skill, total_capacity_hours, committed_hours, available_hours

Relationships & mapping

- Person ↔ UserAccount: optional 1:N. UserAccount (Identity) owns authentication. Person owns HR/profile attributes.
- Person ↔ EmployeeRecord / ContractorRecord: 0..* depending on employment history.
- Resource may point to Person (for human resources) or be non-human (facility/machine).
- Allocation and Assignment reference Resource by id (not Person) to keep scheduling consistent even when person offboarded.
- CapacitySnapshot may be materialized for performance and historical reporting.

Important invariants

- Allocation.start <= Allocation.end
- Allocation.planned_hours >= 0
- Allocation percentage mapped to working hours defined by effective calendar
- Approved (hard) allocations cannot be silently changed; changes must create audit entries and versioning

Event examples (domain events)

- ResourceCreated, ResourceUpdated
- SkillAdded, SkillVerified
- AvailabilityChanged
- LeaveRequested, LeaveApproved, LeaveRejected
- StaffingRequestCreated, StaffingRequestFulfilled
- AllocationCreated, AllocationUpdated, AllocationCancelled

System-of-Record guidance

- Person basic profile: Identity (user attributes) for login fields; HR source for employment details (title, manager) if an HR system exists — do not overwrite HR-owned fields without explicit sync policy.
- Cost-related fields for resources are owned by Commercial (Part 11); Workforce exposes planned cost references but does not manage billing ledgers.

Next steps

- Create canonical DB & JSON schema sketches (in a follow-up doc) for core aggregates.
- Run code ↔ docs gap analysis to map existing models and migrations to this model.
- Draft ADRs for materialized capacity snapshots, allocation transactional semantics, and Person vs User ownership.