# ADR-0016: Validation Architecture

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub contains complex business rules spanning multiple domains, including:

- Identity
- Organization
- Production
- Assets
- Reviews
- Pipeline
- Notifications

Validation occurs in many contexts:

- REST API requests
- Background tasks
- Scheduled jobs
- Data imports
- CLI commands
- Internal services
- Automated workflows

Placing business validation inside serializers, models, or views creates duplicated logic, inconsistent behavior, and makes validation difficult to reuse outside HTTP requests.

The platform requires a centralized validation architecture that separates transport validation from business validation.

---

# Decision

StudioHub adopts a **dedicated validator layer** responsible for enforcing business rules.

Validation responsibilities are divided into three categories:

1. **Transport Validation**
2. **Business Validation**
3. **Database Validation**

Each category has a clearly defined responsibility.

---

# Validation Layers

```text
Client

↓

Serializer
(Transport Validation)

↓

Service

↓

Validator
(Business Validation)

↓

Model / Database
(Integrity Validation)

↓

Persist
```

Each layer validates only the concerns it owns.

---

# Transport Validation

Transport validation ensures incoming requests are structurally valid.

Examples include:

- Required fields
- Field types
- String lengths
- Email format
- UUID format
- Choice validation
- Nested payload structure

Transport validation is implemented using Django REST Framework serializers.

Serializers should not contain business rules.

---

# Business Validation

Business validation enforces domain-specific rules.

Examples:

- Organization code uniqueness
- Project state transitions
- Task assignment rules
- Asset publishing constraints
- Membership eligibility
- Permission checks
- Production scheduling rules

Business validation is implemented in dedicated validator classes located within each domain.

Example structure:

```text
organization/
└── validators/
    ├── base.py
    ├── organization.py
    ├── department.py
    ├── office.py
    └── membership.py
```

---

# Database Validation

Database validation protects data integrity.

Examples include:

- Foreign keys
- Unique constraints
- Check constraints
- Non-null fields
- Database indexes

These validations are the final safeguard and should not replace application-level validation.

---

# Validator Responsibilities

Validators may perform:

- Cross-field validation
- Cross-entity validation
- Organization boundary checks
- Workflow validation
- Lifecycle validation
- Permission-related validation
- Referential validation

Validators should not perform persistence or side effects.

---

# Service Integration

Services coordinate validation before executing business logic.

Typical workflow:

```text
Request

↓

Serializer

↓

Service

↓

Validator

↓

Database Transaction

↓

Events

↓

Response
```

Services remain responsible for orchestration, while validators encapsulate business rules.

---

# Reusability

Dedicated validators can be reused across:

- REST APIs
- Celery tasks
- Management commands
- Scheduled jobs
- GraphQL APIs (future)
- Integration services

This prevents duplicated validation logic.

---

# Error Reporting

Validators should raise structured domain exceptions.

Errors should:

- Be deterministic
- Provide actionable messages
- Support localization where applicable
- Avoid exposing internal implementation details

API responses should translate validation failures into consistent client-facing error formats.

---

# Cross-Domain Validation

When validation requires information from another domain, validators should use that domain's public interfaces, such as selectors or services.

Example:

```text
Organization Validator

↓

Organization Selector

↓

Identity Selector

↓

Membership Check
```

Validators should not directly access another domain's internal implementation.

---

# Performance

Validation should:

- Avoid unnecessary database queries
- Use selectors for read operations
- Batch lookups where practical
- Reuse cached reference data when appropriate

Expensive validations should be measured and optimized.

---

# Testing

Validators should be unit tested independently from:

- Views
- Serializers
- Services

Testing should include:

- Valid input
- Invalid input
- Edge cases
- Permission scenarios
- Tenant isolation
- Workflow transitions

---

# Security

Validation contributes to platform security by preventing:

- Cross-tenant access
- Invalid workflow transitions
- Unauthorized operations
- Data corruption
- Business rule violations

Validation complements authentication and authorization but does not replace them.

---

# Alternatives Considered

## Validation in Serializers

Advantages:

- Familiar DRF pattern
- Simple CRUD applications

Disadvantages:

- HTTP-specific
- Difficult reuse
- Business logic leakage
- Large serializer classes

Rejected.

---

## Validation in Models

Advantages:

- Close to persistence

Disadvantages:

- Limited context
- Poor orchestration
- Difficult cross-domain validation
- Harder testing

Rejected.

---

## Validation in Services Only

Advantages:

- Fewer classes

Disadvantages:

- Large service classes
- Mixed responsibilities
- Reduced reusability

Rejected.

---

# Consequences

## Positive

- Clear separation of concerns
- Reusable business rules
- Improved testability
- Consistent validation
- Better maintainability
- Domain-focused validation logic

## Negative

- Additional classes
- Slightly more boilerplate
- Developers must understand validation layers

These trade-offs support long-term maintainability and scalability.

---

# Implementation Guidelines

- Use serializers for transport validation only.
- Place business rules in dedicated validators.
- Keep validators free of persistence logic.
- Let services orchestrate validation and workflows.
- Raise structured domain exceptions.
- Unit test validators independently.

---

# Compliance

Architecture reviews should verify:

- Business rules are not embedded in serializers.
- Validators remain domain-specific.
- Services orchestrate rather than implement validation logic.
- Cross-domain validation uses public interfaces.
- Validation is consistently tested.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0004 — Domain-Driven Design
- ADR-0008 — API Design Principles
- ADR-0009 — Authentication & Authorization Strategy
- ADR-0010 — Multi-Tenant Organization Model

---

# References

- `docs/03-backend/validators.md`
- `docs/03-backend/services.md`
- `docs/03-backend/selectors.md`
- `docs/05-api/error-handling.md`
- `docs/08-development/coding-standards.md`