# ADR-0014: Soft Delete Strategy

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub manages long-lived production data that must remain available for auditing, historical reporting, workflow recovery, and compliance.

Business entities such as:

- Organizations
- Departments
- Teams
- Projects
- Shots
- Tasks
- Assets
- Reviews
- Users

should rarely be permanently removed.

Permanent deletion introduces several risks:

- Loss of audit history
- Broken foreign key relationships
- Inaccurate historical reports
- Irreversible user mistakes
- Compliance issues
- Difficulty recovering accidentally deleted records

The platform requires a deletion strategy that preserves business history while allowing users to remove entities from active operations.

---

# Decision

StudioHub adopts a **Soft Delete** strategy for business entities.

Instead of physically removing records from the database, entities are marked as deleted.

All business models inherit from the shared `SoftDeleteModel`.

Typical fields include:

```python
is_deleted
deleted_at
deleted_by
```

Deleted records remain in the database until explicitly purged through controlled administrative processes.

---

# Scope

Soft deletion applies to:

- Organizations
- Departments
- Teams
- Memberships
- Projects
- Sequences
- Shots
- Tasks
- Assets
- Reviews
- Notifications

Reference tables and immutable audit records may be exempt where appropriate.

---

# Delete Workflow

```text
Delete Request

↓

Authorization

↓

Business Validation

↓

Service

↓

Soft Delete

↓

Publish Event

↓

Audit Log
```

The database row is retained while becoming invisible to normal application queries.

---

# Query Behavior

Selectors and managers should exclude deleted records by default.

Example:

```python
Project.objects.active()

TaskSelector.list_active()

OrganizationSelector.get_by_uuid()
```

Administrative selectors may expose deleted records when explicitly requested.

---

# Restore Workflow

Soft-deleted entities may be restored if business rules permit.

Typical flow:

```text
Restore Request

↓

Authorization

↓

Validation

↓

Restore Entity

↓

Audit Event

↓

Domain Event
```

Restoration should preserve the original identifier and relationships.

---

# Cascade Behavior

Deleting a parent entity should not automatically remove child records.

Example:

```text
Organization

↓

Project

↓

Shot

↓

Task
```

Business rules determine whether child entities:

- Remain active
- Become inaccessible
- Are archived
- Are soft deleted

Automatic cascading should be avoided unless explicitly defined.

---

# Audit

Soft delete operations must generate audit records including:

- Deleted by
- Deleted at
- Entity type
- Entity identifier
- Reason (when provided)

Audit records remain immutable.

---

# Events

Soft delete operations publish domain events.

Examples:

- OrganizationDeleted
- ProjectArchived
- TaskDeleted
- AssetDeleted

Subscribers may perform:

- Cache invalidation
- Search index updates
- Notification cleanup
- Analytics updates

---

# Physical Deletion

Hard deletion is reserved for:

- Administrative maintenance
- Data retention expiry
- Legal requirements
- Test data cleanup

Hard delete operations require elevated privileges.

---

# Performance

Indexes should support efficient filtering.

Typical queries include:

```sql
WHERE is_deleted = FALSE
```

Frequently queried tables should index soft delete fields appropriately.

---

# Security

Soft-deleted records remain protected by:

- Authorization
- Tenant isolation
- Permission checks
- Audit logging

Deletion does not bypass access controls.

---

# Alternatives Considered

## Hard Delete

Advantages:

- Smaller database
- Simpler queries

Disadvantages:

- Permanent data loss
- Broken references
- No recovery
- Weak auditability

Rejected.

---

## Archive Tables

Advantages:

- Smaller operational tables

Disadvantages:

- Complex migrations
- Additional synchronization
- Increased maintenance

Deferred.

---

## Database Triggers

Advantages:

- Automatic behavior

Disadvantages:

- Hidden implementation
- Difficult testing
- Database-specific logic

Rejected.

---

# Consequences

## Positive

- Recoverable deletions
- Complete audit history
- Stable relationships
- Better compliance
- Improved operational safety

## Negative

- Larger tables
- Additional filtering
- Periodic cleanup requirements

These trade-offs are acceptable for enterprise systems.

---

# Implementation Guidelines

- Business models should inherit `SoftDeleteModel`.
- Services manage deletion workflows.
- Managers exclude deleted records by default.
- Selectors expose deleted data only when explicitly requested.
- Publish deletion events after successful transactions.
- Audit every delete and restore operation.

---

# Compliance

Architecture reviews should verify:

- No direct hard deletes in business services.
- Soft delete filters are consistently applied.
- Deleted records remain recoverable.
- Audit events are generated.
- Restore workflows preserve integrity.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0005 — Event-Driven Architecture
- ADR-0010 — Multi-Tenant Organization Model
- ADR-0011 — Audit Logging Strategy
- ADR-0013 — UUID Primary Key Strategy

---

# References

- `docs/03-backend/models.md`
- `docs/03-backend/services.md`
- `docs/03-backend/database.md`
- `docs/10-security/audit-logging.md`
- `docs/11-operations/backup-recovery.md`