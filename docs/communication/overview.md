Communication — Overview

Purpose

This section documents StudioHub's communication capabilities: notifications, activity, inbox, templates, delivery channels (in‑app, email, push, webhooks), realtime fanout, digests, reminders and escalations. It defines domain ownership, high-level flow and links to event and implementation guidance.

Scope

- Platform-level communication services (Notification routing, Delivery, Templates, Preferences, In‑App Inbox, Webhooks).
- Domain applications (Production, Review, Pipeline, Tasks, Delivery) are event producers — they publish domain events that are consumed by communication services.

Non-Goals

- Vendor/provider integration implementation details (example adapters live in infra docs).
- Frontend UI implementation (UX guidance only; API contracts are provided).

Key principles

- Event-driven: domain events are the single source of truth that can generate notifications.
- Permission-aware: recipients are resolved and authorized before notification delivery.
- User-configurable: per-user preferences and project/organization defaults.
- Reliable & observable: background delivery with retries, DLQ and monitoring.

Contents & links

- events.md — mapping domain events to notification triggers
- notification-model.md — DB + JSON schemas (Notification, Recipient, Delivery, Template, Preference)
- notification-routing.md — recipient resolution, deduplication and routing pseudocode
- preferences.md — preference model & API examples
- templates.md — template model, allowed variables and security
- in-app.md — inbox model and UI contract
- email.md — email provider abstraction and runbook
- webhooks.md — webhook endpoint lifecycle, signing and DLQ
- delivery.md — channel adapters, Celery queues and worker topology
- retries-and-dlq.md — retry/backoff and DLQ procedures
- digests.md — digest scheduling and grouping
- reminders-escalations.md — reminders and escalation policies
- realtime.md — WebSocket/SSE strategy and fallbacks
- activity.md — activity feed model and API
- observability.md — metrics and tracing guidance
- runbooks.md — operational procedures for outages and DLQ recovery
- diagrams/ — mermaid diagrams (routing, lifecycle)
