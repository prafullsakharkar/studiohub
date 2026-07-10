# Clean Architecture

## Overview

StudioHub applies Clean Architecture to separate business rules from frameworks and infrastructure. Each layer has a single responsibility and dependencies always point inward toward the business domain.

---

# Architectural Principles

- Independent business logic
- Framework-agnostic services
- Explicit dependencies
- High testability
- Separation of concerns

---

# Layer Diagram

```text
┌──────────────────────────────┐
│           Client             │
└──────────────┬───────────────┘
               │
        API Views / Endpoints
               │
         Serializers (DTO)
               │
        Business Services
               │
          Validators
               │
           Selectors
               │
     Managers / QuerySets
               │
             Models
               │
          PostgreSQL
```

---

# Layer Responsibilities

## API Layer

Responsibilities:

- HTTP request/response
- Authentication
- Authorization
- Serialization
- Input validation

The API layer must never contain business logic.

---

## Service Layer

Responsibilities:

- Business workflows
- Transactions
- Event publishing
- Coordination between domains

Services orchestrate application behavior.

---

## Validation Layer

Responsibilities:

- Business rule validation
- Domain constraints
- Reusable validation logic

Validators keep services concise and reusable.

---

## Selector Layer

Responsibilities:

- Read-only operations
- Optimized queries
- Complex filtering
- Aggregation

Selectors should not modify data.

---

## Persistence Layer

Managers and QuerySets encapsulate reusable database access while Models define the data structure.

---

# Dependency Rules

```text
API
 ↓
Service
 ↓
Validator
 ↓
Selector
 ↓
Manager
 ↓
QuerySet
 ↓
Model
```

Rules:

- Dependencies only flow downward.
- Lower layers never depend on higher layers.
- Models should not call services.
- Views should not access models directly.

---

# Cross-Cutting Concerns

Shared across all domains:

- Audit logging
- Domain events
- Soft deletion
- Metadata
- Permissions
- Caching

These are implemented through the Core module.

---

# Benefits

- Easier testing
- Better maintainability
- Clear ownership
- Reusable business logic
- Consistent architecture
- Scalable codebase

---

# Best Practices

- Keep views thin.
- Keep services focused.
- Prefer selectors for reads.
- Keep models free of business workflows.
- Publish domain events instead of tightly coupling modules.
- Place shared functionality in Core.

---

# Related Documents

- overview.md
- modular-monolith.md
- service-layer.md
- selector-pattern.md
- validator-pattern.md
- api-architecture.md
