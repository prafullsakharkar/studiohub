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

# Ownership

The event architecture follows a strict ownership boundary:

- **Core owns EVENT INFRASTRUCTURE** — the event base class, event typing, event bus, publisher, dispatcher, registry, subscriber, handler, autodiscovery, event exceptions, and generic event utilities live in `apps/core/events/`.
- **Domain apps own DOMAIN EVENTS** — concrete events such as `ProjectCreated`, `ShotStatusChanged`, `TaskAssigned`, `AssetPublished`, and `VersionApproved` are defined in their owning domain app (e.g. `apps/production/events/`, `apps/assets/events/`, `apps/review/events/`). They are never defined in Core.

This keeps Core free of domain knowledge while providing a single, consistent event mechanism for every app.

---

# Event Flow

```text
Domain Service
        │
        ▼
Domain Event
        │
        ▼
Event Bus (publish)
        │
        ▼
Dispatcher
        │
        ▼
Subscribers / Handlers
   ├──────────────┐
   ▼              ▼
Audit        Notification
   │              │
   ▼              ▼
Activity     Background Task
```

---

# Event Lifecycle

1. A Domain Service completes a successful operation.
2. A Domain Event is created (an immutable dataclass instance).
3. The Event Bus publishes the event via the Dispatcher.
4. The Dispatcher resolves registered handlers from the Registry.
5. Each handler reacts independently; failures are isolated.
6. The Domain Service continues without waiting for subscribers.

---

# Event Types

Concrete domain events are defined in their owning domain app. Typical events include:

- `ProjectCreatedEvent` (production)
- `ShotStatusChangedEvent` (production)
- `TaskAssignedEvent` (production)
- `AssetPublishedEvent` (assets)
- `VersionApprovedEvent` (review)

Each event represents a meaningful business occurrence and carries a stable `event_type` string.

---

# Event Components

## Domain Event (`apps/core/events/base.py`)

`DomainEvent` is an immutable, frozen dataclass that all domain events inherit from.

Typical information:

- `event_id` — UUID, auto-generated
- `occurred_at` — UTC timestamp, auto-generated
- `version` — event contract version
- `source` — event source (defaults to `SERVICE`)
- `event_type` — stable identifier

The `event_type` property resolves to the subclass `event_type` class attribute when declared (e.g. `event_type = "production.project.created"`), otherwise it falls back to the class name. Every event remains addressable.

## Event Publisher (`apps/core/events/publisher.py`)

Business Services publish events after successful operations.

```python
from apps.core.events import publish

publish(ProjectCreatedEvent(project_id=project.id))
```

Responsibilities:

- Construct the event payload
- Publish to the Event Bus
- Optionally defer dispatch until the surrounding transaction commits (`on_commit=True`)

## Event Bus (`apps/core/events/bus.py`)

`EventBus` is the central entry point. It owns a `Registry` and a `Dispatcher`. `publish` and `subscribe` are classmethods that operate on the module-level `default_event_bus` singleton.

```python
from apps.core.events import EventBus

EventBus.publish(event)                 # dispatch immediately
EventBus.publish(event, on_commit=True) # dispatch after commit
EventBus.subscribe(SomeEvent, SomeHandler)
```

Responsibilities:

- Register handlers
- Dispatch events
- Isolate subscribers
- Support synchronous and transaction-safe execution

## Event Registry (`apps/core/events/registry.py`)

`EventRegistry` maps event types to handler classes. It supports `register`, `unregister`, `handlers_for`, and `clear`.

## Event Dispatcher (`apps/core/events/dispatcher.py`)

`EventDispatcher` resolves handlers from the registry and executes them.

- **Immediate dispatch** — handlers run synchronously when the event is published.
- **Transaction-safe dispatch** — when `on_commit=True` and a transaction is active, dispatch is deferred via `transaction.on_commit(...)`, so handlers only run if the surrounding transaction commits. This avoids publishing events for transactions that later roll back.
- **Error isolation** — if one handler raises, the remaining handlers still run. The first error is collected and re-raised as an `EventDispatchError` after all handlers have executed.

## Event Subscribers / Handlers (`apps/core/events/handlers.py`)

`DomainEventHandler` is the abstract base class for handlers. Subscribers perform secondary actions.

Examples:

- Audit logging
- Notifications
- Metrics collection
- Cache invalidation
- Search indexing
- Activity feeds
- Celery tasks

Subscribers should never modify the original business transaction.

## Autodiscovery (`apps/core/events/autodiscover.py`)

`autodiscover_events()` imports `{app}.events` and `{app}.handlers` for every installed app and calls each module's `register_events()` function when present. This is invoked from `CoreConfig.ready()`.

---

# Event Processing

```text
Create Department
        │
DepartmentService
        │
DepartmentCreatedEvent
        │
Event Bus (publish)
        │
Dispatcher
   ├────────────┬────────────┐
   ▼            ▼            ▼
Audit      Notification   Analytics
```

---

# Transaction Boundary

Events that depend on committed database state must be published with `on_commit=True`. This guarantees subscribers only receive committed changes and that events are not published for transactions that later roll back.

```text
Begin Transaction
        │
Persist Data
        │
Commit
        │
Dispatch Event (on_commit)
```

When no transaction is active, `on_commit=True` dispatches immediately.

---

# Best Practices

- Publish events for important business actions.
- Keep events immutable (frozen dataclasses).
- Keep event payloads concise.
- Avoid business logic in subscribers.
- Use `on_commit=True` for events that depend on committed DB state.
- Prefer asynchronous processing for long-running tasks.
- Version event contracts when necessary.
- Declare a stable `event_type` on every concrete event.

---

# Anti-Patterns

- Publishing events before commit without `on_commit`
- Embedding business workflows in subscribers
- Creating circular event chains
- Using events for simple method calls
- Mutating event payloads after publication
- Defining domain events in Core
- Maintaining duplicate event mechanisms (e.g. a separate service-layer event/cache mechanism)

---

# Related Documents

- service-layer.md
- layered-architecture.md
- api-architecture.md
- database-design.md
- ADR-0005-event-driven-architecture.md
- ADR-0018-event-bus-architecture.md
