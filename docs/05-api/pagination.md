# Pagination

## Overview

StudioHub uses a standardized pagination system across all collection endpoints to ensure consistent API responses, improve performance, and support scalable datasets.

Pagination is mandatory for all endpoints returning collections. Clients should never receive an unbounded list of resources.

The default implementation uses **Django REST Framework's PageNumberPagination**, with the flexibility to support Cursor Pagination for high-volume resources in the future.

---

# Objectives

The pagination system provides:

- Consistent response format
- Configurable page size
- Efficient database queries
- Predictable navigation
- Improved API performance
- Better frontend integration

---

# Architecture

```text
HTTP Request

↓

APIView

↓

Pagination Class

↓

Selector

↓

QuerySet

↓

Database

↓

Paginated Response
```

---

# Request Parameters

StudioHub uses the following query parameters.

| Parameter | Description | Default |
|-----------|-------------|---------|
| page | Current page number | 1 |
| page_size | Number of records per page | 25 |

Example

```http
GET /api/v1/projects/?page=2&page_size=50
```

---

# Default Page Size

Recommended defaults

| Resource | Default |
|-----------|---------|
| Projects | 25 |
| Users | 25 |
| Departments | 25 |
| Tasks | 50 |
| Versions | 50 |
| Notes | 100 |

---

# Maximum Page Size

To prevent abuse, StudioHub enforces a maximum page size.

Example

```text
Default Page Size : 25

Maximum Page Size : 100
```

Requests exceeding the maximum should automatically use the configured limit.

---

# Response Format

Every paginated response follows the same structure.

```json
{
    "count": 245,
    "next": "https://api.studiohub.com/api/v1/projects/?page=3",
    "previous": "https://api.studiohub.com/api/v1/projects/?page=1",
    "page": 2,
    "page_size": 25,
    "total_pages": 10,
    "results": []
}
```

---

# Navigation

Clients navigate collections using the provided links.

```text
First Page

↓

Next

↓

Next

↓

Previous

↓

Last Page
```

Clients should avoid constructing pagination URLs manually.

---

# Pagination Workflow

```text
HTTP Request

↓

APIView

↓

Filtering

↓

Ordering

↓

Pagination

↓

Serialization

↓

JSON Response
```

Pagination is applied after filtering and ordering.

---

# Filtering and Pagination

Filtering works seamlessly with pagination.

Example

```http
GET /api/v1/tasks/?status=in_progress&page=3
```

The count reflects only the filtered dataset.

---

# Searching and Pagination

Example

```http
GET /api/v1/projects/?search=Avatar&page=2
```

Pagination is applied after search results are generated.

---

# Ordering and Pagination

Example

```http
GET /api/v1/projects/?ordering=-created_at&page=4
```

Ordering must always occur before pagination.

---

# Empty Results

Empty pages return:

```json
{
    "count": 0,
    "next": null,
    "previous": null,
    "page": 1,
    "page_size": 25,
    "total_pages": 0,
    "results": []
}
```

---

# Custom Pagination Classes

StudioHub may define reusable pagination classes.

Examples

```text
StandardPagination

SmallPagination

LargePagination

CursorPagination
```

Different endpoints may use specialized pagination strategies where appropriate.

---

# Cursor Pagination (Future)

Cursor Pagination is recommended for:

- Activity feeds
- Audit logs
- Notifications
- Event streams
- Time-series data

Advantages

- Better performance
- Stable pagination
- No duplicate records
- Better handling of inserts

---

# Performance Considerations

Pagination should always:

- Apply database indexes
- Use optimized QuerySets
- Avoid loading unnecessary relationships
- Combine with filtering
- Minimize response payload size

---

# Best Practices

- Paginate every collection endpoint.
- Keep page sizes reasonable.
- Return pagination metadata.
- Apply pagination after filtering.
- Use consistent response formats.
- Document supported page sizes.

---

# Anti-Patterns

Avoid:

- Returning all records
- Large default page sizes
- Pagination inside serializers
- Client-side pagination for large datasets
- Unstable ordering

---

# Testing

Pagination tests should verify:

- Default page size
- Custom page size
- Maximum page size
- Invalid page numbers
- Empty datasets
- Filtering with pagination
- Ordering with pagination
- Search with pagination

---

# Related Documents

- overview.md
- views.md
- filtering.md
- serializers.md
- versioning.md
- error-handling.md
- ../03-backend/selectors.md
- ../03-backend/services.md