# HTTP Status Codes Reference

## Overview

This document defines the HTTP status codes used throughout the StudioHub REST API. Consistent use of HTTP status codes improves API usability, simplifies client development, and enables predictable error handling.

Status codes should accurately represent the outcome of a request. Application-specific details should be returned in the response body rather than encoded into custom status codes.

---

# Objectives

The HTTP status code reference aims to:

- Standardize API responses
- Improve client interoperability
- Simplify error handling
- Promote RESTful practices
- Reduce ambiguity
- Support automated tooling
- Improve developer experience
- Ensure consistent API behavior

---

# Response Structure

Successful responses should generally follow a consistent structure.

Example:

```json
{
    "success": true,
    "data": {
        ...
    },
    "meta": {
        ...
    }
}
```

Error responses should provide meaningful information without exposing internal implementation details.

Example:

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Validation failed.",
        "details": {
            ...
        }
    }
}
```

---

# 1xx Informational

These responses indicate that the request has been received and processing continues.

| Status | Description | Usage |
|---------|-------------|-------|
| 100 Continue | Continue request | Rarely used |
| 101 Switching Protocols | Protocol upgrade | WebSocket upgrades |

Most StudioHub APIs will not return informational responses.

---

# 2xx Success

| Status | Description | Typical Usage |
|---------|-------------|---------------|
| 200 OK | Successful request | GET, PUT, PATCH |
| 201 Created | Resource created | POST |
| 202 Accepted | Accepted for asynchronous processing | Long-running jobs |
| 204 No Content | Successful request with no response body | DELETE |

---

## 200 OK

Use when:

- Retrieving resources
- Updating resources
- Successful custom actions returning data

Example:

```http
GET /api/v1/projects/
```

---

## 201 Created

Use when:

- Creating new resources

Example:

```http
POST /api/v1/projects/
```

The response should include the newly created resource or its location.

---

## 202 Accepted

Use for:

- Background jobs
- Report generation
- Long-running imports
- Asynchronous workflows

Clients should poll or subscribe for completion.

---

## 204 No Content

Use when:

- Resource deleted
- Successful action with no response payload

Do not include a response body.

---

# 3xx Redirection

Redirection responses are generally not used by REST APIs.

| Status | Description | Usage |
|---------|-------------|-------|
| 301 Moved Permanently | Permanent redirect | Rare |
| 302 Found | Temporary redirect | Rare |
| 304 Not Modified | Conditional requests | Caching |

Most API clients should not rely on redirects.

---

# 4xx Client Errors

Client errors indicate that the request cannot be processed due to issues with the request itself.

| Status | Description | Typical Usage |
|---------|-------------|---------------|
| 400 Bad Request | Invalid request syntax or parameters | Malformed input |
| 401 Unauthorized | Authentication required or invalid credentials | Login required |
| 403 Forbidden | Authenticated but not permitted | Permission denied |
| 404 Not Found | Resource does not exist | Invalid identifier |
| 405 Method Not Allowed | Unsupported HTTP method | Wrong HTTP verb |
| 409 Conflict | Resource conflict | Duplicate data |
| 410 Gone | Resource permanently removed | Deprecated resources |
| 412 Precondition Failed | Conditional request failed | ETag/version mismatch |
| 413 Payload Too Large | Request exceeds allowed size | File uploads |
| 415 Unsupported Media Type | Unsupported request content type | Invalid content type |
| 422 Unprocessable Entity | Validation errors | Business rule violations |
| 429 Too Many Requests | Rate limit exceeded | API throttling |

---

## 400 Bad Request

Return when:

- Invalid JSON
- Missing required parameters
- Invalid query parameters
- Malformed requests

---

## 401 Unauthorized

Return when:

- Missing authentication
- Invalid token
- Expired token

Authentication should always precede authorization checks.

---

## 403 Forbidden

Return when:

- User lacks required permissions
- Organization restrictions apply
- Access policy denies the request

---

## 404 Not Found

Return when:

- Resource does not exist
- Identifier is invalid
- Endpoint is unavailable

Avoid revealing the existence of protected resources.

---

## 409 Conflict

Return when:

- Duplicate unique values
- Version conflicts
- Concurrent update conflicts

---

## 422 Unprocessable Entity

Return when:

- Validation fails
- Business rules are violated
- Domain constraints prevent processing

Validation errors should clearly identify affected fields.

---

## 429 Too Many Requests

Return when:

- API rate limits are exceeded

Include appropriate retry information when available.

---

# 5xx Server Errors

Server errors indicate that the request could not be completed due to an internal failure.

| Status | Description | Typical Usage |
|---------|-------------|---------------|
| 500 Internal Server Error | Unexpected application error | Unhandled exceptions |
| 501 Not Implemented | Feature not implemented | Unsupported functionality |
| 502 Bad Gateway | Upstream gateway failure | Reverse proxy errors |
| 503 Service Unavailable | Temporary outage | Maintenance or overload |
| 504 Gateway Timeout | Upstream timeout | Dependent service unavailable |

---

## 500 Internal Server Error

Return when:

- Unexpected exceptions occur
- Internal failures cannot be mapped to another status

Avoid exposing stack traces or implementation details.

---

## 503 Service Unavailable

Return when:

- Planned maintenance
- Temporary infrastructure failures
- Dependency outages

Responses may include a `Retry-After` header where appropriate.

---

# Status Code Guidelines

Choose the most specific applicable status code.

Examples:

| Scenario | Status |
|----------|--------|
| Successful retrieval | 200 |
| Resource created | 201 |
| Resource deleted | 204 |
| Validation failure | 422 |
| Authentication required | 401 |
| Permission denied | 403 |
| Resource missing | 404 |
| Duplicate resource | 409 |
| Rate limit exceeded | 429 |
| Unexpected server error | 500 |

---

# Best Practices

- Use standard HTTP semantics.
- Return consistent response bodies.
- Separate HTTP status from business error codes.
- Avoid overloading status codes.
- Never return `200 OK` for failed operations.
- Provide actionable error messages.
- Log server-side failures for investigation.

---

# Anti-Patterns

Avoid:

- Returning `200 OK` for validation errors
- Using `500` for client mistakes
- Exposing internal exception details
- Creating custom HTTP status codes
- Returning inconsistent response structures
- Omitting meaningful error messages
- Ignoring REST conventions

---

# Related Documents

- overview.md
- error-codes.md
- ../05-api/overview.md
- ../05-api/error-handling.md
- ../10-security/api-security.md
- ../08-development/coding-standards.md