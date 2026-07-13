# ADR-0003: Service & Selector Pattern

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is built using Django and Django REST Framework, where the default architectural style often places business logic across models, serializers, viewsets, managers, and signals. While suitable for small projects, this approach becomes increasingly difficult to maintain in a large enterprise platform with multiple domains and engineering teams.

StudioHub includes domains such as:

- Identity
- Organization
- Production
- Assets
- Pipeline
- Review
- Reporting

These domains require:

- Complex business workflows
- Reusable business operations
- Read/write separation
- Consistent transaction management
- High testability
- Minimal coupling
- Predictable architecture

A clear separation between read operations and write operations is required to prevent service classes from becoming overly complex and to improve query reuse.

---

# Decision

StudioHub adopts the **Service & Selector Pattern**.

Business operations are divided into two primary layers:

- **Selectors** — Responsible for read-only operations.
- **Services** — Responsible for commands that modify system state.

This separation follows the **Command Query Responsibility Segregation (CQRS)** principle at the application layer without introducing full CQRS infrastructure.

---

# Architectural Flow

```text
HTTP Request

↓

ViewSet

↓

Serializer

↓

Permission

↓

Validator

↓

Service

↓

Selector (when required)

↓

Manager

↓

QuerySet

↓

Model

↓

Database
```

For read-only operations:

```text
HTTP Request

↓

ViewSet

↓

Selector

↓

QuerySet

↓

Database
```

Read operations should not invoke services unless a business workflow explicitly requires it.

---

# Responsibilities

## Selectors

Selectors encapsulate all read-oriented business queries.

Typical responsibilities include:

- Fetching entities
- Searching
- Filtering
- Aggregation
- Reporting queries
- Dashboard data
- Optimized joins
- Read caching

Selectors must not:

- Modify data
- Trigger side effects
- Publish events
- Start business workflows

Selectors should be deterministic and idempotent.

---

## Services

Services encapsulate write-oriented business workflows.

Typical responsibilities include:

- Create operations
- Update operations
- Delete operations
- Lifecycle transitions
- Business transactions
- Cross-domain orchestration
- Event publication
- Audit updates

Services coordinate business logic while maintaining transactional integrity.

---

# Transaction Management

Services are responsible for transaction boundaries.

Example responsibilities include:

- Opening database transactions
- Coordinating multiple repositories or models
- Rolling back on failure
- Publishing events after successful commits

Selectors should never manage transactions because they do not modify persistent state.

---

# Validation

Business validation should occur before persistence.

The typical execution order is:

```text
Request

↓

Serializer Validation

↓

Business Validator

↓

Service

↓

Persistence
```

This keeps validation reusable across APIs, background jobs, and automation workflows.

---

# Event Publication

Only services may publish domain events.

Typical events include:

- UserCreated
- OrganizationCreated
- ProjectArchived
- TaskAssigned
- AssetPublished

Selectors must never publish events.

---

# Rationale

Separating read and write responsibilities provides:

- Smaller classes
- Better readability
- Improved testability
- Reusable query logic
- Cleaner transaction handling
- Reduced coupling
- Easier performance optimization
- Clear ownership of business workflows

The pattern aligns well with enterprise application architecture while remaining compatible with Django's ORM.

---

# Alternatives Considered

## Business Logic in Models

Advantages:

- Traditional Django approach
- Fewer classes

Disadvantages:

- Fat models
- Poor separation of concerns
- Difficult testing

Rejected.

---

## Business Logic in ViewSets

Advantages:

- Simpler examples

Disadvantages:

- HTTP-specific logic mixed with business rules
- Difficult reuse
- Tight coupling

Rejected.

---

## Repository Pattern

Advantages:

- Strong abstraction

Disadvantages:

- Overlaps with Django Managers and QuerySets
- Additional maintenance burden
- Reduced ORM flexibility

Rejected.

---

## Full CQRS

Advantages:

- Complete read/write separation
- Independent scaling

Disadvantages:

- Significant complexity
- Additional infrastructure
- Event sourcing considerations

Rejected because the added complexity outweighs the benefits for the current project scope.

---

# Consequences

## Positive

- Predictable code organization
- Clear read/write separation
- Smaller service classes
- Better reuse of queries
- Easier unit testing
- Simplified performance tuning
- Explicit transaction ownership

## Negative

- Additional files
- More abstractions
- Higher onboarding effort for new developers

The long-term maintainability benefits justify the additional structure.

---

# Implementation Guidelines

### Selector Naming

Examples:

```text
UserSelector
OrganizationSelector
ProjectSelector
TaskSelector
AssetSelector
```

Methods should clearly describe retrieval intent.

Examples:

```python
get_by_id()

get_by_uuid()

list_active()

search()

get_dashboard_metrics()
```

---

### Service Naming

Examples:

```text
UserService
OrganizationService
ProjectService
TaskService
AssetService
```

Methods should describe business actions.

Examples:

```python
create()

update()

archive()

restore()

assign()

publish()

approve()
```

---

# Compliance

Architecture reviews should verify:

- Read logic resides in selectors.
- Write logic resides in services.
- Transactions are managed by services.
- Selectors remain side-effect free.
- Event publication occurs only within services.

Exceptions should be documented through additional ADRs where appropriate.

---

# Related ADRs

- ADR-0001 — Repository Structure
- ADR-0002 — Layered Architecture
- ADR-0004 — Domain-Driven Design
- ADR-0005 — Event-Driven Architecture
- ADR-0006 — PostgreSQL as Primary Database

---

# References

- `docs/02-architecture/layered-architecture.md`
- `docs/03-backend/services.md`
- `docs/03-backend/selectors.md`
- `docs/08-development/coding-standards.md`
- `docs/13-roadmap/backend-roadmap.md`