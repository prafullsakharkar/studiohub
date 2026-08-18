Activity Feed — Model & API

Purpose

Defines the activity feed as a human-facing timeline of meaningful actions (distinct from audit logs). Activity provides context for recent work and is optimized for read queries and UI consumption.

Model sketch

- Activity: id, organization_id, project_id, actor_id, action, target_type, target_id, context JSON, created_at

API examples

GET /activity?scope=project&project_id=...
GET /projects/{id}/activity

Design notes

- Activity is user-facing and may be pruned/archived differently from audit logs.
- Activity should be generated from domain events (sampled or filtered to avoid noise).
- Use cursor pagination for feeds that expect large volumes.

Security

- Respect project and object permissions when showing activity.
- Activity entries should be sanitized for external recipients.
