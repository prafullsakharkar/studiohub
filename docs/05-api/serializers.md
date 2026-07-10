# Serializers

## Overview

Serializers are responsible for transforming data between Python objects and JSON representations. In StudioHub, serializers validate incoming API data, serialize outgoing responses, and act as the boundary between the API layer and the Service layer.

Serializers should remain lightweight and should **never contain business logic**.

---

# Objectives

Serializers are responsible for:

- Request validation
- Response serialization
- Field transformation
- Nested object representation
- Input normalization
- Output formatting

Serializers are **not** responsible for:

- Business workflows
- Database queries
- Transactions
- Permission checks
- Event publishing

---

# Architecture

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
Database
```

---

# Directory Structure

```text
apps/<module>/

api/
└── serializers/
    ├── base.py
    ├── create.py
    ├── update.py
    ├── detail.py
    ├── list.py
    ├── nested.py
    ├── summary.py
    └── __init__.py
```

---

# Serializer Types

## Create Serializer

Used for POST requests.

Example

```text
ProjectCreateSerializer

DepartmentCreateSerializer

TaskCreateSerializer
```

Responsibilities

- Validate input
- Normalize request data
- Call Service layer

---

## Update Serializer

Used for PUT and PATCH requests.

Example

```text
ProjectUpdateSerializer

ShotUpdateSerializer
```

Responsibilities

- Validate updates
- Handle partial updates
- Pass validated data to Services

---

## Detail Serializer

Used for retrieving a single resource.

Example

```text
ProjectDetailSerializer
```

Includes

- Nested relationships
- Read-only fields
- Computed properties

---

## List Serializer

Used for collection endpoints.

Optimized for performance.

Should avoid unnecessary nested objects.

---

## Summary Serializer

Returns minimal data.

Typical fields

```text
id

uuid

code

name
```

Used for:

- Dropdowns
- Search results
- Autocomplete
- Foreign key selection

---

## Nested Serializer

Used inside parent serializers.

Example

```text
Project

↓

Sequence

↓

Shot
```

Should remain lightweight.

---

# Serializer Workflow

```text
Client

↓

APIView

↓

Serializer

↓

Validation

↓

Business Service

↓

Database

↓

Serializer

↓

JSON Response
```

---

# Validation

Serializers perform API-level validation.

Examples

- Required fields
- Data types
- Length constraints
- File validation
- Format validation

Business validation belongs in Validators.

---

# Read-Only Fields

Examples

```text
id

uuid

created_at

updated_at

created_by

updated_by
```

These fields should not be writable through the API.

---

# Write-Only Fields

Examples

```text
password

confirm_password

access_token

refresh_token
```

These values should never appear in API responses.

---

# Nested Serialization

Example

```text
Project

↓

Sequences

↓

Shots
```

Avoid excessive nesting to prevent performance issues.

---

# Dynamic Fields

Support optional field selection.

Example

```http
GET /api/v1/projects/?fields=id,name,status
```

Benefits

- Reduced payload size
- Better performance
- Flexible API responses

---

# Performance Considerations

Avoid

- N+1 queries
- Heavy nested serializers
- Large computed fields

Prefer

- select_related()
- prefetch_related()
- Summary serializers
- List serializers

---

# Best Practices

- One serializer per responsibility.
- Keep serializers lightweight.
- Delegate business logic to Services.
- Use nested serializers sparingly.
- Use Summary serializers for relationships.
- Validate API input only.

---

# Anti-Patterns

Avoid:

- ORM queries inside serializers
- Business logic
- Event publishing
- Transactions
- Permission checks
- Calling external services

---

# Testing

Serializer tests should verify

- Valid input
- Invalid input
- Required fields
- Read-only fields
- Write-only fields
- Nested serialization
- Response formatting

---

# Related Documents

- overview.md
- authentication.md
- filtering.md
- pagination.md
- ../03-backend/services.md
- ../03-backend/validators.md
```