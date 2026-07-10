# Events

## Overview

The Event system enables StudioHub's event-driven architecture by allowing business domains to communicate without creating direct dependencies.

Every significant business operation produces one or more Domain Events. These events are published by Services after successful transactions and are consumed by independent subscribers.

This architecture improves scalability, maintainability, and extensibility while reducing coupling between modules.

---

# Objectives

The Event layer is responsible for:

- Domain Event publishing
- Event dispatching
- Workflow automation
- Audit logging
- Notifications
- Background processing
- Analytics
- Cache invalidation
- Integration hooks

---

# Event Architecture

```text
Business Service
        │
        ▼
Domain Event
        │
        ▼
Event Bus
        │
 ┌──────┼─────────────┐
 ▼      ▼             ▼
Audit Notification Background Tasks
        │
        ▼
 External Integrations
```

---

# Event Lifecycle

```text
Client

↓

APIView

↓

Serializer

↓

Business Service

↓

Database Transaction

↓

Commit

↓

Publish Event

↓

Event Bus

↓

Subscribers
```

Events are always published **after** a successful transaction.

---

# Event Components

## Domain Event

Represents a business occurrence.

Example

```text
ProjectCreatedEvent
```

A Domain Event contains:

- Event Name
- Aggregate ID
- Entity Type
- Timestamp
- Actor
- Metadata

---

## Event Bus

Responsible for:

- Event registration
- Subscriber registration
- Event dispatching
- Event routing
- Error isolation

The Event Bus should remain independent from business domains.

---

## Event Publisher

Business Services publish events.

Example

```text
ProjectService

↓

ProjectCreatedEvent

↓

EventBus.publish()
```

---

## Event Subscriber

Subscribers react to events.

Examples

- AuditSubscriber
- NotificationSubscriber
- AnalyticsSubscriber
- SearchSubscriber
- CacheSubscriber

Subscribers execute independently of the originating service.

---

# Event Categories

## Identity Events

Examples

```text
UserCreated

UserUpdated

UserDeleted

LoginSucceeded

LoginFailed

PasswordChanged

RoleAssigned

PermissionGranted

MFAEnabled
```

---

## Organization Events

Examples

```text
OrganizationCreated

DepartmentCreated

DepartmentArchived

OfficeCreated

TeamCreated

MemberInvited

MembershipAdded
```

---

## Production Events

Examples

```text
ProjectCreated

SequenceCreated

ShotCreated

TaskAssigned

TaskCompleted

VersionSubmitted

ReviewApproved

PublishCreated
```

---

# Event Processing

Example

```text
Create Project

↓

ProjectService

↓

ProjectCreatedEvent

↓

Event Bus

↓

Audit

↓

Notification

↓

Analytics

↓

Cache

↓

Celery Task
```

Every subscriber operates independently.

---

# Synchronous vs Asynchronous Events

## Synchronous

Used for:

- Audit logging
- Cache invalidation
- Permission refresh

---

## Asynchronous

Handled through Celery.

Examples

- Email notifications
- Slack notifications
- Analytics
- Search indexing
- AI processing
- Pipeline integrations

---

# Event Payload

Typical payload

```json
{
    "event": "ProjectCreated",
    "entity": "Project",
    "entity_id": "UUID",
    "organization_id": "UUID",
    "performed_by": "UUID",
    "timestamp": "UTC",
    "metadata": {}
}
```

Payloads should remain immutable.

---

# Error Handling

Subscriber failures should never rollback completed business transactions.

Strategies include:

- Logging
- Retry policies
- Dead-letter queues
- Celery retries
- Monitoring

---

# Event Ordering

Events should preserve logical ordering.

Example

```text
ProjectCreated

↓

SequenceCreated

↓

ShotCreated

↓

TaskAssigned

↓

VersionSubmitted
```

Consumers should not assume unordered execution.

---

# Best Practices

- Publish events only after successful commits.
- Keep events immutable.
- Keep payloads lightweight.
- Use meaningful event names.
- Keep subscribers independent.
- Prefer asynchronous processing for long-running work.
- Version public event contracts.

---

# Anti-Patterns

Avoid:

- Publishing events before commit
- Business logic inside subscribers
- Circular event chains
- Large event payloads
- Direct subscriber dependencies
- Blocking API requests with slow subscribers

---

# Monitoring

Monitor:

- Published events
- Failed events
- Retry counts
- Queue depth
- Processing time
- Subscriber failures

These metrics help identify production bottlenecks.

---

# Testing

Event tests should verify:

- Event publication
- Payload correctness
- Subscriber execution
- Transaction boundaries
- Retry behavior
- Failure isolation

---

# Future Enhancements

Planned improvements include:

- Distributed Event Bus
- Event Replay
- Event Versioning
- Event Store
- Kafka Integration
- RabbitMQ Integration
- Webhook Support
- Third-party Pipeline Integrations

---

# Related Documents

- services.md
- authentication.md
- permissions.md
- core.md
- ../02-architecture/event-system.md
- ../02-architecture/service-layer.md
- ../02-architecture/api-architecture.md