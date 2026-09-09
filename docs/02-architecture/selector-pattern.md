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

# BaseSelector

The Core module provides a generic `BaseSelector` that all domain selectors inherit from. It is exported from `apps.core.selectors`:

```python
from apps.core.selectors import BaseSelector
```

`BaseSelector` provides read-only query primitives:

| Method | Purpose |
| --- | --- |
| `get_queryset()` | Return the base queryset (subclasses override) |
| `all()` | Return all records |
| `get(**filters)` | Return a single record or raise `DoesNotExist` |
| `filter(**filters)` | Return filtered queryset |
| `exclude(**filters)` | Return excluded queryset |
| `exists(**filters)` | Return whether any record matches |
| `first(**filters)` | Return the first matching record |
| `last(**filters)` | Return the last matching record |
| `count(**filters)` | Return the number of matching records |
| `get_or_none(**filters)` | Return a record or `None` |
| `values_list(...)` | Return a list of values |
| `in_bulk(...)` | Return records keyed by field value |
| `select_related(...)` | Optimize foreign-key loading |
| `prefetch_related(...)` | Optimize many-to-many loading |

Example:

```python
class DepartmentSelector(BaseSelector):
    @classmethod
    def get_queryset(cls):
        return Department.objects.select_related("organization")

    @classmethod
    def by_organization(cls, organization):
        return cls.filter(organization=organization)
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
- Optimize related object loading (`select_related`, `prefetch_related`)

A selector should **not**:

- Save models
- Delete models
- Update models
- Execute business workflows
- Publish events
- Send notifications

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
- Inherit from `BaseSelector` for consistent read primitives.

---

# Anti-Patterns

- Writing data inside selectors
- Business logic in selectors
- Direct ORM queries inside API views
- Copying query logic across modules
- Returning unoptimized querysets
- Exposing write methods (create / update / delete) on selectors

---

# Related Documents

- service-layer.md
- manager-pattern.md
- queryset-pattern.md
- api-architecture.md
- database-design.md
