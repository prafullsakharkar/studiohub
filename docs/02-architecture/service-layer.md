# Service Layer

## Overview

The Service Layer contains the business logic of StudioHub. Services orchestrate workflows, enforce business rules through validators, coordinate selectors and managers, publish domain events, and manage database transactions.

The Core module provides **generic, domain-agnostic infrastructure services** only. Business services belong in their domain applications (`apps/identity/`, `apps/organization/`, `apps/production/`, `apps/review/`).

---

## Responsibilities

- Execute business workflows (domain applications)
- Coordinate multiple models
- Manage transactions at the use-case boundary
- Invoke validators
- Publish domain events
- Call selectors for read-before-write operations
- Keep API views thin

---

## Service Flow

```text
APIView
   │
Serializer
   │
Application Service (use case)
 ├── Validator
 ├── Selector (read)
 ├── Manager / Model (write)
 └── Domain Events
```

---

## Core Infrastructure Services

Core provides generic infrastructure only. Each service is a focused, single-purpose class:

| Service | Responsibility |
| --- | --- |
| `BaseService` | Common hooks: `validate`, `publish_event`, `_publish_event`, `invalidate_cache` |
| `CRUDService` | Generic create / read / update / delete primitives |
| `AuditService` | Audit-aware create / update / delete |
| `LifecycleService` | Activate / deactivate / archive / draft state transitions |
| `EventService` | Publish domain events after create / update / delete |
| `CacheService` | Invalidate cache after create / update / delete |
| `SoftDeleteService` | Soft delete / restore |
| `MetadataService` | Set / remove / clear metadata |
| `PublishableService` | Publish / unpublish |
| `OrderingService` | Move up / down / to position |
| `SlugService` | Slug generation |
| `ColorService` | Color normalization |
| `SearchService` | Search helpers |
| `StorageService` | Storage helpers |
| `EmailService` | Email helpers |
| `NotificationService` | Notification helpers |

### BaseService Hooks

`BaseService` defines no-op hooks that subclasses may override. This guarantees that every service in the inheritance chain can safely call them without raising `AttributeError`:

- `publish_event(operation, **kwargs)` — public entry point that delegates to `_publish_event`.
- `_publish_event(operation, **kwargs)` — internal hook. `CRUDService` and `LifecycleService` override this to publish from their `event_map`.
- `invalidate_cache(instance)` — hook for cache invalidation. `CacheService` overrides this.

```python
class BaseService:
    @classmethod
    def publish_event(cls, operation, **kwargs):
        cls._publish_event(operation, **kwargs)

    @classmethod
    def _publish_event(cls, operation, **kwargs):
        return  # no-op by default

    @classmethod
    def invalidate_cache(cls, instance):
        return  # no-op by default
```

### BusinessService (deprecated)

`BusinessService` is a deprecated god-class kept only for backward compatibility. It composes `SoftDeleteMixin`, `LifecycleService`, and `CRUDService`:

```python
class BusinessService(SoftDeleteMixin, LifecycleService, CRUDService):
    """Deprecated. Prefer composing focused services."""
```

New domain services should inherit from the focused services they actually need rather than `BusinessService`.

---

## CRUD Pattern

### Create

1. Validate input
2. Check business rules
3. Persist entity
4. Publish created event

### Update

1. Load entity
2. Validate changes
3. Save
4. Publish updated event

### Delete

1. Verify constraints
2. Soft delete
3. Publish deleted event

---

## Transaction Management

Wrap write operations in database transactions to ensure consistency.

**Business mutations involving multiple records must use explicit `transaction.atomic()` at the application service / use-case boundary.** Do not hide business transactions inside models or QuerySets.

```text
Begin Transaction (use-case boundary)
      │
Validate
      │
Persist
      │
Publish Events
      │
Commit
```

Rollback on any failure. A failure in any `after_*` hook (e.g. `after_create`, `after_update`, `after_delete`) or during event publishing rolls back the entire transaction.

---

## Event Publishing

Services are responsible for raising domain events such as:

- UserCreated
- OrganizationUpdated
- DepartmentArchived

Subscribers perform auditing, notifications, analytics, and background processing.

Services publish events through the `publish_event` / `_publish_event` hooks. When a service defines an `event_map`, `_publish_event` publishes the mapped event via the `EventBus`. When no event is mapped, publishing is a no-op.

---

## Error Handling

Services should raise domain-specific exceptions instead of HTTP exceptions. API views convert these into appropriate HTTP responses.

---

## Best Practices

- Keep services focused on one business capability.
- Do not place business logic in views or models.
- Use selectors for reads.
- Use validators before writes.
- Publish events after successful transactions.
- Reuse services instead of duplicating workflows.
- Use `transaction.atomic()` explicitly at the use-case boundary for multi-record mutations.
- Prefer composing focused services over inheriting the deprecated `BusinessService`.

---

## Anti-Patterns

- Fat API views
- Business logic in serializers
- Direct model access from views
- Long transaction scopes
- Cross-domain model manipulation
- Hiding business transactions inside models or QuerySets
- Generic service factories or one-method service classes with no meaningful consumer
- Duplicate CRUD services

---

## Related Documents

- layered-architecture.md
- selector-pattern.md
- validator-pattern.md
- event-system.md
- api-architecture.md
