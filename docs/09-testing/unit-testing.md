# Unit Testing Guide

## Overview

Unit testing verifies individual units of code in isolation. In StudioHub, a unit typically refers to a single function, class, service, validator, selector, permission class, or utility.

Unit tests provide rapid feedback, prevent regressions, and enable safe refactoring. They form the foundation of the testing strategy and should comprise the majority of the automated test suite.

A good unit test should execute quickly, produce deterministic results, and not depend on external systems.

---

# Objectives

Unit testing aims to:

- Validate business logic
- Detect regressions early
- Support refactoring
- Improve code quality
- Document expected behavior
- Reduce debugging effort
- Increase developer confidence
- Enable continuous integration

---

# Scope

Unit tests should cover:

- Services
- Validators
- Selectors
- Managers
- QuerySets
- Permissions
- Utility Functions
- Domain Events
- Business Rules
- Custom Exceptions

Unit tests should not require network access or external services.

---

# Characteristics

A good unit test should be:

- Fast
- Independent
- Repeatable
- Deterministic
- Readable
- Focused
- Easy to maintain

---

# Testing Framework

Backend testing uses:

```text
pytest

pytest-django

pytest-cov

factory_boy

faker
```

---

# Test Organization

Tests should remain close to the application they validate.

```text
apps/

identity/
    tests/

organization/
    tests/

production/
    tests/

assets/
    tests/
```

Within each module:

```text
tests/

conftest.py

factories.py

test_models.py

test_services.py

test_selectors.py

test_validators.py

test_permissions.py

test_api.py
```

---

# Naming Convention

Test names should describe expected behavior.

Good

```python
def test_create_project_success():
    ...
```

```python
def test_duplicate_email_is_rejected():
    ...
```

Avoid

```python
def test_case():
    ...
```

---

# Test Structure

StudioHub follows the Arrange–Act–Assert pattern.

```python
def test_create_project():
    # Arrange

    # Act

    # Assert
```

Each section should remain concise.

---

# Factories

Use factories instead of manually creating objects.

Example

```python
organization = OrganizationFactory()

user = UserFactory()

project = ProjectFactory(
    organization=organization
)
```

Factories improve readability and reduce duplication.

---

# Mocking

Mock only external dependencies.

Examples

- Email Service
- Payment Gateway
- AI Service
- Cloud Storage
- Third-party APIs

Avoid mocking business logic that belongs to the system under test.

---

# Database Usage

Database access is acceptable when testing:

- Models
- QuerySets
- Managers
- Selectors
- Services

Pure utility functions should not require database access.

---

# Business Rules

Business rules should receive comprehensive coverage.

Examples

- Duplicate prevention
- Permission enforcement
- Workflow transitions
- Validation rules
- Status changes
- Organization boundaries

---

# Validation Testing

Validators should test:

- Valid input
- Invalid input
- Missing values
- Boundary conditions
- Duplicate records
- Permission failures

Validation failures should produce predictable exceptions.

---

# Service Testing

Every service should verify:

- Successful execution
- Validation failures
- Transaction rollback
- Event publishing
- Permission enforcement
- Side effects

Services contain most business logic and therefore require extensive testing.

---

# Selector Testing

Selectors should verify:

- Correct filtering
- Sorting
- Pagination
- Organization isolation
- Performance assumptions
- Empty results

Selectors should never modify data.

---

# Permission Testing

Permissions should validate:

- Authorized access
- Unauthorized access
- Role inheritance
- Organization membership
- Object ownership

Every permission branch should be tested.

---

# Exception Testing

Expected exceptions should be verified.

Example

```python
with pytest.raises(
    ValidationError
):
    service.create(data)
```

Do not ignore exception behavior.

---

# Edge Cases

Test:

- Empty collections
- Maximum limits
- Duplicate values
- Invalid identifiers
- Missing relationships
- Boundary conditions

Edge cases often reveal hidden defects.

---

# Performance

Unit tests should:

- Execute quickly
- Avoid unnecessary database queries
- Avoid external services
- Complete within seconds

Slow tests should be reviewed.

---

# Coverage Goals

Recommended targets:

| Component | Coverage |
|-----------|----------|
| Services | 95% |
| Validators | 95% |
| Permissions | 95% |
| Selectors | 90% |
| Utilities | 95% |
| Managers | 90% |

Coverage is a quality indicator—not the objective itself.

---

# Running Tests

Run all tests.

```bash
pytest
```

Run a specific module.

```bash
pytest apps/identity/tests/
```

Run a single file.

```bash
pytest apps/identity/tests/test_services.py
```

Run one test.

```bash
pytest apps/identity/tests/test_services.py::test_create_user_success
```

---

# Best Practices

- Test observable behavior.
- Keep tests independent.
- Use factories.
- Test edge cases.
- Test negative scenarios.
- Keep assertions focused.
- Refactor tests as code evolves.

---

# Anti-Patterns

Avoid:

- Testing private methods
- Excessive mocking
- Shared mutable test data
- Large monolithic tests
- Hidden dependencies
- Sleeping during tests
- Random test behavior

---

# Related Documents

- overview.md
- integration-testing.md
- api-testing.md
- test-data.md
- coverage.md
- ../08-development/testing.md
- ../03-backend/testing.md
- ../10-security/security-testing.md