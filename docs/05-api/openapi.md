# OpenAPI Documentation

## Overview

StudioHub follows an **API-First** development approach. Every public API endpoint must be documented using the **OpenAPI Specification (OAS 3.x)**, allowing automatic generation of interactive documentation, client SDKs, and integration contracts.

OpenAPI documentation serves as the single source of truth for API consumers, frontend developers, QA engineers, and third-party integrations.

---

# Objectives

The OpenAPI documentation provides:

- Interactive API documentation
- Endpoint discovery
- Request examples
- Response examples
- Authentication documentation
- Error documentation
- SDK generation
- API contract validation

---

# Documentation Architecture

```text
APIView

↓

Serializer

↓

OpenAPI Schema

↓

Swagger UI

↓

ReDoc

↓

Client SDKs
```

---

# Supported Documentation

StudioHub provides:

- OpenAPI 3.x Specification
- Swagger UI
- ReDoc
- JSON Schema
- YAML Schema

---

# Documentation URL

Production

```text
/api/docs/
```

Swagger

```text
/api/docs/swagger/
```

ReDoc

```text
/api/docs/redoc/
```

OpenAPI JSON

```text
/api/schema/
```

OpenAPI YAML

```text
/api/schema.yaml
```

---

# API Groups

Endpoints should be grouped by business domain.

```text
Authentication

Users

Roles

Permissions

Organizations

Departments

Teams

Projects

Sequences

Shots

Tasks

Versions

Reviews

Assets
```

---

# Endpoint Documentation

Every endpoint should include:

- Summary
- Description
- Tags
- Authentication
- Permissions
- Request Parameters
- Request Body
- Response Examples
- Error Responses

---

# Request Documentation

Each request should document:

- Required fields
- Optional fields
- Data types
- Validation rules
- Default values

Example

```json
{
    "name": "Avatar",
    "code": "AVATAR",
    "status": "active"
}
```

---

# Response Documentation

Every response should include examples.

Success

```json
{
    "success": true,
    "message": "Project created successfully.",
    "data": {}
}
```

Error

```json
{
    "success": false,
    "code": "validation_error",
    "message": "Validation failed."
}
```

---

# Authentication Documentation

Protected endpoints should clearly indicate authentication requirements.

Supported methods

- JWT Bearer Token
- Refresh Token

Example

```http
Authorization: Bearer <access_token>
```

---

# Parameter Documentation

Document every parameter.

Examples

Query Parameters

```text
?page=1

?page_size=25

?search=avatar

?ordering=name
```

Path Parameters

```text
/projects/{project_id}
```

---

# Response Codes

Every endpoint should document supported status codes.

Example

| Status | Description |
|----------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |

---

# Examples

Every endpoint should include examples for:

- Request
- Successful Response
- Validation Error
- Authentication Error
- Permission Error

Examples improve developer experience.

---

# Tags

Recommended tags

```text
Authentication

Identity

Organization

Production

Projects

Shots

Tasks

Reviews

Assets

Administration
```

---

# Schema Reuse

Reusable schemas should be shared across endpoints.

Examples

```text
Project

ProjectSummary

ProjectCreate

ProjectUpdate

ValidationError

Pagination
```

This avoids duplication and improves consistency.

---

# Versioning

Each API version should expose its own schema.

Examples

```text
/api/v1/schema/

/api/v2/schema/
```

---

# SDK Generation

OpenAPI schemas can generate SDKs for:

- TypeScript
- Python
- Java
- C#
- Go
- Kotlin
- Swift

This ensures client consistency.

---

# Best Practices

- Document every endpoint.
- Keep schemas synchronized with the implementation.
- Provide realistic examples.
- Reuse schema components.
- Document authentication requirements.
- Keep descriptions concise and clear.

---

# Anti-Patterns

Avoid:

- Undocumented endpoints
- Missing examples
- Duplicate schemas
- Outdated documentation
- Inconsistent naming
- Missing error responses

---

# Testing

Documentation should be verified for:

- Schema validity
- Endpoint coverage
- Example correctness
- Authentication documentation
- Response consistency
- Version compatibility

---

# Related Documents

- overview.md
- authentication.md
- responses.md
- serializers.md
- versioning.md
- error-handling.md
- api-standards.md