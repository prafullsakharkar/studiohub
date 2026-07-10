# Event System

## Overview

StudioHub uses an internal event-driven architecture to decouple business workflows from secondary processes. Domain events allow modules to notify other parts of the system that something important has happened without creating tight dependencies.

The Event System improves maintainability, extensibility, and supports asynchronous processing.

---

# Objectives

The Event System is designed to:

- Decouple business domains
- Publish domain events
- Trigger background processing
- Improve scalability
- Support auditing and notifications
- Enable workflow automation

---

# Event Flow

```text
Business Service
        │
        ▼
Domain Event
        │
        ▼
Event Bus
   ├──────────────┐
   ▼              ▼
Audit        Notification
   │              │
   ▼              ▼
Activity     Background Task
```

---

# Event Lifecycle

1. Business Service completes a successful operation.
2. A Domain Event is created.
3. The Event Bus publishes the event.
4. Subscribers react independently.
5. Business Service continues without waiting for subscribers.

---

# Event Types

Typical events include:

- UserCreatedEvent
- UserUpdatedEvent
- OrganizationCreatedEvent
- DepartmentArchivedEvent
- ProjectCreatedEvent
- TaskCompletedEvent
- VersionPublishedEvent

Each event represents a meaningful business occurrence.

---

# Event Components

## Domain Event

Represents an immutable business event.

Typical information:

- Event name
- Entity identifier
- Timestamp
- Actor
- Metadata

---

## Event Publisher

Business Services publish events after successful transactions.

Responsibilities:

- Construct event payload
- Publish to Event Bus
- Handle publishing failures

---

## Event Bus

The Event Bus distributes events to registered subscribers.

Responsibilities:

- Register handlers
- Dispatch events
- Isolate subscribers
- Support synchronous and asynchronous execution

---

## Event Subscribers

Subscribers perform secondary actions.

Examples:

- Audit logging
- Notifications
- Metrics collection
- Cache invalidation
- Search indexing
- Activity feeds
- Celery tasks

Subscribers should never modify the original business transaction.

---

# Event Processing

```text
Create Department
        │
DepartmentService
        │
DepartmentCreatedEvent
        │
Event Bus
   ├────────────┬────────────┐
   ▼            ▼            ▼
Audit      Notification   Analytics
```

---

# Transaction Boundary

Events should only be published after a successful database transaction.

```text
Begin Transaction
        │
Persist Data
        │
Commit
        │
Publish Event
```

This guarantees subscribers only receive committed changes.

---

# Best Practices

- Publish events for important business actions.
- Keep events immutable.
- Keep event payloads concise.
- Avoid business logic in subscribers.
- Prefer asynchronous processing for long-running tasks.
- Version event contracts when necessary.

---

# Anti-Patterns

- Publishing events before commit
- Embedding business workflows in subscribers
- Creating circular event chains
- Using events for simple method calls
- Mutating event payloads after publication

---

# Related Documents

- service-layer.md
- layered-architecture.md
- api-architecture.md
- database-design.md
