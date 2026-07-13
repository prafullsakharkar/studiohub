# ADR-0010: Multi-Tenant Organization Model

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is designed as a Software-as-a-Service (SaaS) platform for VFX, animation, game development, virtual production, advertising, and digital content studios.

A single deployment must support multiple independent organizations while ensuring complete data isolation, secure collaboration, and centralized platform administration.

Each organization operates independently with its own:

- Users
- Departments
- Offices
- Teams
- Projects
- Assets
- Reviews
- Reports
- Settings
- Business rules

The architecture must support both small studios and large enterprise organizations without requiring separate deployments.

---

# Decision

StudioHub adopts a **shared-database, shared-schema multi-tenant architecture** with **row-level tenant isolation**.

Every business entity belonging to a tenant is associated with an **Organization**.

The `Organization` entity is the primary business boundary for tenant isolation across the platform.

---

# Tenant Hierarchy

The logical ownership hierarchy is:

```text
Platform

↓

Organization

↓

Department

↓

Office

↓

Team

↓

Project

↓

Sequence

↓

Shot

↓

Task

↓

Asset

↓

Review
```

Each level inherits tenant ownership from its parent.

---

# Ownership Model

Every tenant-owned entity must reference its owning organization either directly or indirectly.

Examples:

```text
Organization
    ↓
Department
    ↓
Team
    ↓
Project
    ↓
Shot
```

This enables consistent authorization, filtering, reporting, and auditing.

---

# Shared Infrastructure

The following infrastructure is shared across tenants:

- Application servers
- PostgreSQL database
- Redis
- Celery workers
- Object storage
- Monitoring
- Logging
- CI/CD pipeline

Although infrastructure is shared, business data remains logically isolated.

---

# Tenant Isolation

Isolation is enforced at multiple layers:

- Authentication
- Authorization
- Selectors
- Services
- API permissions
- Business validators
- Reporting
- Background tasks

No single layer is solely responsible for tenant isolation.

---

# Data Access Rules

Users may only access:

- Their own organization
- Projects belonging to their organization
- Assets shared within their organization
- Reviews they are authorized to view
- Reports generated from authorized data

Cross-tenant access is prohibited unless explicitly supported by platform administration features.

---

# Organization-Owned Models

Most business entities inherit from a common organization-owned base model.

Typical behavior includes:

- Organization foreign key
- Tenant-aware selectors
- Organization-scoped queries
- Audit metadata
- Soft deletion
- Lifecycle support

This promotes consistency across domains.

---

# Platform-Level Models

Some entities exist outside tenant ownership.

Examples include:

- Global configuration
- Supported locales
- System feature flags
- Platform administrators
- Reference data
- License definitions

These models are managed by the platform rather than individual organizations.

---

# Authorization

Tenant boundaries are enforced before business validation.

Typical request flow:

```text
Authenticate

↓

Resolve Organization

↓

Verify Membership

↓

Verify Permission

↓

Verify Object Ownership

↓

Execute Business Logic
```

Authorization must never rely solely on client-provided identifiers.

---

# Query Strategy

Selectors must be tenant-aware by default.

Example:

```python
ProjectSelector.list_for_organization()

TaskSelector.list_assigned_to_user()

AssetSelector.search()
```

Queries should always constrain results to the requesting tenant unless explicitly documented otherwise.

---

# Event Handling

Domain events should include organization context where applicable.

Example metadata:

```text
Organization ID
Project ID
Aggregate ID
Correlation ID
Occurred At
```

Tenant context improves observability and supports downstream processing.

---

# Reporting

Reports should respect tenant boundaries.

Organizations should not be able to:

- View other organizations' metrics
- Access foreign assets
- Read unrelated production data
- Export unauthorized information

Platform administrators may access cross-tenant reporting where appropriate.

---

# Scalability

The shared-schema approach supports:

- Efficient resource utilization
- Simplified deployments
- Centralized upgrades
- Shared infrastructure
- Operational simplicity

If future requirements demand stronger isolation, the architecture allows migration toward schema-per-tenant or database-per-tenant strategies with controlled evolution.

---

# Alternatives Considered

## Database Per Tenant

Advantages:

- Strong isolation
- Independent backups
- Tenant-specific tuning

Disadvantages:

- Operational complexity
- Higher infrastructure costs
- Challenging migrations
- Reduced resource efficiency

Rejected for the current scale.

---

## Schema Per Tenant

Advantages:

- Improved isolation
- Shared database instance

Disadvantages:

- Complex migrations
- Large schema counts
- Operational overhead

Rejected.

---

## Shared Database Without Explicit Tenant Ownership

Advantages:

- Simpler implementation

Disadvantages:

- High risk of accidental data leakage
- Weak authorization boundaries
- Difficult auditing

Rejected.

---

# Consequences

## Positive

- Strong logical tenant isolation
- Efficient infrastructure utilization
- Simplified operations
- Consistent authorization
- Predictable query patterns
- Scalable domain model

## Negative

- Tenant filtering required across all layers
- Greater discipline required in query design
- Comprehensive testing needed to prevent cross-tenant access

The architectural benefits significantly outweigh these considerations.

---

# Implementation Guidelines

- Every tenant-owned entity must reference an organization directly or inherit organization ownership.
- Selectors should apply organization filters by default.
- Services must validate tenant ownership before modifying state.
- Background tasks should preserve organization context.
- APIs should never expose cross-tenant data unintentionally.
- Tests should include tenant isolation scenarios.

---

# Compliance

Architecture reviews should verify:

- Tenant ownership is explicit.
- Organization boundaries are respected.
- Selectors are tenant-aware.
- Authorization enforces organization membership.
- Reports and exports remain tenant-scoped.
- Background processing preserves tenant context.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0004 — Domain-Driven Design
- ADR-0009 — Authentication & Authorization Strategy
- ADR-0011 — Audit Logging Strategy
- ADR-0012 — File & Asset Storage Strategy

---

# References

- `docs/02-architecture/multi-tenancy.md`
- `docs/03-backend/organization.md`
- `docs/03-backend/production.md`
- `docs/10-security/access-control.md`
- `docs/13-roadmap/backend-roadmap.md`