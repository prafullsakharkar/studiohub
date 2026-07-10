# API Testing Guide

## Overview

API testing verifies that StudioHub's REST APIs behave correctly, securely, and consistently. It validates request handling, authentication, authorization, business rules, validation, serialization, and response formats.

API tests ensure that frontend applications, mobile clients, third-party integrations, and automation tools can interact with the backend reliably.

API testing should focus on externally observable behavior rather than implementation details.

---

# Objectives

API testing aims to:

- Verify endpoint behavior
- Validate request and response schemas
- Ensure authentication and authorization
- Test business rules
- Prevent regressions
- Validate error handling
- Improve API reliability
- Support continuous delivery

---

# Scope

API testing should cover:

- Authentication
- Authorization
- CRUD Operations
- Validation
- Pagination
- Filtering
- Sorting
- Search
- File Uploads
- Bulk Operations
- Error Responses
- Rate Limiting

Every public endpoint should have automated API tests.

---

# API Layers

StudioHub APIs follow the request lifecycle below.

```text
HTTP Request

↓

Authentication

↓

Permissions

↓

Serializer Validation

↓

Service Layer

↓

Database

↓

Serializer

↓

HTTP Response
```

Each layer should be validated through API tests.

---

# Testing Framework

StudioHub uses:

```text
pytest

pytest-django

Django REST Framework APIClient

factory_boy

faker
```

API tests should use the DRF testing utilities whenever possible.

---

# Test Organization

Organize API tests by application.

```text
apps/

identity/
    tests/
        test_api.py

organization/
    tests/
        test_api.py

production/
    tests/
        test_api.py
```

Large applications may split tests by feature.

---

# Endpoint Coverage

Every endpoint should validate:

- Success responses
- Invalid input
- Missing required fields
- Invalid permissions
- Authentication failures
- Resource not found
- Duplicate data
- Boundary values

Both positive and negative scenarios should be tested.

---

# Authentication Testing

Verify:

- Login
- Logout
- Token Refresh
- Expired Tokens
- Invalid Tokens
- MFA (if enabled)

Example workflow

```text
Login

↓

Receive JWT

↓

Call Protected Endpoint

↓

Receive Response
```

Protected endpoints should reject unauthenticated requests.

---

# Authorization Testing

Verify:

- Role Permissions
- Object Permissions
- Organization Isolation
- Ownership Rules
- Feature Restrictions

Authorization should always be enforced server-side.

---

# Validation Testing

Test validation for:

- Required Fields
- Invalid Data Types
- Invalid Formats
- Duplicate Values
- Business Rules
- Length Constraints
- Invalid Relationships

Validation responses should be clear and consistent.

---

# CRUD Testing

Every CRUD endpoint should verify:

Create

- Valid request
- Invalid request
- Duplicate records

Read

- Existing resource
- Missing resource
- Permission denied

Update

- Valid update
- Partial update
- Invalid update

Delete

- Successful deletion
- Soft deletion
- Permission denied

---

# Pagination

Verify:

- Default page size
- Custom page size
- Next page
- Previous page
- Total count

List endpoints should never return unbounded datasets.

---

# Filtering

Validate supported filters.

Examples

```text
Status

Organization

Owner

Date Range

Priority
```

Filtering should produce predictable results.

---

# Sorting

Verify sorting for:

- Ascending
- Descending
- Multiple Fields
- Invalid Sort Parameters

Sorting should remain deterministic.

---

# Search

Search functionality should validate:

- Exact Matches
- Partial Matches
- Empty Results
- Case Insensitivity (where applicable)
- Special Characters

Search should not expose unauthorized data.

---

# Response Validation

Verify:

- HTTP Status Codes
- JSON Structure
- Field Types
- Required Fields
- Optional Fields
- Metadata
- Pagination Information

Responses should remain backward compatible whenever possible.

---

# Error Handling

Validate standardized errors.

Examples

```text
400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Unprocessable Entity

500 Internal Server Error
```

Error responses should follow a consistent schema.

---

# File Upload Testing

Validate:

- Valid File Types
- Invalid File Types
- File Size Limits
- Duplicate Uploads
- Missing Files

Uploaded files should be validated before processing.

---

# Bulk Operations

Bulk APIs should verify:

- Bulk Create
- Bulk Update
- Bulk Delete
- Partial Failures
- Transaction Rollback

Bulk operations should preserve data consistency.

---

# Rate Limiting

Verify:

- Request Limits
- Retry Behavior
- Appropriate HTTP Status
- Response Headers

Rate limiting should protect the API without affecting normal usage.

---

# Performance

API tests should also monitor:

- Response Time
- Query Count
- Payload Size

Performance expectations should be documented for critical endpoints.

---

# Running Tests

Run all API tests.

```bash
pytest -m api
```

Run a specific module.

```bash
pytest apps/identity/tests/test_api.py
```

Run a single test.

```bash
pytest apps/identity/tests/test_api.py::test_login_success
```

---

# Continuous Integration

API tests should execute:

- On every Pull Request
- Before releases
- During nightly builds
- After dependency upgrades

Failed API tests should block merges to protected branches.

---

# Best Practices

- Test every endpoint.
- Validate success and failure cases.
- Use factories for test data.
- Verify response schemas.
- Test authorization thoroughly.
- Keep tests deterministic.
- Document API behavior through tests.

---

# Anti-Patterns

Avoid:

- Testing implementation details
- Depending on endpoint execution order
- Shared mutable test data
- Hardcoded identifiers
- Ignoring error responses
- Excessive mocking of the application under test
- Unbounded API performance assumptions

---

# Related Documents

- overview.md
- unit-testing.md
- integration-testing.md
- frontend-testing.md
- security-testing.md
- coverage.md
- ../08-development/testing.md
- ../03-backend/api.md
- ../10-security/api-security.md