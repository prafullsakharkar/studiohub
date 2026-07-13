# ADR-0018: Event Bus Architecture

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is composed of multiple business domains, including:

- Core
- Identity
- Organization
- Production
- Assets
- Review
- Notifications
- Reporting
- Automation

Business operations in one domain frequently require actions in other domains.

Examples include:

- Creating an organization initializes default roles and settings.
- Publishing an asset triggers thumbnail generation and notifications.
- Completing a review updates production metrics.
- Inviting a user sends email notifications and audit records.

Implementing these workflows through direct service-to-service calls would tightly couple domains, making the system harder to evolve and test.

The platform requires a mechanism for communicating business events while preserving domain boundaries.

---

# Decision

StudioHub adopts an **Event Bus** architecture based on **Domain Events**.

Business services publish immutable events describing completed business actions.

Subscribers react to those events without requiring the publishing service to know about downstream consumers.

Events represent facts that have already occurred.

---

# Objectives

The Event Bus architecture aims to:

- Decouple business domains
- Improve extensibility
- Enable asynchronous processing
- Support auditability
- Simplify integrations
- Encourage event-driven workflows

The Event Bus is a communication mechanism, not a persistence layer.

---

# Architecture

```text
Request

↓

Service

↓

Database Transaction

↓

Commit

↓

Publish Domain Event

↓

Event Bus

↓

Subscribers

↓

Background Tasks / Other Domains
```

Events are published only after successful transaction commits.

---

# Event Lifecycle

Typical lifecycle:

```text
Business Action

↓

Validation

↓

Database Update

↓

Transaction Commit

↓

Create Domain Event

↓

Publish Event

↓

Subscriber Processing
```

Subscribers must never observe uncommitted data.

---

# Event Types

Typical domain events include:

- UserCreated
- UserInvited
- OrganizationCreated
- DepartmentCreated
- ProjectCreated
- ProjectArchived
- TaskAssigned
- TaskCompleted
- AssetUploaded
- AssetPublished
- ReviewApproved
- MembershipChanged

Event names should describe completed business facts using the past tense.

---

# Event Structure

Every event should include standard metadata.

Typical fields:

- Event identifier
- Event type
- Aggregate identifier
- Aggregate type
- Organization identifier
- Timestamp
- Actor identifier
- Correlation identifier
- Payload

Events are immutable after publication.

---

# Event Bus Responsibilities

The Event Bus is responsible for:

- Publishing events
- Dispatching subscribers
- Supporting synchronous handlers
- Supporting asynchronous handlers
- Error isolation
- Logging
- Observability

It is not responsible for business logic.

---

# Publisher Responsibilities

Publishers should:

- Complete business logic first
- Commit database transactions
- Publish immutable events
- Avoid knowledge of subscribers

Publishers must not depend on subscriber implementations.

---

# Subscriber Responsibilities

Subscribers may perform:

- Cache invalidation
- Email notifications
- Search indexing
- Audit enrichment
- Analytics updates
- Thumbnail generation
- External integrations
- Background task scheduling

Subscribers should remain independent and idempotent.

---

# Synchronous vs Asynchronous Processing

### Synchronous Events

Used for:

- In-process updates
- Lightweight reactions
- Immediate consistency requirements

### Asynchronous Events

Used for:

- Notifications
- Media processing
- AI workflows
- Search indexing
- Reporting
- External APIs

Asynchronous subscribers are executed using Celery workers.

---

# Failure Handling

Subscriber failures must not invalidate completed business transactions.

Typical strategy:

```text
Publish Event

↓

Subscriber Failure

↓

Retry

↓

Dead Letter Queue (Future)

↓

Alert
```

Failed subscribers should be isolated from the publisher.

---

# Event Ordering

Ordering guarantees apply only within the same aggregate where required.

The system should not rely on global event ordering.

Subscribers should tolerate out-of-order delivery when possible.

---

# Idempotency

Subscribers must be idempotent.

Repeated delivery of the same event should not produce duplicate side effects.

Idempotency is essential for retries and distributed processing.

---

# Versioning

Events should support versioning to enable schema evolution.

Recommended metadata:

```text
event_type

event_version

occurred_at
```

Breaking changes require a new event version.

---

# Security

Events should:

- Avoid sensitive secrets
- Respect tenant boundaries
- Include only required business data
- Follow authorization rules

Sensitive information should be referenced rather than embedded where practical.

---

# Observability

The Event Bus should provide:

- Event publication metrics
- Subscriber execution metrics
- Failure tracking
- Retry statistics
- Processing latency
- Correlation tracing

These metrics support operational monitoring and debugging.

---

# Alternatives Considered

## Direct Service Calls

Advantages:

- Simple implementation
- Easy debugging

Disadvantages:

- Tight coupling
- Difficult extension
- Circular dependencies

Rejected.

---

## Database Triggers

Advantages:

- Automatic execution

Disadvantages:

- Hidden logic
- Database coupling
- Difficult testing

Rejected.

---

## Message Broker Only

Advantages:

- Distributed architecture

Disadvantages:

- Increased operational complexity
- Premature for a modular monolith

Deferred until system evolution requires distributed messaging.

---

# Consequences

## Positive

- Loose coupling
- Improved scalability
- Better extensibility
- Easier testing
- Cleaner domain boundaries
- Natural support for asynchronous processing

## Negative

- Additional infrastructure
- Eventual consistency
- Retry complexity
- Monitoring requirements

These trade-offs are appropriate for an enterprise event-driven architecture.

---

# Implementation Guidelines

- Publish events only after successful transaction commits.
- Treat events as immutable facts.
- Keep publishers unaware of subscribers.
- Ensure subscriber idempotency.
- Use asynchronous processing for long-running work.
- Include correlation identifiers for tracing.
- Version events when schemas evolve.

---

# Compliance

Architecture reviews should verify:

- Services publish events after commits.
- Events use past-tense naming.
- Subscribers remain independent.
- Long-running handlers execute asynchronously.
- Event metadata includes identifiers and timestamps.
- Subscriber failures do not affect completed transactions.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0004 — Domain-Driven Design
- ADR-0005 — Event-Driven Architecture
- ADR-0007 — Background Processing with Celery & Redis
- ADR-0011 — Audit Logging Strategy
- ADR-0015 — Caching Strategy
- ADR-0016 — Validation Architecture
- ADR-0017 — Permission & Authorization Model

---

# References

- `docs/03-backend/events.md`
- `docs/03-backend/services.md`
- `docs/06-infrastructure/messaging.md`
- `docs/11-operations/monitoring.md`
- `docs/11-operations/logging.md`