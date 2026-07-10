# Filtering

## Overview

StudioHub provides a standardized filtering system across all REST API endpoints using **Django Filter**. Filtering enables clients to retrieve only the data they need while minimizing network traffic and improving performance.

Every collection endpoint should support filtering where appropriate.

---

# Objectives

The filtering system provides:

- Field Filtering
- Search
- Ordering
- Date Filtering
- Status Filtering
- Range Filtering
- Relationship Filtering
- Custom Filters

Filtering should be:

- Consistent
- Predictable
- Reusable
- Performant

---

# Architecture

```text
HTTP Request

↓

APIView

↓

Filter Backend

↓

FilterSet

↓

Selector

↓

QuerySet

↓

Database
```

---

# Directory Structure

```text
apps/<module>/

api/
└── filters/
    ├── base.py
    ├── project.py
    ├── department.py
    ├── shot.py
    ├── task.py
    └── __init__.py
```

---

# Filter Components

StudioHub uses:

- django-filter
- SearchFilter
- OrderingFilter
- Custom FilterSets

Every resource should have its own FilterSet.

---

# Basic Filtering

Example

```http
GET /api/v1/projects/?status=active
```

Multiple filters

```http
GET /api/v1/projects/?status=active&type=film
```

---

# Relationship Filtering

Example

```http
GET /api/v1/shots/?project=uuid
```

```http
GET /api/v1/tasks/?assignee=user_uuid
```

```http
GET /api/v1/departments/?organization=uuid
```

---

# Search

Search should be implemented using DRF's `SearchFilter`.

Example

```http
GET /api/v1/projects/?search=Avatar
```

Typical searchable fields

```text
name

code

description
```

Search should remain case-insensitive.

---

# Ordering

Ordering should use DRF's `OrderingFilter`.

Example

```http
GET /api/v1/projects/?ordering=name
```

Descending

```http
GET /api/v1/projects/?ordering=-created_at
```

Supported ordering fields should be explicitly defined.

---

# Date Filtering

Examples

```http
GET /projects/?created_after=2026-01-01
```

```http
GET /projects/?created_before=2026-06-30
```

```http
GET /tasks/?updated_after=2026-07-01
```

---

# Range Filtering

Examples

```http
GET /versions/?version__gte=5
```

```http
GET /shots/?frame_count__lte=150
```

---

# Boolean Filtering

Examples

```http
GET /users/?is_active=true
```

```http
GET /projects/?is_archived=false
```

---

# Choice Filtering

Example

```http
GET /tasks/?status=in_progress
```

Choice fields should validate against predefined enums.

---

# Multiple Value Filtering

Example

```http
GET /tasks/?status=todo,in_progress
```

Alternative

```http
GET /tasks/?status__in=todo,in_progress
```

---

# Custom Filters

Examples

```text
My Tasks

My Reviews

Overdue Tasks

Pending Approval

Recently Updated

Assigned To Me
```

These filters should be implemented in custom FilterSets.

---

# Performance

Filtering should always:

- Use indexes
- Reuse QuerySets
- Avoid unnecessary joins
- Avoid N+1 queries
- Use select_related()
- Use prefetch_related()

---

# Filter Validation

Invalid filter values should return a validation error.

Example

```json
{
    "success": false,
    "code": "invalid_filter",
    "message": "Invalid value for 'status'."
}
```

---

# Best Practices

- One FilterSet per resource.
- Use explicit filter fields.
- Document every supported filter.
- Keep filtering predictable.
- Optimize database queries.
- Combine filtering with pagination.

---

# Anti-Patterns

Avoid:

- Raw SQL filtering
- Unbounded filtering
- Filtering inside serializers
- Filtering inside services
- Accepting arbitrary field names
- Exposing internal model fields

---

# Testing

Filter tests should verify:

- Field filters
- Relationship filters
- Search
- Ordering
- Date filters
- Range filters
- Invalid filter values
- Performance

---

# Related Documents

- overview.md
- views.md
- serializers.md
- pagination.md
- versioning.md
- ../03-backend/selectors.md
- ../03-backend/querysets.md