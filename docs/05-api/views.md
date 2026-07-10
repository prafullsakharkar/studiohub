# API Views

## Overview

API Views are the entry point for every request in StudioHub. They are responsible for handling HTTP requests, authenticating users, checking permissions, validating request data, invoking business services, and returning standardized responses.

StudioHub uses **Django REST Framework ViewSets** as the default implementation because they provide a consistent, scalable, and maintainable API architecture.

Views should remain **thin**. They coordinate requests but never contain business logic.

---

# Responsibilities

API Views are responsible for:

- Receiving HTTP requests
- Authentication
- Authorization
- Serializer selection
- Request validation
- Calling Business Services
- Returning HTTP responses
- Exception handling

Views are **not** responsible for:

- Business workflows
- Database queries
- Transactions
- Complex validation
- Event publishing

---

# Request Lifecycle

```text
HTTP Request
      │
      ▼
Authentication
      │
      ▼
Permission Check
      │
      ▼
APIView / ViewSet
      │
      ▼
Serializer Validation
      │
      ▼
Business Service
      │
 ┌────┴─────┐
 ▼          ▼
Validator  Selector
      │
      ▼
Database
      │
      ▼
Serializer
      │
      ▼
HTTP Response
```

---

# Directory Structure

```text
apps/<module>/

api/
└── views/
    ├── base.py
    ├── project.py
    ├── department.py
    ├── team.py
    ├── shot.py
    ├── task.py
    └── __init__.py
```

---

# Base ViewSet

Every ViewSet should inherit from a reusable base class.

Example

```python
class ProjectViewSet(BaseModelViewSet):
    ...
```

The base ViewSet should provide:

- Authentication
- Permission handling
- Pagination
- Filtering
- Ordering
- Search
- Standard responses
- Audit support

---

# CRUD Operations

## List

```http
GET /api/v1/projects/
```

Returns a paginated collection.

---

## Retrieve

```http
GET /api/v1/projects/{id}/
```

Returns a single resource.

---

## Create

```http
POST /api/v1/projects/
```

Workflow

```text
Request

↓

Serializer

↓

ProjectService.create()

↓

Response
```

---

## Update

```http
PUT /api/v1/projects/{id}/
```

or

```http
PATCH /api/v1/projects/{id}/
```

Workflow

```text
Request

↓

Serializer

↓

ProjectService.update()

↓

Response
```

---

## Delete

```http
DELETE /api/v1/projects/{id}/
```

Deletes (soft delete) the resource.

---

# Custom Actions

ViewSets may expose additional actions.

Examples

```http
POST /projects/{id}/archive/

POST /projects/{id}/restore/

POST /shots/{id}/approve/

POST /tasks/{id}/assign/

POST /versions/{id}/publish/
```

Use DRF's `@action` decorator for non-CRUD endpoints.

---

# Serializer Selection

Different serializers should be used depending on the action.

Example

| Action | Serializer |
|---------|------------|
| list | ProjectListSerializer |
| retrieve | ProjectDetailSerializer |
| create | ProjectCreateSerializer |
| update | ProjectUpdateSerializer |

---

# Service Integration

Views should always delegate writes to Services.

```text
APIView

↓

Serializer

↓

ProjectService

↓

Database
```

Views should never call the ORM directly.

---

# Authentication

Protected endpoints require authentication.

Example

```python
authentication_classes = [
    JWTAuthentication,
]
```

---

# Permissions

Every endpoint should define permissions.

Examples

```python
permission_classes = [
    IsAuthenticated,
    HasProjectPermission,
]
```

Authorization should occur before business logic.

---

# Filtering

ViewSets should support filtering.

Examples

```http
GET /projects/?status=active

GET /shots/?sequence=SEQ010

GET /tasks/?assignee=user-id
```

Filtering should be implemented using `django-filter`.

---

# Searching

Example

```http
GET /projects/?search=Avatar
```

Supported search fields should be explicitly defined.

---

# Ordering

Example

```http
GET /projects/?ordering=name

GET /tasks/?ordering=-created_at
```

Only approved fields should be sortable.

---

# Pagination

Collection endpoints should always return paginated results.

```json
{
    "count": 250,
    "next": "...",
    "previous": "...",
    "results": []
}
```

---

# Standard Responses

Successful response

```json
{
    "success": true,
    "message": "Project created successfully.",
    "data": {}
}
```

Error response

```json
{
    "success": false,
    "code": "validation_error",
    "message": "Validation failed.",
    "errors": {}
}
```

---

# Error Handling

Views should never expose internal exceptions.

All exceptions should be translated into standardized API responses.

Common HTTP status codes

| Status | Meaning |
|---------|----------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 500 | Internal Server Error |

---

# Best Practices

- Keep views thin.
- Use ViewSets whenever possible.
- Delegate writes to Services.
- Use Selectors for read operations.
- Apply authentication consistently.
- Apply permissions before business logic.
- Return standardized responses.

---

# Anti-Patterns

Avoid:

- Business logic in views
- ORM queries in views
- Manual JSON construction
- Long methods
- Duplicate CRUD logic
- Skipping permission checks
- Returning inconsistent responses

---

# Testing

View tests should verify:

- Authentication
- Authorization
- CRUD operations
- Custom actions
- Pagination
- Filtering
- Search
- Ordering
- Error responses

---

# Related Documents

- overview.md
- authentication.md
- serializers.md
- filtering.md
- pagination.md
- error-handling.md
- ../03-backend/services.md
- ../03-backend/selectors.md
- ../03-backend/permissions.md
```