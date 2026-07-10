# Selectors

## Overview

Selectors are responsible for all read operations within StudioHub. They encapsulate database query logic, optimize data retrieval, and provide a consistent interface for fetching domain objects.

Selectors separate read operations from business logic, allowing Services to focus on workflows while QuerySets focus on query construction.

Selectors never modify data.

---

# Objectives

The Selector layer is responsible for:

- Retrieving domain objects
- Building complex queries
- Filtering and searching
- Pagination support
- Dashboard queries
- Aggregations
- Performance optimization
- Reusable read operations

Selectors should remain completely read-only.

---

# Architecture

```text
APIView
    │
    ▼
Serializer
    │
    ▼
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
    │
    ▼
Model
    │
    ▼
Database
```

---

# Directory Structure

Each domain contains its own selectors.

```text
apps/

core/
    selectors/

identity/
    selectors/

organization/
    selectors/

production/
    selectors/
```

Example

```text
apps/organization/selectors/

organization.py
department.py
office.py
team.py
membership.py
```

---

# Responsibilities

Selectors should:

- Retrieve single entities
- Retrieve collections
- Build complex filters
- Handle searching
- Apply ordering
- Support pagination
- Aggregate data
- Optimize queries
- Return QuerySets when appropriate

Selectors should not:

- Create records
- Update records
- Delete records
- Validate business rules
- Publish events
- Execute workflows

---

# Read Workflow

```text
Client

↓

APIView

↓

Serializer

↓

Business Service

↓

Selector

↓

Manager

↓

QuerySet

↓

Database
```

---

# Common Selector Methods

Typical methods include:

```python
get_by_id()

get_by_uuid()

get_by_code()

get_active()

get_archived()

search()

list()

filter()

exists()

count()
```

---

# Dashboard Queries

Selectors are responsible for dashboard data.

Examples

- Active Projects
- Artist Workload
- Shot Progress
- Department Statistics
- Organization Summary
- Task Distribution

These queries often use:

- annotate()
- aggregate()
- values()
- Count()
- Sum()
- Avg()

---

# Performance Optimization

Selectors should optimize database access by using:

- select_related()
- prefetch_related()
- only()
- defer()
- annotations
- indexes

Avoid N+1 query problems.

---

# Query Composition

Selectors compose reusable QuerySet methods.

Example

```python
Project.objects.active()\
       .visible()\
       .ordered()
```

This keeps queries readable and reusable.

---

# Caching

Selectors are the preferred location for read caching.

Typical cached data:

- Organization settings
- Permission lookups
- Dashboard summaries
- Reference data
- Production statistics

Cache invalidation should occur through Services after successful write operations.

---

# Common Selectors

## Core

- AuditSelector
- EventSelector

---

## Identity

- UserSelector
- RoleSelector
- PermissionSelector
- MFASelector
- SessionSelector

---

## Organization

- OrganizationSelector
- DepartmentSelector
- OfficeSelector
- TeamSelector
- MembershipSelector

---

## Production

- ProjectSelector
- SequenceSelector
- ShotSelector
- AssetSelector
- TaskSelector
- VersionSelector
- PublishSelector
- ReviewSelector

---

# Best Practices

- Keep selectors read-only.
- Return optimized QuerySets.
- Reuse QuerySet methods.
- Keep queries composable.
- Optimize joins.
- Keep selectors independent of HTTP.

---

# Anti-Patterns

Avoid:

- Writing data in selectors
- Business logic in selectors
- Raw SQL unless necessary
- Duplicate query logic
- Calling external services
- Cross-domain writes

---

# Testing

Selectors should be tested for:

- Query correctness
- Filtering
- Ordering
- Pagination
- Performance
- Aggregations
- Permission-aware queries

---

# Related Documents

- models.md
- services.md
- validators.md
- permissions.md
- ../02-architecture/selector-pattern.md
- ../02-architecture/queryset-pattern.md
```