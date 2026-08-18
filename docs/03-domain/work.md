# Work Domain — Tasks, Assignments, Dependencies & Templates

Generated: 2026-08-18T12:27:14+05:30

Purpose
-------
Defines the Work domain (Tasks, Assignments, Task Types, Templates, Dependencies, Work vs Task distinction) for StudioHub. This document provides canonical models, invariants, and implementation guidance.

Core principle
--------------
Task is the primary planned unit of work. Work may be introduced as a separate concept only when the studio needs to record actual execution sessions, time tracking, or work logs. Default approach: use Task as single model with optional WorkSessions if required.

Task definition
---------------
A Task represents an assigned unit of production work tied to a Shot or an Asset (target). It encapsulates discipline-specific details, schedule, assignee, and lifecycle.

Recommended attributes
----------------------
- id (UUID)
- production_id, project_id
- target_type ("shot"|"asset"|"project")
- target_id (shot_id or asset_id)
- code (optional)
- name
- task_type (anim, lighting, comp, rigging, modeling, fx, etc.)
- status (todo|ready|in_progress|review|done|blocked)
- workflow_id
- assignee_id (nullable)
- team_id (nullable)
- estimate_hours (nullable)
- remaining_hours (nullable)
- priority
- dependencies (list of task_ids)
- created_by, created_at, updated_by, updated_at

Assignment model
----------------
Assignment is a separate record to support multiple assignees or staged handoffs.
Assignment attributes:
- id
- task_id
- assignee_type (user|team)
- assignee_id
- role (primary|secondary|backup)
- start, due
- allocation_percent
- status (active|completed|cancelled)

Rules:
- A task may have one primary assignee and zero or more secondary assignees.
- Teams may be assigned to allow team ownership; a concrete resource must be selected prior to final scheduling.

Task Templates
--------------
Task templates provide reusable sets of tasks for common artefacts (character asset, vfx shot, etc.). Template defines ordered tasks, default task types, default durations, and dependencies.
- template_id
- name
- tasks: [ {name, task_type, default_estimate, default_department, default_dependencies} ]

Dependencies
------------
Support at minimum Finish-to-Start dependencies. Store dependencies as edges (from_task_id, to_task_id, type). Prevent cycles via graph checks at creation time.

Work vs Task
------------
- Task = planned unit (canonical model)
- Work (optional) = runtime execution instance (work session, time log)

Introduce WorkSessions only if required by reporting or time-tracking features. Keep WorkSessions small and append-only.

Scheduling and allocation
-------------------------
- Scheduler uses selectors to find candidate resources and creates Allocation records (see production-scheduling.md).
- Task assignment may be tentative (allocation.status = tentative) until confirmed.

Bulk operations & templates
---------------------------
Support bulk creation from templates and bulk assignment flows with careful validation and audit. Bulk operations should be idempotent and report partial failures.

Validation & invariants
-----------------------
- A Task target (shot/asset) must exist and belong to the same production/project.
- Dependencies must not create cycles.
- Assignment start/due must be within task scheduling windows.

API and selectors
-----------------
Suggested endpoints:
- POST /api/v1/tasks/ (creates a task with optional template)
- POST /api/v1/tasks/{id}/assignments/
- POST /api/v1/tasks/bulk_create/

Selectors:
- TaskSelector.for_assignee(user_id)
- TaskSelector.blocked_tasks(project_id)
- TaskSelector.pending_review(project_id)

Events
------
Emit: TaskCreated, TaskAssigned, TaskStatusChanged, TaskCompleted, TaskDependencyAdded.

Testing
-------
- Unit test task lifecycle transitions, dependency prevention of cycles, assignment rules.
- Integration test scheduling flow (allocate → confirm)

End of Work domain document.
