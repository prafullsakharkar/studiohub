# Integration Testing Guide

## Overview

Integration testing verifies that multiple components work together correctly. Unlike unit tests, which validate isolated pieces of code, integration tests ensure that interactions between services, databases, APIs, events, and external infrastructure behave as expected.

StudioHub uses integration testing to validate business workflows, data consistency, and module interoperability while maintaining realistic application behavior.

---

# Objectives

Integration testing aims to:

- Verify component interactions
- Validate business workflows
- Detect integration failures
- Ensure transaction consistency
- Test database behavior
- Verify event processing
- Improve release confidence
- Prevent regression across modules

---

# Scope

Integration tests should cover:

- Services + Database
- Services + Selectors
- Services + Validators
- API + Database
- Authentication + Permissions
- Celery Tasks
- Event Publishing
- Cache Integration
- Multi-module Workflows

Integration tests should exercise real application components whenever practical.

---

# Characteristics

A good integration test should be:

- Realistic
- Repeatable
- Deterministic
- Maintainable
- Focused
- Independent

Integration tests are generally slower than unit tests but provide higher confidence.

---

# Testing Framework

StudioHub uses:

```text
pytest

pytest-django

factory_boy

faker

pytest-mock
```

Database transactions are enabled for integration testing.

---

# Test Organization

Organize tests within each application.

```text
apps/

identity/
    tests/
        test_integration.py

organization/
    tests/
        test_integration.py

production/
    tests/
        test_integration.py
```

Large applications may further organize tests by feature.

---

# Database Integration

Integration tests should verify:

- Model persistence
- Relationships
- Constraints
- Transactions
- Cascade behavior
- Soft deletion
- Audit fields

Use the real database configured for testing.

---

# Service Integration

Verify interactions between:

```text
API

↓

Serializer

↓

Validator

↓

Service

↓

Selector

↓

Database
```

The complete business flow should behave correctly.

---

# Transaction Testing

Validate transactional behavior.

Example scenarios:

- Successful transaction commit
- Rollback on validation failure
- Rollback on unexpected exception
- Nested transaction handling

Business data should remain consistent.

---

# Event Integration

Verify domain events.

Examples

- ProjectCreated
- UserInvited
- TaskAssigned
- ReviewApproved

Tests should confirm that expected events are published with correct payloads.

---

# Permission Integration

Verify permission enforcement across modules.

Example

```text
User

↓

Organization Membership

↓

Role

↓

Permission

↓

Service
```

Permissions should remain consistent throughout the workflow.

---

# API Integration

Integration tests should verify:

- Authentication
- Authorization
- Validation
- Persistence
- Serialization
- Response Structure

Every major endpoint should participate in integration testing.

---

# Background Tasks

Verify:

- Task Scheduling
- Retry Logic
- Task Completion
- Database Updates
- Event Publishing

Background jobs should produce predictable results.

---

# Cache Integration

Test interactions with Redis.

Examples

- Cache Population
- Cache Invalidation
- Cache Refresh
- Cache Expiration

Applications should behave correctly with both cache hits and cache misses.

---

# External Services

External systems should generally be mocked.

Examples

- Email Providers
- Cloud Storage
- Payment Gateways
- AI Services
- SMS Providers

The application should be tested without depending on third-party availability.

---

# Test Data

Use factories to generate realistic data.

Example

```python
organization = OrganizationFactory()

user = UserFactory(
    organization=organization
)

project = ProjectFactory(
    organization=organization
)
```

Avoid manually creating complex object graphs.

---

# Assertions

Verify:

- Database state
- Service results
- Published events
- Permission checks
- Response payloads
- Side effects

Assertions should focus on observable behavior.

---

# Failure Scenarios

Integration tests should include:

- Invalid permissions
- Missing dependencies
- Duplicate records
- Transaction rollback
- Database constraint violations
- External service failures

Failure paths are as important as successful workflows.

---

# Performance Considerations

Integration tests should:

- Minimize unnecessary setup
- Reuse factories
- Avoid redundant database operations
- Remain deterministic

Keep integration tests efficient while maintaining realism.

---

# Running Tests

Run all integration tests.

```bash
pytest -m integration
```

Run a specific module.

```bash
pytest apps/organization/tests/test_integration.py
```

Run a specific test.

```bash
pytest apps/organization/tests/test_integration.py::test_create_department_workflow
```

---

# Continuous Integration

Integration tests should execute:

- On every Pull Request
- Before releases
- During nightly builds (optional)
- After major dependency upgrades

CI should fail if any integration test fails.

---

# Best Practices

- Test complete workflows.
- Use realistic data.
- Keep tests isolated.
- Validate side effects.
- Verify transactions.
- Test permission boundaries.
- Keep scenarios easy to understand.

---

# Anti-Patterns

Avoid:

- Testing implementation details
- Overusing mocks
- Shared mutable test data
- Extremely large integration tests
- Hidden dependencies
- Network calls to real external services
- Flaky timing-based tests

---

# Related Documents

- overview.md
- unit-testing.md
- api-testing.md
- end-to-end-testing.md
- test-data.md
- ci-testing.md
- ../08-development/testing.md
- ../03-backend/testing.md
- ../10-security/security-testing.md