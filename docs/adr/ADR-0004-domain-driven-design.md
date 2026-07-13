# ADR-0004: Domain-Driven Design (DDD)

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is an enterprise-grade production management platform that supports the complete lifecycle of VFX, animation, game development, virtual production, and digital content creation.

The platform spans multiple business capabilities, including:

- Identity & Access Management
- Organization Management
- Production Planning
- Asset Management
- Pipeline Automation
- Review & Approval
- Reporting & Analytics
- Notifications
- AI & Automation

As the platform grows, a monolithic business model with shared logic across unrelated modules would increase coupling, reduce maintainability, and make parallel development difficult.

A domain-oriented architecture is required to support independent evolution of business capabilities while maintaining a coherent system.

---

# Decision

StudioHub adopts **Domain-Driven Design (DDD)** principles to organize the backend into well-defined business domains.

Each domain encapsulates:

- Its own data model
- Business rules
- Services
- Selectors
- Validators
- Events
- API layer
- Permissions
- Tests

Domains communicate through explicit interfaces and domain events rather than direct implementation dependencies.

---

# Domain Structure

Each business domain is implemented as an independent Django application.

```text
backend/apps/

core/
identity/
organization/
production/
assets/
pipeline/
review/
reporting/
notifications/
automation/
```

Each domain owns its business logic and persistence concerns.

---

# Layered Domain Organization

A typical domain follows a consistent internal structure:

```text
domain/
├── admin/
├── api/
├── choices/
├── constants/
├── events/
├── exceptions/
├── managers/
├── migrations/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── signals/
├── tasks/
├── tests/
├── urls.py
├── utils/
└── validators/
```

This standardized layout improves discoverability and consistency across domains.

---

# Bounded Contexts

Each domain represents a **bounded context** with its own ubiquitous language and business rules.

Examples:

### Identity

Owns:

- Users
- Roles
- Permissions
- Authentication
- MFA
- Sessions

---

### Organization

Owns:

- Organizations
- Departments
- Teams
- Offices
- Memberships
- Positions

---

### Production

Owns:

- Projects
- Episodes
- Sequences
- Shots
- Tasks
- Schedules

---

### Assets

Owns:

- Assets
- Versions
- Metadata
- Categories
- Publishing

Each bounded context is responsible for maintaining the integrity of its own data and workflows.

---

# Shared Kernel

The `core` application acts as the shared kernel.

It provides reusable infrastructure such as:

- Base models
- Common managers
- QuerySets
- Abstract services
- Validators
- Event infrastructure
- Utilities
- Shared exceptions

The shared kernel should contain technical infrastructure rather than business-specific functionality.

---

# Domain Communication

Domains should communicate through:

- Public services
- Selectors
- Domain events
- Stable interfaces

Direct access to another domain's internal implementation should be avoided.

Example:

```text
Production

↓

OrganizationSelector

↓

Organization Domain
```

Instead of querying another domain's internal models directly, consumers should use the owning domain's public interfaces.

---

# Domain Events

Cross-domain workflows should be coordinated using domain events where appropriate.

Examples:

- UserCreated
- OrganizationCreated
- ProjectArchived
- AssetPublished
- ReviewApproved

Events reduce coupling and improve extensibility.

---

# Rationale

Applying DDD principles provides:

- Clear ownership boundaries
- Improved maintainability
- Independent domain evolution
- Better scalability
- Easier onboarding
- Reduced coupling
- Consistent business language
- Support for parallel development teams

DDD aligns well with StudioHub's long-term product vision and modular architecture.

---

# Alternatives Considered

## Single Application

Advantages:

- Simpler initial setup

Disadvantages:

- Tight coupling
- Difficult maintenance
- Poor scalability

Rejected.

---

## Layer-Based Packages Only

Advantages:

- Familiar structure

Disadvantages:

- Business logic scattered across unrelated packages
- Weak domain boundaries

Rejected.

---

## Microservices

Advantages:

- Independent deployment
- Independent scaling

Disadvantages:

- Operational complexity
- Distributed transactions
- Increased infrastructure overhead

Rejected for the current stage of the project. A modular monolith provides a better balance of simplicity and scalability.

---

# Consequences

## Positive

- Strong domain boundaries
- High cohesion
- Low coupling
- Easier testing
- Better code ownership
- Scalable architecture
- Simplified future extraction to services if required

## Negative

- More applications
- Additional organizational overhead
- Requires architectural discipline

The long-term benefits outweigh the additional structure.

---

# Implementation Guidelines

- Every business capability should belong to exactly one domain.
- Shared business logic should not be duplicated across domains.
- Cross-domain interactions should occur through public interfaces.
- Avoid circular dependencies between domains.
- Keep the `core` application free of business-specific rules.

Architecture reviews should verify compliance with these principles.

---

# Compliance

Architecture reviews should ensure:

- Clear domain ownership
- Respect for bounded contexts
- No cross-domain implementation leakage
- Stable public interfaces
- Proper use of domain events
- Minimal coupling

Architectural exceptions should be documented through additional ADRs.

---

# Related ADRs

- ADR-0001 — Repository Structure
- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0005 — Event-Driven Architecture
- ADR-0008 — API Design Principles

---

# References

- `docs/02-architecture/domain-model.md`
- `docs/02-architecture/layered-architecture.md`
- `docs/03-backend/overview.md`
- `docs/08-development/project-structure.md`
- `docs/13-roadmap/backend-roadmap.md`