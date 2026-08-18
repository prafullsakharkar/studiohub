# Task & Work Domain

## Purpose

The Task domain represents assigned units of work, their estimates, progress, dependencies, and relationships to Shots or Assets. Tasks are the primary way StudioHub tracks day-to-day artist work.

## Responsibilities

- Model work items with rich metadata (type, priority, estimates, attachments)
- Support assignments to users or teams
- Track work status, actuals, and time where required
- Express dependencies between tasks
- Associate tasks with artifacts (shots, assets, sequences)

## Typical attributes

- Title, description, task_type, department, priority
- Status (Open, InProgress, Blocked, Review, Done)
- Assignee (user) or Team
- Estimate (hours/days) and Actuals
- Dependencies (predecessor/successor)
- Attached Versions and Submissions

## Concepts

- Assignment vs Work Item: Assignment is the act of giving a user work for a Task; Work Item is the abstract task object.
- Subtasks / Checklists: Optional per-Task items for fine-grained tracking.
- Task Templates: Reusable task sets for common work packages (e.g., a lighting task template).

## Lifecycle (example)

Open → In Progress → Blocked → In Review → Done

Transitions controlled by role and workflow configuration.

## Events

- TaskCreated
- TaskAssigned
- TaskStarted
- TaskCompleted
- TaskBlocked

## Ownership & Rules

- Ownership: Task aggregate owned by Task/Work Context.
- Creation: Producers, Coordinators, Supervisors, or automated processes (pipeline tasks).
- Dependency invariants: Circular dependencies are invalid; the system must detect and prevent cycles.

## Notes

- Task modeling should be flexible — lightweight for small studios, richer (time-tracking, estimates) for enterprise use.
- Tasks should reference stable identifiers for Shots and Assets rather than embedding domain data where possible.
