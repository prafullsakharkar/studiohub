# Python Style Guide

## Overview

This document defines the Python coding standards for the StudioHub backend. It extends PEP 8 with project-specific conventions to ensure that all Python code is consistent, readable, maintainable, and suitable for enterprise-scale development.

All backend code should comply with this guide.

---

# Objectives

The Python style guide promotes:

- Readability
- Maintainability
- Consistency
- Type Safety
- Testability
- Performance
- Security
- Scalability

---

# Python Version

StudioHub uses:

```text
Python 3.14
```

Developers should use language features supported by the project's target version.

---

# Code Formatting

Formatting is enforced automatically.

Tools

```text
Ruff

Black-compatible Formatting

isort (via Ruff)
```

Developers should not manually format code.

---

# Import Order

Imports should follow this order.

```python
# Standard Library
from datetime import datetime
from uuid import UUID

# Third-Party
from django.db import models
from rest_framework import serializers

# Local Applications
from apps.identity.models import User
from apps.production.models import Project
```

Separate import groups with a blank line.

---

# Naming Conventions

## Modules

Use lowercase with underscores.

```text
project_service.py

task_validator.py

user_selector.py
```

---

## Variables

Use descriptive snake_case.

Good

```python
organization_name

current_user

project_status
```

Bad

```python
x

obj

tmp
```

---

## Constants

Use uppercase.

```python
MAX_FILE_SIZE

DEFAULT_PAGE_SIZE

JWT_EXPIRATION
```

---

## Classes

Use PascalCase.

```python
ProjectService

OrganizationValidator

TaskSelector
```

---

## Functions

Use snake_case and action-oriented names.

```python
create_project()

validate_email()

archive_task()

calculate_duration()
```

---

# Type Hints

All public functions should include type hints.

Example

```python
from datetime import datetime


def calculate_duration(
    start: datetime,
    end: datetime,
) -> int:
    return int((end - start).total_seconds())
```

Avoid omitting return types.

---

# Function Design

Functions should:

- Perform one task
- Be short
- Have predictable behavior
- Avoid side effects
- Return consistent types

Recommended maximum length

```text
40 lines
```

---

# Class Design

Classes should:

- Have a single responsibility
- Be easy to test
- Avoid unnecessary inheritance
- Use composition where appropriate

Large "manager" classes should be refactored.

---

# Docstrings

Public modules, classes, and methods should include docstrings when their behavior is not immediately obvious.

Example

```python
class ProjectService:
    """Business operations related to project management."""
```

Avoid redundant docstrings that merely restate the function name.

---

# Exception Handling

Raise specific exceptions.

Good

```python
raise ValidationError("Project already exists.")
```

Avoid

```python
raise Exception("Something went wrong.")
```

Catch only exceptions that can be handled meaningfully.

---

# Context Managers

Prefer context managers for resource management.

Example

```python
with transaction.atomic():
    service.create(data)
```

Avoid manual cleanup whenever a context manager is available.

---

# Boolean Expressions

Prefer explicit expressions.

Good

```python
if user.is_active:
    ...
```

Avoid

```python
if user.is_active == True:
    ...
```

---

# Collections

Prefer comprehensions when readability is maintained.

Good

```python
emails = [user.email for user in users]
```

Avoid deeply nested comprehensions.

---

# Enumerations

Use Django choices or Python enums for fixed values.

Example

```python
class Status(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"
```

Avoid hardcoded string literals throughout the codebase.

---

# Logging

Use structured logging.

Log:

- Business events
- Warnings
- Errors
- Background task failures

Never log:

- Passwords
- Secrets
- Tokens
- Sensitive personal information

---

# Django ORM

Prefer ORM methods over raw SQL.

Good

```python
Project.objects.filter(status="ACTIVE")
```

Avoid raw SQL unless absolutely necessary and documented.

---

# Magic Values

Avoid magic numbers and strings.

Good

```python
DEFAULT_PAGE_SIZE = 50
```

Avoid

```python
page_size = 50
```

Repeated values should become constants.

---

# Dependency Injection

Prefer constructor or parameter injection over global state.

Services should receive dependencies explicitly whenever practical.

---

# Testing

Every new function should be testable.

Avoid hidden dependencies that make testing difficult.

---

# Performance

Optimize only after measuring.

Prefer:

- `select_related()`
- `prefetch_related()`
- Query optimization
- Bulk operations

Avoid premature optimization.

---

# Security

Always:

- Validate input
- Escape output where necessary
- Use parameterized ORM queries
- Respect authorization checks
- Handle secrets securely

---

# Best Practices

- Write readable code.
- Use descriptive names.
- Add type hints.
- Keep functions small.
- Prefer composition.
- Use the Django ORM.
- Refactor continuously.

---

# Anti-Patterns

Avoid:

- God classes
- Global mutable state
- Silent exception handling
- Raw SQL without justification
- Long functions
- Circular imports
- Hardcoded configuration

---

# Related Documents

- overview.md
- coding-standards.md
- django-guidelines.md
- testing.md
- documentation.md
- ../03-backend/backend-standards.md
- ../03-backend/services.md
- ../03-backend/selectors.md
- ../10-security/secure-coding.md