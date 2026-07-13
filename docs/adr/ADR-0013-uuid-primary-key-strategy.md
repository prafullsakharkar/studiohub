# ADR-0013: UUID Primary Key Strategy

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is a multi-tenant, enterprise production management platform designed for distributed teams, integrations, and cloud-native deployments.

Most business entities are exposed through:

- REST APIs
- Background workers
- Import/export pipelines
- Third-party integrations
- Audit logs
- Event payloads
- Cross-system synchronization

Using sequential integer primary keys creates several challenges:

- Predictable identifiers
- Enumeration attacks
- Difficult cross-system merging
- Poor offline object creation
- Complex distributed synchronization

The platform requires globally unique identifiers that remain stable across environments and deployments.

---

# Decision

StudioHub adopts **UUIDs (Universally Unique Identifiers)** as the primary identifier for all business entities.

All domain models inherit from the shared `UUIDModel`, which provides a UUID primary key.

Example:

```python
class Organization(UUIDModel):
    ...
```

UUIDs are the canonical identifiers used throughout the platform.

---

# Scope

UUID primary keys are used for:

- Users
- Organizations
- Departments
- Teams
- Projects
- Sequences
- Shots
- Tasks
- Assets
- Reviews
- Notifications
- Audit records

New business entities should adopt UUIDs unless a documented exception exists.

---

# Why UUIDs

UUIDs provide:

- Global uniqueness
- Distributed generation
- Non-sequential identifiers
- Better API security
- Easier data migration
- Cross-system compatibility
- Offline object creation

They eliminate dependence on database-generated integer sequences.

---

# Security

Sequential integer IDs expose information such as:

```text
/users/1
/users/2
/users/3
```

This makes enumeration attacks straightforward.

UUIDs reduce this risk by using non-predictable identifiers:

```text
/users/7d79d3a6-f5b0-4e63-9f76-4b2db4d4e7b1
```

While UUIDs are not an authorization mechanism, they reduce accidental disclosure through identifier guessing.

---

# API Design

Public APIs expose UUIDs rather than internal database sequences.

Example:

```text
GET /api/v1/projects/{uuid}
```

UUIDs remain stable regardless of database implementation details.

---

# Distributed Systems

UUIDs simplify:

- Import/export
- Data synchronization
- Multi-region deployments
- Offline processing
- Future microservice evolution
- Event correlation

Objects can be created independently without requiring centralized ID allocation.

---

# Database Considerations

UUIDs require:

- Proper indexing
- Native UUID column types
- Efficient query planning

PostgreSQL provides native support for UUID data types and indexing.

Performance differences are acceptable for the scale and security requirements of StudioHub.

---

# Human-Friendly Identifiers

UUIDs are not intended for human communication.

Business-facing entities may additionally include readable identifiers such as:

- Organization code
- Project code
- Shot code
- Asset code
- Task number

Examples:

```text
ORG-001

PRJ-2026-015

SHOT-010

AST-CHAR-024
```

These identifiers complement UUIDs rather than replacing them.

---

# Logging

Audit logs and domain events should include UUIDs to ensure global uniqueness and reliable cross-system correlation.

Correlation IDs and request IDs remain separate identifiers used for tracing request lifecycles.

---

# Migration Strategy

Existing entities using UUIDs require no migration.

Future entities should inherit from `UUIDModel` unless an ADR explicitly documents an alternative.

Changing identifier strategies after deployment is strongly discouraged.

---

# Alternatives Considered

## Auto-Increment Integer IDs

Advantages:

- Smaller indexes
- Familiar implementation
- Slightly better insert performance

Disadvantages:

- Predictable identifiers
- Harder data merging
- Distributed system limitations
- Enumeration risks

Rejected.

---

## Composite Keys

Advantages:

- Encodes business meaning

Disadvantages:

- Complex relationships
- Difficult ORM integration
- Poor flexibility

Rejected.

---

## ULID

Advantages:

- Sortable
- Human-friendly

Disadvantages:

- Additional implementation complexity
- Less mature ecosystem support

Deferred for future evaluation.

---

# Consequences

## Positive

- Globally unique identifiers
- Improved API security
- Better interoperability
- Easier synchronization
- Simplified distributed workflows
- Consistent identifier strategy

## Negative

- Larger indexes
- Less human-readable
- Slight storage overhead
- Minor performance impact for inserts

These trade-offs are acceptable given the platform's enterprise requirements.

---

# Implementation Guidelines

- Use UUIDs as primary keys for all business entities.
- Expose UUIDs through public APIs.
- Use business codes for human-readable references.
- Index UUID columns appropriately.
- Avoid exposing internal database implementation details.

---

# Compliance

Architecture reviews should verify:

- New entities inherit from `UUIDModel`.
- Public APIs use UUIDs.
- Business codes remain separate from primary keys.
- UUID usage is consistent across domains.
- Database indexes support efficient UUID lookups.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0006 — PostgreSQL as the Primary Database
- ADR-0008 — API Design Principles
- ADR-0010 — Multi-Tenant Organization Model
- ADR-0011 — Audit Logging Strategy

---

# References

- `docs/03-backend/models.md`
- `docs/03-backend/database.md`
- `docs/05-api/resource-identifiers.md`
- `docs/08-development/coding-standards.md`
- `docs/13-roadmap/backend-roadmap.md`