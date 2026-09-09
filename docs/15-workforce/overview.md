Part 12 — Workforce, Resource & Capacity Management — Overview

Purpose

This part defines the Workforce / Resource Management bounded context for StudioHub: people, resources (human and non-human), employees, contractors, freelancers, vendor resources, teams, skills, availability, calendars, allocations, capacity, staffing, utilization, and workforce analytics. It documents domain boundaries, recommended data models, integration touchpoints with Identity (Part 3), Production (Parts 4–7), Notifications (Part 10), and Commercial (Part 11).

Scope

- Canonical domain model and principal aggregates for workforce management.
- Guidance on Person vs User vs Resource vs Employee vs Contractor separation.
- Resource profile, skills, proficiency, availability, calendars and working hours.
- Assignments, allocations, staffing requests, reservations, capacity calculations and utilization rules.
- Integration guidance: HR/HRIS syncs, ERP/Commercial links, identity sync, notifications, and search.
- Security, privacy, tenancy and audit requirements.

Non-goals

- Full HRIS, payroll or benefits management (integrate with existing HR/payroll systems where required).
- Detailed country-specific labor law or payroll calculations.

Core Principles (summary)

- Person != User != Resource: separate concerns, with Person as the canonical identity for human data and Resource as the schedulable/allocatable production concept.
- Keep Workforce and Identity bounded contexts distinct: Identity owns authentication and accounts; Workforce owns employment, skills, capacity and allocations.
- Financial and commercial data remain in Commercial bounded context (Part 11); Workforce provides planned resource cost and feeds commercial forecasts.
- Use versioning and append-only policies for authoritative planning artifacts (staffing plans, approved allocations) to preserve historical reporting.
- Respect organization tenancy boundaries on all workforce data.

Recommended folder contents

- domain-model.md — conceptual model and relationships
- people.md — Person canonical model and relationship to User
- resources.md — Resource abstraction and types
- employees.md — employee record guidelines (non-payroll)
- contractors.md — contractor model and vendor linkages
- freelancers.md — freelancer guidance
- teams.md — team and pool concepts
- departments.md — org departments and hierarchy
- roles.md — job role guidance vs project roles
- skills.md — skill taxonomy and proficiency model
- proficiency.md — proficiency levels and verification
- availability.md — availability windows and calendar precedence
- calendars.md — calendar architecture and precedence rules
- working-hours.md — working time model and shifts
- holidays.md — holiday calendar guidance
- leave.md — leave requests and approvals
- shifts.md — shift scheduling concepts
- assignments.md — task & project assignment semantics
- allocations.md — allocation vs assignment and allocation lifecycle
- staffing.md — staffing requests, candidate search, approval flows
- capacity.md — capacity calculation, precomputation and scaling guidance
- utilization.md — utilization vs billability vs productivity
- resource-costs.md — planned resource cost & integration with Part 11
- vendor-capacity.md — vendor teams & capacity model
- workforce-analytics.md — dashboards, reports and snapshots
- integrations.md — HR/HRIS, identity, commercial and scheduling integrations
- security.md — workforce privacy and permissions
- diagrams/ — diagrams and mermaid files

Next steps

1. Run a repository search (code ↔ docs gap analysis) to map existing identity/person/employee/resource models and migrations into this domain model (recommended next action).
2. Draft ADRs for: Person vs User separation; Resource abstraction; Capacity computation approach (on-the-fly vs materialized); and HR sync semantics.
3. Collaborate with Production, Finance and HR stakeholders to validate key fields and workflows (staffing requests, approvals, allocation policies).

