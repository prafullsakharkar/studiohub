# Production Scheduling — Resource & Calendar Model

Generated: 2026-08-18T12:22:35+05:30

Purpose
-------
Defines the scheduling and resource model for Production: how resources, calendars, allocations, and constraints are represented and how scheduling services should operate.

Principles
----------
- Scheduling is an application-level concern (Scheduler Service) that uses Selectors and domain validators.
- The Domain contains small, authoritative models for Resource and Allocation; the heavy lifting (solvers, rebalancing) is in Application/Infrastructure.
- Keep the model timezone-aware and locale-friendly.

Core concepts
-------------
Resource
- id (UUID)
- production_id
- type (human|workstation|render_node|pool)
- display_name
- skills (list of strings, e.g., ["anim","rig"])
- cost_center
- calendar_id (reference to calendar service)
- capacity (max concurrent tasks)
- availability_rules (work hours, exceptions)

Availability / Calendar
- Use an external calendar or an internal simple calendar model (weekly working hours, exceptions).
- Calendar entries: (resource_id, start, end, type: booked|blocked|holiday)

Allocation (booking)
- id
- resource_id
- task_id (or booking_group_id)
- start, end
- percent (0-100)
- status (tentative|confirmed|cancelled|completed)

Booking Group (optional)
- A logical grouping for multi-resource bookings (e.g., shot requires animator+rigger simultaneously)

Constraints
-----------
- No-overlap: resource allocations must not exceed capacity for overlapping times
- Skills-match: resource must have required skill set
- Working hours: respect calendar rules
- Max-utilization: optionally limit daily run rate

Scheduler Service responsibilities
---------------------------------
- Provide an API to compute tentative schedules and persist allocations
- Use selectors to read candidate tasks, resources and constraints
- Implement conflict resolution heuristics (earliest-deadline-first, least-loaded-first, skill-match score)
- Support manual override and reassignments
- Provide endpoints to run rebalancing when a resource becomes unavailable

APIs (recommended)
------------------
- POST /api/v1/scheduler/plan — compute tentative plan for a project or date range
- POST /api/v1/scheduler/allocate — persist an allocation
- POST /api/v1/scheduler/rebalance — re-run constraints and suggest changes
- GET  /api/v1/resources/{id}/calendar — resource calendar

Example flow: Scheduling a Task
------------------------------
1. Application requests candidate resources via Selector (ResourceSelector.available_for(skill, start, end)).
2. Scheduler computes best-fit resource (least-loaded + skill match).
3. Under transaction.atomic, create Allocation record and set Task.assignee_id.
4. Publish TaskAssigned event on commit.

Resilience and scaling
----------------------
- Offload heavy scheduling computation to background workers with in-memory solvers or external services.
- Cache selector queries and pre-compute availability windows for high traffic productions.
- For large studios, partition resources by production and possibly by department to reduce search space.

Conflict resolution and heuristics
---------------------------------
- Prefer minimal moves: when rebalancing, try to adjust tentative allocations rather than confirmed ones.
- Use scoring function combining skill match, utilization, proximity to deadline, and cost.
- Provide human-in-the-loop for ambiguous decisions.

Integration notes
-----------------
- Integrate with identity and HR systems for employee calendars and leave.
- Integrate with external scheduling tools if studios already use one; treat external updates as authoritative and import them via adapter.

Data model & indexes
--------------------
- Index allocations by resource_id + start,end and by task_id
- Fast selectors require indexes on resource skills and availability summary

Testing
-------
- Unit test scoring heuristics and small schedule computations.
- Integration tests for full Plan -> Allocate flows with mocked calendars.
- Property-based tests to validate invariants (no-overlap, capacity respected).

Operational considerations
--------------------------
- Provide metrics: allocation churn, reassignments per week, resource utilization.
- Add alerting for failed rebalances or when many tasks remain unscheduled beyond SLA.

End of scheduling document.
