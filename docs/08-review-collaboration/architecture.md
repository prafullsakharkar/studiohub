# Review Architecture — Boundaries, Events & Patterns

Generated: 2026-08-18T12:53:51+05:30

Summary
-------
This document describes the high-level architecture for Review & Collaboration: domain boundaries, event model, storage and media responsibilities, and integration with the Production, Version, Publish and Pipeline contexts.

Bounded context
---------------
- Review is its own bounded context responsible for review sessions, playlists, items, feedback, annotations, approvals, invitations and audit. It references Version/Publish/Media by stable identifiers but does not duplicate production business rules.

Primary responsibilities
-----------------------
- Manage ReviewSession, Playlist, ReviewItem, Feedback (comments/annotations), and Approval entities
- Provide APIs for creating, updating, and querying review state and artifacts
- Emit domain events for ReviewCreated, CommentCreated, ApprovalGranted, ReviewCompleted, etc.
- Integrate with Pipeline/Media services for proxy generation and watermarking
- Provide secure external access mechanisms (short-lived links, guest roles)

Layering & integration
----------------------
- Domain/Application: review workflows, approval policies, audit rules
- Infrastructure: media proxies, watermarking, streaming/players, invites, notifications
- Keep review UI and streaming separate from core domain so large-media flows do not affect domain transactions

Event model
-----------
Examples:
- ReviewSessionCreated, PlaylistSubmitted, ReviewItemAdded, CommentCreated, AnnotationCreated, ApprovalRequested, ApprovalGranted, ReviewCompleted
Follow the event header and payload guidance from docs/03-domain/production-events.md — include stable IDs and minimal payloads.

Security & visibility
---------------------
- Enforce tenant/project isolation and comment visibility flags (internal/external/restricted)
- External links are single-purpose, expiring, and auditable; do not grant broader API access

Observability & audit
---------------------
- Record audit trails for decisions, participant changes, and link access
- Emit metrics for review cycle times, comment volumes, approvals, and overdue items

Concurrency & consistency
------------------------
- Use optimistic concurrency for approval operations and playlist reorders
- Ensure idempotency for approval/decision operations (idempotency keys)

Next steps
----------
- Define entity schemas and API contracts in follow-up files
- Produce diagrams for session lifecycle and approval flows
- Identify ADRs needed (snapshot policy, guest access model, media retention for external reviews)

End of architecture.
