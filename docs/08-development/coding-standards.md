# Coding Standards

## Overview

This document defines the coding standards used throughout the StudioHub codebase. Consistent coding practices improve readability, maintainability, collaboration, and long-term scalability.

Every contributor is expected to follow these standards regardless of experience level.

---

# Objectives

The coding standards promote:

- Consistency
- Readability
- Maintainability
- Scalability
- Testability
- Security
- Performance
- Collaboration

---

# Core Principles

StudioHub follows these engineering principles:

- Readability over cleverness
- Explicit over implicit
- Composition over inheritance
- Small, focused modules
- Single Responsibility Principle (SRP)
- SOLID principles
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple)

---

# General Rules

Always:

- Write self-explanatory code.
- Keep functions small.
- Prefer early returns.
- Remove dead code.
- Use meaningful names.
- Keep modules cohesive.
- Favor readability over optimization.

Avoid:

- Magic numbers
- Deep nesting
- Large classes
- Duplicate logic
- Hidden side effects

---

# Naming Conventions

## Variables

Use descriptive names.

Good

```python
organization_name
current_user
project_status
total_duration
```

Bad

```python
x
tmp
data1
obj
```

---

## Functions

Function names should describe an action.

Examples

```python
create_project()

calculate_duration()

archive_task()

validate_email()

send_notification()
```

---

## Classes

Use PascalCase.

Examples

```python
ProjectService

TaskValidator

OrganizationSelector

ReviewManager
```

---

## Constants

Use uppercase.

```python
MAX_UPLOAD_SIZE

DEFAULT_PAGE_SIZE

JWT_EXPIRATION_MINUTES
```

---

## Files

Use lowercase with underscores.

Examples

```text
project_service.py

organization_selector.py

user_validator.py
```

---

# Function Design

Functions should:

- Perform one task.
- Be easy to understand.
- Avoid hidden behavior.
- Return predictable results.

Preferred

```python
def create_project():
    ...
```

Avoid

```python
def process():
    ...
```

---

# Class Design

Classes should:

- Have one responsibility.
- Be easy to test.
- Be loosely coupled.
- Hide implementation details.

Avoid "God Objects" that manage unrelated responsibilities.

---

# File Organization

Each file should focus on a single concept.

Example

```text
services/
    project.py

selectors/
    project.py

validators/
    project.py

permissions/
    project.py
```

Avoid combining unrelated functionality.

---

# Comments

Comments should explain **why**, not **what**.

Good

```python
# Prevent duplicate project codes across organizations.
```

Avoid

```python
# Increment i
i += 1
```

Code should be self-explanatory.

---

# Error Handling

Raise meaningful exceptions.

Good

```python
raise ValidationError("Project code already exists.")
```

Avoid

```python
raise Exception("Error")
```

Use domain-specific exceptions whenever possible.

---

# Logging

Log meaningful operational events.

Examples

- User authentication
- Project creation
- Task assignment
- Background job failures
- External API errors

Do not log:

- Passwords
- Tokens
- Secrets
- Personal data

---

# Type Hints

All public functions should include type hints.

Example

```python
def calculate_duration(start: datetime, end: datetime) -> timedelta:
    ...
```

Type hints improve readability and tooling support.

---

# Imports

Organize imports into groups.

```python
Standard Library

Third-Party Packages

Local Applications
```

Example

```python
import uuid

from django.db import models

from apps.identity.models import User
```

---

# Code Formatting

Formatting is enforced using:

- Ruff
- Black-compatible formatting
- isort (via Ruff)

Formatting should never be performed manually.

---

# Complexity

Recommended limits

| Metric | Recommendation |
|----------|---------------|
| Function Length | < 40 lines |
| Class Length | < 300 lines |
| Nesting Depth | ≤ 3 |
| Parameters | ≤ 5 |

Large implementations should be refactored.

---

# Reusability

Before creating new functionality:

- Search existing services.
- Search selectors.
- Search validators.
- Search utilities.

Avoid duplicating existing implementations.

---

# Security

Never:

- Trust user input.
- Build SQL manually.
- Hardcode secrets.
- Disable permission checks.
- Log sensitive data.

Always validate external input.

---

# Documentation

Public classes and methods should include docstrings where the behavior is not immediately obvious.

Complex business rules should always be documented.

---

# Testing

New code should include:

- Unit tests
- Integration tests (where applicable)
- Regression tests for bug fixes

Untested code should not be merged.

---

# Pull Request Requirements

Every Pull Request should:

- Pass all tests.
- Pass Ruff.
- Pass type checking.
- Update documentation.
- Include meaningful commit history.

---

# Best Practices

- Keep code simple.
- Write expressive names.
- Refactor regularly.
- Prefer composition.
- Fail fast.
- Review code carefully.
- Keep documentation updated.

---

# Anti-Patterns

Avoid:

- Large methods
- Large classes
- Business logic in views
- Duplicate code
- Circular imports
- Hardcoded values
- Silent exception handling

---

# Related Documents

- overview.md
- project-structure.md
- python-style-guide.md
- django-guidelines.md
- react-guidelines.md
- git-workflow.md
- testing.md
- documentation.md
- ../03-backend/backend-standards.md
- ../10-security/secure-coding.md