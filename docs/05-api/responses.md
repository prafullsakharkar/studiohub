# API Responses

## Overview

StudioHub follows a standardized API response format across all endpoints. Consistent responses improve developer experience, simplify frontend integration, and make error handling predictable.

Every endpoint should return responses using the same envelope, regardless of the business domain.

---

# Objectives

The response system provides:

- Consistent response structure
- Predictable API behavior
- Standard HTTP status codes
- Uniform error handling
- Pagination support
- Metadata support
- Future extensibility

---

# Response Principles

All API responses should be:

- Consistent
- Predictable
- Minimal
- Well-documented
- Machine-readable
- Human-readable

Responses should never expose internal implementation details.

---

# Response Architecture

```text
HTTP Request
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
      ▼
Response Builder
      │
      ▼
JSON Response
```

---

# Standard Response Structure

Every successful response should follow this format.

```json
{
    "success": true,
    "message": "Request completed successfully.",
    "data": {}
}
```

---

# Response Fields

| Field | Description |
|---------|-------------|
| success | Indicates request status |
| message | Human-readable message |
| data | Returned resource(s) |
| meta | Optional metadata |

---

# Success Responses

## Retrieve Resource

```json
{
    "success": true,
    "message": "Project retrieved successfully.",
    "data": {
        "id": 1,
        "uuid": "xxxxxxxx",
        "name": "Avatar"
    }
}
```

---

## Create Resource

HTTP Status

```text
201 Created
```

Response

```json
{
    "success": true,
    "message": "Project created successfully.",
    "data": {}
}
```

---

## Update Resource

HTTP Status

```text
200 OK
```

```json
{
    "success": true,
    "message": "Project updated successfully.",
    "data": {}
}
```

---

## Delete Resource

HTTP Status

```text
204 No Content
```

For soft deletes, an implementation may alternatively return:

```json
{
    "success": true,
    "message": "Project archived successfully."
}
```

---

# Collection Responses

Collection endpoints should include pagination.

```json
{
    "count": 250,
    "next": "...",
    "previous": "...",
    "page": 2,
    "page_size": 25,
    "total_pages": 10,
    "results": []
}
```

---

# Metadata

Optional metadata can accompany responses.

Example

```json
{
    "success": true,
    "message": "Projects retrieved successfully.",
    "data": [],
    "meta": {
        "generated_at": "2026-07-10T10:15:00Z",
        "execution_time_ms": 42
    }
}
```

---

# Empty Responses

Example

```json
{
    "success": true,
    "message": "No projects found.",
    "data": []
}
```

Empty collections are not considered errors.

---

# Error Responses

Errors follow a separate standardized structure.

```json
{
    "success": false,
    "code": "validation_error",
    "message": "Validation failed.",
    "errors": {}
}
```

See **error-handling.md** for complete details.

---

# HTTP Status Codes

| Status | Usage |
|---------|-------|
| 200 | Successful request |
| 201 | Resource created |
| 202 | Accepted for processing |
| 204 | No content |
| 400 | Invalid request |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Conflict |
| 422 | Validation failed |
| 429 | Too many requests |
| 500 | Internal server error |

---

# File Responses

File download endpoints should return appropriate content types.

Examples

```text
application/pdf

application/zip

image/png

image/jpeg

application/octet-stream
```

Large files should be streamed whenever possible.

---

# Bulk Operations

Bulk operations should summarize the outcome.

Example

```json
{
    "success": true,
    "message": "Bulk operation completed.",
    "data": {
        "processed": 100,
        "successful": 96,
        "failed": 4
    }
}
```

---

# Long-Running Operations

Operations executed asynchronously should return:

```http
202 Accepted
```

Example

```json
{
    "success": true,
    "message": "Export has been scheduled.",
    "data": {
        "job_id": "uuid"
    }
}
```

Clients can monitor the job status through dedicated endpoints.

---

# Localization

User-facing messages should support localization where applicable.

Machine-readable values such as `code` should never be localized.

---

# Best Practices

- Return consistent response structures.
- Use appropriate HTTP status codes.
- Keep responses concise.
- Include meaningful messages.
- Separate errors from successful responses.
- Document every response format.

---

# Anti-Patterns

Avoid:

- Returning different formats for similar endpoints
- Embedding stack traces
- Using HTTP 200 for failed requests
- Returning HTML from REST endpoints
- Including unnecessary data
- Exposing internal implementation details

---

# Testing

Response tests should verify:

- Response structure
- HTTP status codes
- Serialization
- Empty collections
- Pagination responses
- Error responses
- Metadata
- Bulk operation responses

---

# Related Documents

- overview.md
- serializers.md
- views.md
- pagination.md
- error-handling.md
- versioning.md
- ../03-backend/services.md