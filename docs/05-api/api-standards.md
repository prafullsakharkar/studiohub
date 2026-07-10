# API Standards

## Overview

This document defines the API development standards for StudioHub. Every REST API must follow these guidelines to ensure consistency, maintainability, scalability, and an excellent developer experience.

These standards apply to all backend modules including:

- Core
- Identity
- Organization
- Production
- Future Modules

---

# API Design Principles

StudioHub APIs follow these principles:

- API-First Development
- RESTful Design
- Resource-Oriented Architecture
- Stateless Communication
- Consistent Responses
- Secure by Default
- Versioned APIs
- Predictable Behavior

---

# API Architecture

```text
Client
    │
    ▼
Authentication
    │
    ▼
Permissions
    │
    ▼
APIView
    │
    ▼
Serializer
    │
    ▼
Business Service
    │
 ┌──┴─────────┐
 ▼            ▼
Validator   Selector
    │
    ▼
Database
```

---

# URL Standards

## Base URL

```text
/api/v1/
```

---

## Resource Naming

Always use:

- Lowercase
- Plural nouns
- Hyphen-separated words

Good

```text
/users/

/organizations/

/departments/

/trusted-devices/

/work-calendars/
```

Avoid

```text
/getUsers

/User

/createProject

/deleteTask
```

---

# HTTP Methods

| Method | Purpose |
|----------|----------|
| GET | Retrieve resource(s) |
| POST | Create resource |
| PUT | Replace resource |
| PATCH | Partial update |
| DELETE | Soft delete resource |

Never use GET for state-changing operations.

---

# Resource Endpoints

Collection

```http
GET /projects/
```

Retrieve

```http
GET /projects/{id}/
```

Create

```http
POST /projects/
```

Update

```http
PATCH /projects/{id}/
```

Delete

```http
DELETE /projects/{id}/
```

---

# Custom Actions

Business workflows should use explicit actions.

Examples

```http
POST /projects/{id}/archive/

POST /projects/{id}/restore/

POST /shots/{id}/approve/

POST /tasks/{id}/assign/

POST /versions/{id}/publish/
```

Avoid action verbs in collection endpoints.

---

# Request Format

Requests should use JSON.

Example

```json
{
    "name": "Avatar",
    "status": "active"
}
```

Multipart requests are allowed for file uploads.

---

# Response Format

Success

```json
{
    "success": true,
    "message": "Project created successfully.",
    "data": {}
}
```

Failure

```json
{
    "success": false,
    "code": "validation_error",
    "message": "Validation failed.",
    "errors": {}
}
```

Responses should remain consistent across all modules.

---

# HTTP Status Codes

| Status | Usage |
|----------|-------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

Use the most appropriate status code for each response.

---

# Authentication

Protected endpoints require:

```http
Authorization: Bearer <access_token>
```

Public endpoints should be explicitly documented.

---

# Authorization

Authorization should always verify:

- Authentication
- Organization Membership
- Role
- Permission
- Object Ownership (when applicable)

Never rely on frontend authorization.

---

# Validation

Validation occurs at multiple layers.

| Layer | Responsibility |
|---------|---------------|
| Serializer | Input validation |
| Validator | Business validation |
| Database | Integrity constraints |

Each layer has a distinct responsibility.

---

# Pagination

Collection endpoints must support:

```text
?page=

?page_size=
```

Responses should include:

- count
- next
- previous
- page
- page_size
- total_pages
- results

---

# Filtering

Supported features

```text
?search=

?ordering=

?status=

?created_after=

?created_before=
```

Filtering should use `django-filter`.

---

# Ordering

Example

```http
GET /projects/?ordering=name

GET /projects/?ordering=-created_at
```

Supported ordering fields should be documented.

---

# Searching

Example

```http
GET /projects/?search=Avatar
```

Search should remain case-insensitive.

---

# Error Handling

Errors must follow the standard response structure.

Example

```json
{
    "success": false,
    "code": "permission_denied",
    "message": "You do not have permission to perform this action."
}
```

Never expose implementation details.

---

# Idempotency

The following methods should be idempotent:

- GET
- PUT
- DELETE

POST should only create new resources unless explicitly documented.

---

# File Uploads

Uploads should use:

```text
multipart/form-data
```

Supported examples:

- Images
- Videos
- Documents
- Assets
- Published Files

Large uploads should support streaming where appropriate.

---

# Date & Time

All timestamps should:

- Use UTC
- Follow ISO 8601
- Include timezone information

Example

```text
2026-07-10T09:30:45Z
```

---

# UUID Usage

Public resource identifiers should use UUIDs.

Example

```text
550e8400-e29b-41d4-a716-446655440000
```

Sequential database IDs should not be exposed unless there is a specific business requirement.

---

# API Documentation

Every endpoint should document:

- Summary
- Description
- Authentication
- Permissions
- Request schema
- Response schema
- Error responses
- Examples

Documentation should be generated automatically from the codebase whenever possible.

---

# Performance

APIs should:

- Use pagination
- Optimize database queries
- Avoid N+1 queries
- Cache when appropriate
- Limit response payloads
- Support compression

---

# Security

Every API should implement:

- HTTPS
- JWT Authentication
- RBAC Authorization
- Input Validation
- Rate Limiting
- Audit Logging
- Secure Headers
- CORS Policies

---

# Best Practices

- Keep endpoints resource-oriented.
- Keep responses consistent.
- Use Services for business logic.
- Use Selectors for read operations.
- Document every endpoint.
- Version all public APIs.
- Keep APIs backward compatible.

---

# Anti-Patterns

Avoid:

- Business logic in API Views
- ORM queries in Views
- Verb-based URLs
- Inconsistent response formats
- Returning HTTP 200 for failures
- Exposing stack traces
- Skipping authorization
- Returning excessive data

---

# API Review Checklist

Before releasing an endpoint, verify:

- RESTful URL design
- Correct HTTP method
- Authentication enforced
- Permissions validated
- Serializer validation implemented
- Service layer used
- Pagination enabled (if applicable)
- Filtering documented
- OpenAPI documentation updated
- Tests completed

---

# Related Documents

- overview.md
- authentication.md
- serializers.md
- views.md
- filtering.md
- pagination.md
- routing.md
- responses.md
- versioning.md
- error-handling.md
- openapi.md
- ../03-backend/development-guide.md