# ADR-0002: Layered Architecture

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is an enterprise-scale production management platform designed to support multiple business domains, including Identity, Organization, Production, Assets, Pipeline, Review, and Reporting.

The platform must accommodate:

- Large engineering teams
- Long-term maintainability
- Complex business rules
- Independent domain evolution
- High testability
- Predictable code organization
- Reusable business logic

Traditional Django projects often place significant business logic inside models, views, or serializers, leading to tight coupling, poor separation of concerns, and reduced maintainability as applications grow.

A structured architecture is required to clearly separate responsibilities and enforce consistent development practices across all domains.

---

# Decision

StudioHub adopts a **layered architecture** in which each layer has a single, well-defined responsibility.

The backend architecture is organized as follows:

```text
Client

↓

API Layer
(ViewSets / Endpoints)

↓

Serializers

↓

Permissions

↓

Validators

↓

Services

↓

Selectors

↓

Managers

↓

QuerySets

↓

Models

↓

Database
```

Supporting layers include:

- Events
- Signals
- Tasks
- Caching
- Exceptions
- Utilities
- Constants
- Choices

Each layer may only depend on lower layers unless explicitly documented.

---

# Layer Responsibilities

## Models

Responsible for:

- Database schema
- Relationships
- Field definitions
- Minimal model behavior
- Metadata

Models should avoid complex business logic.

---

## QuerySets

Responsible for:

- Reusable query construction
- Filtering
- Annotation
- Optimization
- Common query patterns

QuerySets should never contain business workflows.

---

## Managers

Responsible for:

- Exposing reusable QuerySet operations
- Factory methods
- Default query behavior

Managers should remain thin wrappers around QuerySets.

---

## Selectors

Responsible for:

- Read operations
- Complex retrieval logic
- Reporting queries
- Optimized data access
- Aggregation

Selectors should not modify persistent state.

---

## Validators

Responsible for:

- Business validation
- Cross-field validation
- Cross-entity validation
- Domain rule enforcement

Validation should occur before persistence.

---

## Services

Responsible for:

- Business workflows
- Transactions
- State transitions
- Coordination across domains
- Event publication

Services own application business logic.

---

## Events

Responsible for:

- Domain event publication
- Loose coupling
- Workflow integration
- Asynchronous processing

Events improve extensibility while reducing direct dependencies.

---

## API Layer

Responsible for:

- HTTP transport
- Request parsing
- Authentication
- Authorization
- Serialization
- Response generation

The API layer should remain thin and delegate business logic to services.

---

# Dependency Rules

The following dependency flow is permitted:

```text
API
 ↓
Services
 ↓
Validators
 ↓
Selectors
 ↓
Managers
 ↓
QuerySets
 ↓
Models
```

Direct access that bypasses these boundaries should be avoided unless there is a documented architectural reason.

---

# Rationale

This architecture provides:

- Clear separation of concerns
- Consistent project organization
- High maintainability
- Improved testability
- Reduced coupling
- Better scalability
- Easier onboarding
- Predictable development patterns

It also aligns well with domain-driven design principles while remaining idiomatic to Django.

---

# Alternatives Considered

## Fat Models

Advantages:

- Familiar Django approach
- Fewer files

Disadvantages:

- Difficult to maintain
- Large model classes
- Tight coupling
- Poor test isolation

Rejected.

---

## Fat Views

Advantages:

- Simple for small applications

Disadvantages:

- Business logic tied to HTTP
- Difficult reuse
- Poor separation of concerns

Rejected.

---

## Service Layer Without Selectors

Advantages:

- Fewer abstractions

Disadvantages:

- Mixing read and write concerns
- Reduced query reuse
- More complex services

Rejected.

---

## Repository Pattern

Advantages:

- Strong abstraction

Disadvantages:

- Duplicates Django ORM capabilities
- Additional complexity
- Reduced developer familiarity

Rejected in favor of Django Managers, QuerySets, and Selectors.

---

# Consequences

## Positive

- Modular codebase
- Consistent structure
- Easier unit testing
- Better code reuse
- Improved scalability
- Explicit business workflows

## Negative

- More files
- Higher initial learning curve
- Requires architectural discipline
- Additional abstraction for simple features

The long-term maintainability benefits outweigh the added complexity.

---

# Implementation Notes

Every domain application should follow the same layered structure.

Business logic should not migrate into:

- Models
- Views
- Serializers
- Signals

Signals should remain infrastructure mechanisms rather than business workflow implementations.

Transactions should generally be managed by services.

Selectors should be the preferred mechanism for complex read operations.

---

# Compliance

Architecture reviews should verify:

- Business logic remains in services
- Queries are encapsulated in selectors
- Models remain lightweight
- Validation is centralized
- Layer boundaries are respected

Architectural deviations should be documented and justified.

---

# Related ADRs

- ADR-0001 — Repository Structure
- ADR-0003 — Service & Selector Pattern
- ADR-0004 — Domain-Driven Design
- ADR-0005 — Event-Driven Architecture
- ADR-0008 — API Design Principles

---

# References

- `docs/02-architecture/layered-architecture.md`
- `docs/03-backend/architecture.md`
- `docs/08-development/coding-standards.md`
- `docs/13-roadmap/backend-roadmap.md`