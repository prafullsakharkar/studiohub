# Scheduling, Resource Management & Workflow

This document captures the interaction between scheduling, resource management, and configurable workflows.

## Scheduling (business perspective)

StudioHub supports scheduling primitives but does not attempt to be a full HR system. Focus is on production needs:

- Calendar, working days, holidays
- Availability windows for artists and facilities
- Task-level deadlines and milestones
- Capacity & utilization metrics for departments and teams

Suggested scope:
- Assign tasks to users/teams with optional soft and hard deadlines
- Support capacity calculations (based on skill, team, and facility constraints)
- Surface conflicts and over-allocations to producers

## Resource Management

Key resources:
- People (artists, supervisors)
- Teams / Departments
- Facilities (offices, stages)
- Machines (render nodes, artist workstations) — tracked where relevant

Capabilities:
- Simple availability profiles (full-time, part-time, contractor)
- Team-level assignment and role mapping
- Capacity planning dashboards (supporting up/down-scaling)

## Workflow Engine (configuration-first)

Workflows should be configurable per Production/Project. Core primitives:
- States and transitions
- Conditions (guards) and triggers
- Actions (automations) and notifications
- Permission checks per transition

Examples:
- Animation workflow: Blocking → Spline → Polish → SupervisorReview → Approved
- Compositing workflow: WIP → Review → Final → Delivery

## Automation hooks

- On state transition: call webhook or enqueue background task
- On publish: trigger validation and registry
- On approval: trigger notifications and move downstream tasks

## Ownership & boundaries

- Scheduling Context owns calendars and availability data.
- Workflow Context owns state machines and transition definitions.
- Resource management surfaces data to Production / Project dashboards but rarely enforces hard constraints (configurable enforcement).

## Notes

- Keep scheduling and resource models simple initially; integrate with external workforce/HR systems later if needed.
- Workflows must be expressive enough to support studio-specific pipelines without code changes.
