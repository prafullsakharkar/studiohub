# Service Layer

## Overview

The Service Layer contains the business logic of StudioHub. Services orchestrate workflows, enforce business rules through validators, coordinate selectors and managers, publish domain events, and manage database transactions.

---

## Responsibilities

- Execute business workflows
- Coordinate multiple models
- Manage transactions
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
Business Service
 ├── Validator
 ├── Selector
 ├── Manager / Model
 └── Domain Events
```

---

## Base Business Service

All domain services should inherit from a common base service supplied by the Core module.

Typical responsibilities:

- Validation
- Transaction management
- Audit updates
- Event publishing
- Cache invalidation
- Error handling

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

```text
Begin Transaction
      │
Validate
      │
Persist
      │
Publish Events
      │
Commit
```

Rollback on any failure.

---

## Event Publishing

Services are responsible for raising domain events such as:

- UserCreated
- OrganizationUpdated
- DepartmentArchived

Subscribers perform auditing, notifications, analytics, and background processing.

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

---

## Anti-Patterns

- Fat API views
- Business logic in serializers
- Direct model access from views
- Long transaction scopes
- Cross-domain model manipulation

---

## Related Documents

- layered-architecture.md
- selector-pattern.md
- validator-pattern.md
- event-system.md
- api-architecture.md
