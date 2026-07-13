# ADR-0005: Event-Driven Architecture

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub contains multiple business domains that frequently need to react to changes occurring in other domains.

Examples include:

- A new user joins an organization.
- A project is created.
- A task is assigned.
- An asset is published.
- A review is approved.
- A production milestone is completed.

Implementing these workflows through direct service-to-service calls creates tight coupling, makes the system harder to evolve, and complicates testing.

The platform requires a mechanism that allows domains to communicate while remaining independent.

---

# Decision

StudioHub adopts an **event-driven architecture** based on **domain events**.

Business actions that are significant to other domains should publish events after a successful transaction.

Interested domains subscribe to these events and perform their own processing independently.

Events communicate **that something has happened**, not **what another service should do**.

---

# Event Flow

Typical workflow:

```text
API Request

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

Background Tasks / Services
```

Events are published **after** successful transaction commits to ensure consistency.

---

# Event Types

StudioHub distinguishes between several categories of events.

### Domain Events

Represent important business occurrences.

Examples:

- UserCreated
- OrganizationCreated
- ProjectCreated
- TaskAssigned
- AssetPublished
- ReviewApproved

---

### Application Events

Represent internal application workflows.

Examples:

- CacheInvalidated
- ReportGenerated
- ExportCompleted
- NotificationQueued

---

### Infrastructure Events

Represent operational changes.

Examples:

- DeploymentCompleted
- BackupFinished
- HealthCheckFailed

Infrastructure events are primarily used for monitoring and operations.

---

# Event Ownership

Each domain owns the events it publishes.

Example:

Identity publishes:

- UserCreated
- UserUpdated
- PasswordChanged

Organization publishes:

- OrganizationCreated
- TeamCreated
- MembershipAdded

Production publishes:

- ProjectCreated
- ShotCompleted
- TaskAssigned

Other domains consume these events through subscriptions rather than invoking internal implementations.

---

# Event Structure

Every event should include common metadata.

Example:

```text
Event ID
Event Type
Aggregate ID
Aggregate Type
Occurred At
Version
Correlation ID
Initiator
Payload
```

Standardized metadata improves traceability and observability.

---

# Event Publication

Only **services** may publish domain events.

Typical sequence:

```text
Validate

↓

Execute Business Logic

↓

Persist Changes

↓

Commit Transaction

↓

Publish Event
```

Events must not be published directly from:

- Models
- Serializers
- Views
- QuerySets
- Selectors

This keeps business workflows explicit and testable.

---

# Event Consumers

Subscribers may perform operations such as:

- Sending notifications
- Invalidating caches
- Triggering workflows
- Scheduling background jobs
- Updating search indexes
- Synchronizing integrations
- Recording audit information

Consumers should remain independent and idempotent.

---

# Synchronous vs Asynchronous Processing

### Synchronous

Used when:

- Immediate consistency is required
- Low latency is critical
- The operation is lightweight

### Asynchronous

Used when:

- Processing is time-consuming
- External integrations are involved
- Notifications are sent
- Reports are generated
- Media processing occurs

Asynchronous processing is preferred for non-blocking operations.

---

# Event Bus

The platform provides a centralized Event Bus abstraction responsible for:

- Event publication
- Subscriber registration
- Dispatching
- Observability
- Error handling

The implementation may evolve without changing domain logic.

---

# Reliability

Events should be:

- Idempotent
- Retryable
- Observable
- Versioned
- Traceable

Consumers should tolerate duplicate deliveries where appropriate.

---

# Rationale

An event-driven architecture provides:

- Loose coupling
- Independent domain evolution
- Better scalability
- Improved extensibility
- Simplified integrations
- Support for asynchronous processing
- Clear business event history

It aligns with the modular monolith architecture while allowing future evolution toward distributed systems if needed.

---

# Alternatives Considered

## Direct Service Calls

Advantages:

- Simple implementation

Disadvantages:

- Tight coupling
- Complex dependency graphs
- Difficult testing

Rejected.

---

## Django Signals

Advantages:

- Built-in framework support

Disadvantages:

- Implicit execution
- Difficult to trace
- Limited control over workflows
- Encourages hidden dependencies

Rejected for core business workflows. Signals may still be used for framework-level concerns.

---

## Message Broker Only

Advantages:

- Highly scalable

Disadvantages:

- Additional infrastructure
- Increased operational complexity
- Premature for current architecture

Deferred until required by scaling needs.

---

# Consequences

## Positive

- Decoupled domains
- Better extensibility
- Clear business events
- Easier integration
- Improved testability
- Supports asynchronous workflows

## Negative

- Additional infrastructure
- Event version management
- More complex debugging
- Requires idempotent consumers

The architectural flexibility gained outweighs the added complexity.

---

# Implementation Guidelines

- Publish events only after successful transactions.
- Keep event payloads focused on business facts.
- Avoid embedding business logic within event handlers.
- Prefer asynchronous processing for long-running tasks.
- Version events when introducing breaking changes.
- Monitor event processing and failures.

---

# Compliance

Architecture reviews should verify:

- Events are published from services.
- Domain ownership is respected.
- Consumers are idempotent.
- Transactions complete before publication.
- Event schemas remain stable and versioned.

Any deviations should be documented through future ADRs.

---

# Related ADRs

- ADR-0001 — Repository Structure
- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0004 — Domain-Driven Design
- ADR-0006 — Background Processing (Celery & Redis)

---

# References

- `docs/02-architecture/event-driven-architecture.md`
- `docs/03-backend/events.md`
- `docs/03-backend/tasks.md`
- `docs/06-infrastructure/messaging.md`
- `docs/13-roadmap/backend-roadmap.md`