# Production Events — Schemas & Guidelines

Generated: 2026-08-18T12:22:35+05:30

Purpose
-------
Defines the canonical event taxonomy, payload conventions, versioning and best practices for events emitted from the Production domain.

Event categories
---------------
- Domain Events: business facts (e.g., TaskAssigned, VersionApproved)
- Application Events: internal application-level signals (e.g., RenderJobQueued)
- Integration Events: events intended for external consumers (e.g., DeliveryCompleted)
- Operational Events: infrastructure-level notifications (e.g., JobFailed)

Event metadata (required)
-------------------------
All events MUST include the following metadata fields in a standardized header:
- event_id (UUID)
- event_type (string, e.g., "production.task.assigned")
- event_version (semver or integer)
- occurred_at (ISO8601 UTC)
- aggregate_type (e.g., "task", "version")
- aggregate_id (UUID or external id)
- organization_id
- actor_id (user or system who triggered the event)
- correlation_id (optional, for traceability)

Design rules
------------
- Keep payloads minimal: include only essential business data and references (ids). Avoid embedding large blobs.
- Versioning: bump event_version when changing payload structure. Consumers must handle unknown/extra fields gracefully.
- Idempotency: include event_id and consumers must deduplicate using event_id or idempotency keys.
- Ordering: do not rely on global ordering; for single-aggregate ordering include sequence_number if necessary.
- Publishing: publish events only after successful transaction commit (use on_commit). For cross-process guarantees consider Outbox pattern.

Naming conventions
------------------
Use dot-separated lowercase names with domain prefix. Examples:
- production.production.created
- production.project.created
- production.shot.created
- production.task.assigned
- production.version.submitted
- production.version.approved
- production.publish.created
- production.delivery.completed

Sample event payloads
---------------------
1) TaskAssigned (domain)
{
  "event_id": "uuid",
  "event_type": "production.task.assigned",
  "event_version": "1",
  "occurred_at": "2026-08-18T12:00:00Z",
  "aggregate_type": "task",
  "aggregate_id": "task-uuid",
  "organization_id": "org-uuid",
  "actor_id": "user-uuid",
  "payload": {
    "task_id": "task-uuid",
    "assignee_id": "user-uuid",
    "assignee_type": "user",
    "assignment_method": "manual",
    "due_date": "2026-09-01T00:00:00Z"
  }
}

2) VersionSubmitted (domain)
{
  "event_id": "uuid",
  "event_type": "production.version.submitted",
  "event_version": "1",
  "occurred_at": "2026-08-18T12:05:00Z",
  "aggregate_type": "version",
  "aggregate_id": "version-uuid",
  "organization_id": "org-uuid",
  "actor_id": "user-uuid",
  "payload": {
    "version_id": "version-uuid",
    "task_id": "task-uuid",
    "version_number": "v003",
    "checksum": "sha256:...",
    "storage_path": "s3://.../v003.exr"
  }
}

3) VersionApproved → PublishCreated (chained)
- When a VersionApproved event occurs, an application service may create a Publish and emit production.publish.created with reference to the version.

Event consumers & contracts
--------------------------
- Consumers must declare supported event_types and versions; provide backwards compatibility or compensating logic.
- Maintain an event registry (docs/12-reference or a centralized schema repository) listing event schemas and sample payloads.
- Critical consumers (e.g., external integrations) should be added to a compatibility matrix in ADRs.

Outbox and delivery guarantees
------------------------------
- For simple deployments, in-process on_commit publish may be sufficient.
- For stronger guarantees (e.g., external delivery to vendor systems), document the use of the Outbox pattern (database-backed event store + background forwarder) in ADR and implement as an Infrastructure adapter.

Retries and dead-letter handling
-------------------------------
- Consumers should implement retries with exponential backoff for transient errors.
- For failing delivery attempts, route messages to a dead-letter queue with metadata and retry hints.
- Record failure telemetry for operational troubleshooting.

Security and privacy
--------------------
- Avoid including PII in event payloads. If PII is required, encrypt or redact as per security guidelines.
- Sign or authenticate event delivery for external consumers where confidentiality/integrity is required.

Tooling and contract tests
--------------------------
- Provide JSON Schema or similar for each event type and use contract tests in CI to validate producer output against schema.
- Provide sample consumers in integration-test suites to validate end-to-end flow.

Governance
----------
- Centralize event type registration and schema ownership per bounded context.
- Any breaking change to an event schema must follow ADR process and include migration guidance.

End of events document.
