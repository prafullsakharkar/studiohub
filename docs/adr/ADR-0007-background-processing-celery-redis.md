# ADR-0007: Background Processing with Celery & Redis

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub performs numerous operations that should not block user-facing HTTP requests. Examples include sending notifications, processing media, generating reports, synchronizing with external systems, and executing scheduled maintenance.

Executing these tasks synchronously would increase request latency, reduce application responsiveness, and negatively impact user experience.

The platform requires a reliable asynchronous processing mechanism that integrates well with Django and supports future scaling.

---

# Decision

StudioHub adopts **Celery** as its background task processing framework and **Redis** as the primary message broker and caching layer.

This combination provides a mature, well-supported solution for asynchronous task execution within the Django ecosystem.

---

# Responsibilities

Background workers are responsible for:

- Email delivery
- Notification dispatch
- Report generation
- Scheduled maintenance
- Media processing
- Search index updates
- Cache invalidation
- Integration synchronization
- Long-running business workflows
- Periodic housekeeping

Tasks should be designed to execute independently of user requests.

---

# Architectural Flow

Typical asynchronous workflow:

```text
Client Request

↓

API

↓

Service

↓

Database Transaction

↓

Commit

↓

Publish Event

↓

Celery Task

↓

Worker

↓

External Service / Processing

↓

Completion
```

HTTP requests should return promptly while background processing continues independently.

---

# Redis Responsibilities

Redis is used for:

- Celery message broker
- Result backend (optional)
- Application caching
- Rate limiting
- Distributed locks (where appropriate)
- Temporary data
- Session storage (optional deployment configuration)

Redis should not be treated as the system of record for persistent business data.

---

# Task Design Principles

Background tasks should be:

- Idempotent
- Retryable
- Observable
- Independent
- Small in scope
- Well-documented

Large workflows should be decomposed into smaller, composable tasks.

---

# Retry Strategy

Tasks should implement controlled retry policies.

Typical retry conditions include:

- Temporary network failures
- Third-party service outages
- Rate limiting
- Transient infrastructure issues

Retries should use exponential backoff where appropriate.

Permanent business validation failures should not be retried automatically.

---

# Scheduling

Periodic tasks are managed through **Celery Beat**.

Examples include:

- Cleanup jobs
- Expired session removal
- Cache maintenance
- Scheduled reports
- Reminder notifications
- Data synchronization
- Health checks

Schedules should be configurable rather than hard-coded.

---

# Error Handling

Background workers should:

- Log failures
- Record metrics
- Retry transient failures
- Notify operators when necessary
- Preserve diagnostic information

Errors should not silently disappear.

---

# Monitoring

Operational monitoring should include:

- Queue depth
- Worker availability
- Task execution time
- Retry rates
- Failure rates
- Throughput
- Scheduled task execution

These metrics support proactive operational management.

---

# Scalability

The architecture supports:

- Multiple worker processes
- Dedicated task queues
- Queue prioritization
- Horizontal worker scaling
- Independent scaling of task types

Workers may be scaled independently of the web application.

---

# Security

Background processing should follow the same security principles as synchronous requests.

Tasks should:

- Validate inputs
- Avoid exposing sensitive data
- Use secure credentials
- Respect authorization boundaries
- Protect secrets through centralized secret management

---

# Alternatives Considered

## Django Background Threads

Advantages:

- Minimal setup

Disadvantages:

- Unreliable
- Difficult scaling
- Lost tasks on process restart

Rejected.

---

## Django Signals Only

Advantages:

- Built into Django

Disadvantages:

- Synchronous execution
- Hidden coupling
- Poor handling of long-running operations

Rejected for asynchronous workflows.

---

## External Workflow Engines

Advantages:

- Advanced orchestration

Disadvantages:

- Increased infrastructure complexity
- Additional operational overhead

Deferred until future scaling requirements justify adoption.

---

# Consequences

## Positive

- Responsive APIs
- Better user experience
- Independent worker scaling
- Reliable task execution
- Improved operational flexibility
- Mature ecosystem integration

## Negative

- Additional infrastructure
- Operational monitoring requirements
- Eventual consistency for asynchronous operations
- Increased debugging complexity

The advantages substantially outweigh the operational costs.

---

# Implementation Guidelines

- Keep tasks focused and composable.
- Publish tasks only after successful transactions.
- Avoid embedding business logic directly within task functions.
- Use services to coordinate business workflows.
- Monitor queue health continuously.
- Implement retries for transient failures.
- Document task ownership and responsibilities.

---

# Compliance

Architecture reviews should verify:

- Long-running operations are asynchronous.
- Tasks are idempotent where appropriate.
- Retry strategies are documented.
- Redis is not used as persistent storage.
- Monitoring covers queue and worker health.
- Task failures are observable and actionable.

---

# Related ADRs

- ADR-0001 — Repository Structure
- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0005 — Event-Driven Architecture
- ADR-0006 — PostgreSQL as the Primary Database
- ADR-0008 — API Design Principles

---

# References

- `docs/03-backend/tasks.md`
- `docs/06-infrastructure/redis.md`
- `docs/06-infrastructure/celery.md`
- `docs/11-operations/monitoring.md`
- `docs/13-roadmap/infrastructure-roadmap.md`