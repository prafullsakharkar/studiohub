# Error Codes Reference

## Overview

StudioHub uses standardized application-level error codes to provide clients with consistent, machine-readable error information regardless of the HTTP status code. Error codes complement HTTP status codes by identifying the specific reason a request failed.

Applications should rely on error codes for programmatic handling and on error messages for user-friendly feedback.

---

# Objectives

The error code reference aims to:

- Standardize API error responses
- Simplify client-side error handling
- Improve troubleshooting
- Support localization
- Improve monitoring
- Enable analytics
- Maintain consistency
- Improve developer experience

---

# Error Response Format

Every API error should follow a consistent structure.

Example:

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Validation failed.",
        "details": {
            "email": [
                "This field is required."
            ]
        },
        "request_id": "d1c84b1f-7b3a-4db8-9a7e-3d8e12b0ef12"
    }
}
```

The `request_id` enables correlation with server logs.

---

# Error Code Naming

Error codes should:

- Use `UPPER_SNAKE_CASE`
- Be stable over time
- Represent business meaning
- Avoid implementation details

Examples:

```text
VALIDATION_ERROR

PERMISSION_DENIED

RESOURCE_NOT_FOUND

PROJECT_ALREADY_EXISTS
```

---

# Validation Errors

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | One or more validation rules failed |
| `REQUIRED_FIELD_MISSING` | Required input missing |
| `INVALID_FORMAT` | Invalid data format |
| `INVALID_VALUE` | Invalid value supplied |
| `VALUE_OUT_OF_RANGE` | Value exceeds permitted range |

Validation errors should identify affected fields whenever possible.

---

# Authentication Errors

| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | User is not authenticated |
| `INVALID_CREDENTIALS` | Invalid username or password |
| `INVALID_TOKEN` | Access token is invalid |
| `TOKEN_EXPIRED` | Authentication token has expired |
| `MFA_REQUIRED` | Multi-factor authentication required |
| `MFA_INVALID_CODE` | MFA verification failed |
| `ACCOUNT_LOCKED` | User account is locked |
| `ACCOUNT_DISABLED` | User account is disabled |

Authentication failures should not reveal sensitive information.

---

# Authorization Errors

| Code | Description |
|------|-------------|
| `PERMISSION_DENIED` | Insufficient permissions |
| `ROLE_REQUIRED` | Required role missing |
| `ORGANIZATION_ACCESS_DENIED` | Organization membership required |
| `RESOURCE_FORBIDDEN` | Resource access prohibited |

Authorization responses should avoid revealing protected resources.

---

# Resource Errors

| Code | Description |
|------|-------------|
| `RESOURCE_NOT_FOUND` | Requested resource does not exist |
| `RESOURCE_ALREADY_EXISTS` | Duplicate resource |
| `RESOURCE_CONFLICT` | Resource state conflict |
| `RESOURCE_ARCHIVED` | Resource has been archived |
| `RESOURCE_LOCKED` | Resource is locked |

Resource errors should map to appropriate HTTP status codes.

---

# Business Rule Errors

| Code | Description |
|------|-------------|
| `BUSINESS_RULE_VIOLATION` | Business constraint violated |
| `INVALID_STATUS_TRANSITION` | Illegal lifecycle transition |
| `DEPENDENCY_EXISTS` | Related resources prevent operation |
| `QUOTA_EXCEEDED` | Usage limit exceeded |
| `LICENSE_LIMIT_REACHED` | License restriction reached |

Business rules should remain independent of transport protocols.

---

# File and Storage Errors

| Code | Description |
|------|-------------|
| `FILE_TOO_LARGE` | Upload exceeds size limit |
| `INVALID_FILE_TYPE` | Unsupported file type |
| `UPLOAD_FAILED` | File upload unsuccessful |
| `DOWNLOAD_FAILED` | File retrieval unsuccessful |
| `STORAGE_UNAVAILABLE` | Storage backend unavailable |

Storage failures should be monitored operationally.

---

# API Errors

| Code | Description |
|------|-------------|
| `UNSUPPORTED_MEDIA_TYPE` | Unsupported content type |
| `RATE_LIMIT_EXCEEDED` | API rate limit reached |
| `INVALID_API_VERSION` | Unsupported API version |
| `INVALID_REQUEST` | Malformed request |
| `METHOD_NOT_ALLOWED` | Unsupported HTTP method |

API errors should align with REST conventions.

---

# Infrastructure Errors

| Code | Description |
|------|-------------|
| `DATABASE_UNAVAILABLE` | Database unavailable |
| `CACHE_UNAVAILABLE` | Cache unavailable |
| `QUEUE_UNAVAILABLE` | Message queue unavailable |
| `EXTERNAL_SERVICE_FAILURE` | Upstream dependency failure |
| `SERVICE_UNAVAILABLE` | Temporary service outage |

Infrastructure failures should trigger operational alerts.

---

# Internal Errors

| Code | Description |
|------|-------------|
| `INTERNAL_SERVER_ERROR` | Unexpected application failure |
| `UNKNOWN_ERROR` | Unclassified failure |
| `CONFIGURATION_ERROR` | Invalid runtime configuration |
| `OPERATION_FAILED` | General operation failure |

Internal errors should never expose implementation details.

---

# Error Code Guidelines

When introducing new error codes:

- Keep names stable
- Use clear business terminology
- Document every code
- Avoid duplicates
- Map consistently to HTTP status codes
- Maintain backward compatibility

Applications should not depend on error message text.

---

# Localization

Error messages may be localized.

Clients should rely on:

- `code` for logic
- `message` for presentation
- `details` for validation context

Localization should not affect error code stability.

---

# Logging

Server logs should include:

- Error code
- Request ID
- User ID (when available)
- Organization ID
- Stack trace (internal only)

Sensitive information must never be logged.

---

# Best Practices

- Use consistent error codes.
- Separate HTTP status from business errors.
- Keep codes stable.
- Include request identifiers.
- Provide actionable validation details.
- Document every new code.
- Monitor recurring errors.

---

# Anti-Patterns

Avoid:

- Dynamic error codes
- Exposing stack traces
- Reusing codes for unrelated failures
- Client logic based on message text
- Missing documentation
- Generic "UNKNOWN_ERROR" overuse
- Inconsistent naming

---

# Related Documents

- overview.md
- http-status-codes.md
- configuration-reference.md
- ../05-api/error-handling.md
- ../05-api/overview.md
- ../10-security/api-security.md
- ../11-operations/logging.md