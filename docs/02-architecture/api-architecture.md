# API Architecture

## Overview

StudioHub follows an API-first architecture where every business capability is exposed through consistent, versionable REST APIs built with Django REST Framework (DRF). The API layer is intentionally thin, delegating business logic to services and data retrieval to selectors.

---

# Goals

The API architecture is designed to:

- Provide a consistent developer experience
- Keep endpoints predictable
- Support frontend and third-party integrations
- Separate transport concerns from business logic
- Enable API versioning

---

# API Request Lifecycle

```text
HTTP Request
      │
Authentication
      │
Permission Check
      │
APIView / ViewSet
      │
Serializer
      │
Business Service
 ┌────┴─────────┐
 │              │
Validator   Selector
 │              │
 └────┬─────────┘
      ▼
Database
      │
Serializer
      │
HTTP Response
```

---

# API Structure

Each domain exposes its own API package.

```text
apps/<domain>/api/
├── serializers/
├── views/
├── permissions/
├── filters/
├── pagination.py
├── routers.py
└── urls.py
```

---

# Layer Responsibilities

## Views

- Receive HTTP requests
- Authenticate users
- Check permissions
- Call services
- Return responses

Views should not contain business logic.

---

## Serializers

Responsibilities:

- Validate payloads
- Convert models to JSON
- Transform request data
- Define API contracts

---

## Services

Services perform business workflows.

Examples:

- Create Organization
- Invite Member
- Archive Department
- Complete Task

---

## Selectors

Selectors provide read-only access to data.

Responsibilities:

- Filtering
- Searching
- Aggregation
- Optimized queries

---

# Authentication

Supported mechanisms:

- JWT Access Tokens
- Refresh Tokens
- Token Rotation
- Multi-Factor Authentication
- Trusted Devices

---

# Authorization

Authorization is based on:

- Roles
- Permissions
- Organization Membership
- Object-level access

---

# Error Handling

API responses should use a consistent error format.

Example:

```json
{
  "code": "validation_error",
  "message": "Department code already exists.",
  "details": {}
}
```

---

# Pagination

Collection endpoints should support:

- Page Number Pagination
- Ordering
- Filtering
- Search

---

# Versioning

Future APIs should follow URI versioning.

```text
/api/v1/
/api/v2/
```

Backward compatibility should be maintained where practical.

---

# Best Practices

- Keep APIs resource-oriented.
- Keep views thin.
- Delegate business logic to services.
- Reuse serializers.
- Return consistent response formats.
- Secure endpoints by default.

---

# Anti-Patterns

- Business logic in views
- Direct ORM queries in API layer
- Inconsistent response structures
- Leaking internal exceptions
- Tight coupling between frontend and models

---

# Related Documents

- service-layer.md
- selector-pattern.md
- validator-pattern.md
- event-system.md
- database-design.md
