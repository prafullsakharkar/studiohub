# Selector Pattern

## Overview

StudioHub adopts the **Selector Pattern** to centralize all read operations. Selectors encapsulate query logic, allowing business services and API layers to retrieve data without embedding database queries throughout the codebase.

The Selector Pattern improves maintainability, promotes query reuse, and keeps business logic separate from persistence concerns.

---

# Purpose

Selectors are responsible for:

- Retrieving data
- Building complex queries
- Filtering and searching
- Aggregating data
- Optimizing database access
- Returning domain-specific read models

Selectors **never modify data**.

---

# Architecture

```text
APIView
    │
Serializer
    │
Business Service
    │
Selector
    │
Manager
    │
QuerySet
    │
Model
    │
Database
```

---

# Responsibilities

A selector may:

- Retrieve a single entity
- Retrieve collections
- Apply filters
- Apply ordering
- Apply pagination
- Annotate querysets
- Perform aggregations
- Optimize related object loading

A selector should **not**:

- Save models
- Delete models
- Update models
- Execute business workflows
- Publish events

---

# Selector Organization

Each domain contains its own selector package.

```text
apps/
└── organization/
    └── selectors/
        ├── organization.py
        ├── department.py
        ├── office.py
        ├── team.py
        └── membership.py
```

Selectors should be organized around business entities.

---

# Query Flow

```text
Client
  │
API View
  │
Service
  │
Selector
  │
Manager
  │
QuerySet
  │
Database
```

---

# Query Composition

Selectors should build queries using:

- Custom QuerySets
- Managers
- `select_related()`
- `prefetch_related()`
- `annotate()`
- `aggregate()`
- Database expressions where appropriate

Avoid duplicating query logic across selectors.

---

# Performance Guidelines

- Use `select_related()` for foreign keys.
- Use `prefetch_related()` for many-to-many relationships.
- Limit returned fields when appropriate.
- Reuse optimized querysets.
- Avoid N+1 query problems.
- Keep queries composable.

---

# Interaction with Services

Services use selectors to obtain data before performing business operations.

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
QuerySet
```

This separation keeps services focused on workflows rather than persistence.

---

# Caching

Selectors are the preferred location for introducing read caching because they centralize data retrieval.

Potential caching strategies:

- Frequently accessed reference data
- Organization settings
- Permission lookups
- Dashboard summaries

---

# Best Practices

- One selector per business entity.
- Keep selectors read-only.
- Return optimized querysets.
- Reuse query logic.
- Hide ORM complexity from services.
- Keep APIs independent of database implementation.

---

# Anti-Patterns

- Writing data inside selectors
- Business logic in selectors
- Direct ORM queries inside API views
- Copying query logic across modules
- Returning unoptimized querysets

---

# Related Documents

- service-layer.md
- manager-pattern.md
- queryset-pattern.md
- api-architecture.md
- database-design.md
