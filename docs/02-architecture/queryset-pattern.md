# QuerySet Pattern

## Overview

StudioHub uses custom Django QuerySets to encapsulate reusable query construction and filtering logic. QuerySets are responsible for building database queries, while Managers expose them and Selectors consume them.

This separation ensures query logic is reusable, composable, and independent of business workflows.

---

# Objectives

The QuerySet Pattern is designed to:

- Centralize query construction
- Eliminate duplicate filters
- Enable fluent query chaining
- Improve readability
- Optimize database performance
- Keep Managers lightweight

---

# Architecture

```text
Business Service
        │
        ▼
Selector
        │
        ▼
Manager
        │
        ▼
Custom QuerySet
        │
        ▼
Model
        │
        ▼
Database
```

---

# Responsibilities

QuerySets should:

- Build reusable queries
- Apply filtering
- Apply ordering
- Annotate results
- Optimize joins
- Support method chaining

QuerySets should **not**:

- Execute business workflows
- Validate business rules
- Publish events
- Perform HTTP operations

---

# Organization

Each model should have a corresponding QuerySet.

```text
apps/
└── organization/
    ├── managers/
    └── querysets/
        ├── organization.py
        ├── department.py
        ├── office.py
        ├── team.py
        └── membership.py
```

---

# Fluent Query Composition

QuerySet methods should return another QuerySet whenever possible.

```text
Organization.objects
    .active()
    .visible()
    .ordered()
```

This allows query methods to be composed naturally.

---

# Common QuerySet Methods

Typical reusable methods include:

- active()
- inactive()
- archived()
- deleted()
- visible()
- ordered()
- by_uuid()
- by_code()
- search()

These methods should remain focused on query construction.

---

# Performance Guidelines

- Use `select_related()` for foreign keys.
- Use `prefetch_related()` for many-to-many relationships.
- Use `only()` and `defer()` when appropriate.
- Minimize N+1 query problems.
- Reuse optimized QuerySet methods.

---

# Relationship with Managers

Managers expose QuerySet methods.

```text
Model.objects.active()
             │
             ▼
        Custom QuerySet
```

Managers should avoid duplicating QuerySet logic.

---

# Relationship with Selectors

Selectors combine QuerySet methods to build complete read operations.

```text
Selector
    │
    ▼
Manager
    │
    ▼
QuerySet
    │
    ▼
Database
```

---

# Best Practices

- One QuerySet per model.
- Keep methods small and reusable.
- Return QuerySets for chaining.
- Prefer expressive method names.
- Keep database logic out of services.
- Optimize queries before exposing them.

---

# Anti-Patterns

- Business logic inside QuerySets
- Validation inside QuerySets
- Returning raw SQL without necessity
- Duplicating filters across QuerySets
- Executing unrelated domain queries

---

# Related Documents

- manager-pattern.md
- selector-pattern.md
- service-layer.md
- database-design.md
