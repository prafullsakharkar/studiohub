# Error Handling

## Overview

StudioHub provides a centralized and standardized error handling mechanism across all APIs. Every error response follows a consistent structure, making it easy for frontend applications, mobile clients, and third-party integrations to understand and handle failures.

The API should never expose internal exceptions, stack traces, database errors, or implementation details.

---

# Objectives

The error handling system provides:

- Consistent error responses
- Meaningful error messages
- Standard HTTP status codes
- Validation error reporting
- Authentication errors
- Permission errors
- Business rule violations
- Server error handling

---

# Error Architecture

```text
HTTP Request
      │
      ▼
APIView
      │
      ▼
Serializer Validation
      │
      ▼
Business Service
      │
      ▼
Domain Exception
      │
      ▼
Global Exception Handler
      │
      ▼
JSON Error Response
```

---

# Standard Error Response

Every API should return errors using the following format.

```json
{
    "success": false,
    "code": "validation_error",
    "message": "Validation failed.",
    "errors": {
        "name": [
            "This field is required."
        ]
    }
}
```

---

# Response Fields

| Field | Description |
|---------|-------------|
| success | Always false |
| code | Machine-readable error code |
| message | Human-readable message |
| errors | Detailed validation errors |
| trace_id | Optional request identifier |

---

# HTTP Status Codes

StudioHub uses standard HTTP status codes.

| Status | Description |
|---------|-------------|
| 200 | Success |
| 201 | Resource Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Resource Not Found |
| 405 | Method Not Allowed |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

# Validation Errors

Example

```http
POST /api/v1/projects/
```

```json
{
    "success": false,
    "code": "validation_error",
    "message": "Validation failed.",
    "errors": {
        "code": [
            "Project code already exists."
        ],
        "name": [
            "This field is required."
        ]
    }
}
```

---

# Authentication Errors

Example

```json
{
    "success": false,
    "code": "authentication_failed",
    "message": "Invalid email or password."
}
```

Common authentication errors

- Invalid credentials
- Token expired
- Invalid token
- Missing token
- MFA required

---

# Authorization Errors

Example

```json
{
    "success": false,
    "code": "permission_denied",
    "message": "You do not have permission to perform this action."
}
```

---

# Resource Not Found

Example

```json
{
    "success": false,
    "code": "not_found",
    "message": "Project not found."
}
```

---

# Conflict Errors

Example

```json
{
    "success": false,
    "code": "duplicate_resource",
    "message": "A project with this code already exists."
}
```

---

# Business Rule Violations

Business Services may raise domain-specific exceptions.

Example

```json
{
    "success": false,
    "code": "invalid_state",
    "message": "Archived projects cannot be modified."
}
```

---

# Rate Limiting

Example

```json
{
    "success": false,
    "code": "rate_limit_exceeded",
    "message": "Too many requests. Please try again later."
}
```

HTTP Status

```text
429 Too Many Requests
```

---

# Internal Server Errors

Unexpected exceptions should return a generic response.

```json
{
    "success": false,
    "code": "internal_server_error",
    "message": "An unexpected error occurred."
}
```

Never expose:

- Stack traces
- SQL queries
- File paths
- Environment variables
- Internal exception messages

---

# Error Codes

Recommended error codes

```text
validation_error

authentication_failed

permission_denied

not_found

duplicate_resource

invalid_state

invalid_request

token_expired

token_invalid

mfa_required

rate_limit_exceeded

internal_server_error

service_unavailable
```

Error codes should remain stable across API versions.

---

# Exception Mapping

| Exception | HTTP Status | Error Code |
|------------|-------------|------------|
| ValidationError | 422 | validation_error |
| AuthenticationFailed | 401 | authentication_failed |
| PermissionDenied | 403 | permission_denied |
| Http404 | 404 | not_found |
| IntegrityError | 409 | duplicate_resource |
| BusinessRuleViolation | 400 | invalid_state |
| Exception | 500 | internal_server_error |

---

# Logging

Every unexpected exception should be logged with:

- Timestamp
- User ID
- Organization ID
- Endpoint
- HTTP Method
- Request ID
- Exception Type
- Stack Trace (server only)

Sensitive information should never be logged.

---

# Trace IDs

Production deployments should include a request identifier.

Example

```json
{
    "success": false,
    "code": "internal_server_error",
    "message": "An unexpected error occurred.",
    "trace_id": "7d82b3d2-31b4-4d71-b0f2-4f0d97dcb9ef"
}
```

This allows developers to correlate API errors with server logs.

---

# Best Practices

- Return consistent error responses.
- Use standard HTTP status codes.
- Keep messages user-friendly.
- Log unexpected exceptions.
- Never expose internal implementation details.
- Keep error codes stable.

---

# Anti-Patterns

Avoid:

- Returning HTML error pages
- Exposing stack traces
- Returning different error formats
- Using HTTP 200 for failures
- Returning database exceptions directly
- Leaking sensitive information

---

# Testing

Error handling tests should verify:

- Validation errors
- Authentication failures
- Permission failures
- Missing resources
- Duplicate resources
- Business rule violations
- Unexpected exceptions
- Standard response format

---

# Related Documents

- overview.md
- authentication.md
- serializers.md
- views.md
- filtering.md
- pagination.md
- versioning.md
- ../03-backend/services.md
- ../03-backend/validators.md
```