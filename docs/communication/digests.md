Digests — Scheduled summaries

Overview

Digests are scheduled summaries of events and notifications for a user or project. Design for low-cost generation and limited frequency.

Design

- Types: personal (user-level), project-level, organization-level.
- Frequency: daily, weekly, custom times (timezone-aware).
- Content: summary counts, top actionable items, links to targets (do not embed large media).

Implementation patterns

- Option A: scheduled job that queries notifications table for the window and composes digest per user.
- Option B: incremental aggregator that accumulates counters and items in a short-lived cache then composes digest when time arrives.

Delivery

- Digests delivered via Email and In‑App.
- Respect mandatory events: critical alerts should still be delivered immediately, not deferred to digests.

Operational notes

- Provide opt-in/opt-out preferences per digest type.
- Use batching to reduce provider API calls (group emails into bulk sends where provider allows).
