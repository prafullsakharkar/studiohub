# Naming Conventions

## Overview

Consistent naming conventions improve readability, discoverability, maintainability, and collaboration across the StudioHub codebase. This document defines the naming standards for backend, frontend, infrastructure, APIs, databases, files, directories, tests, and documentation.

Names should clearly communicate intent rather than implementation details.

---

# Objectives

The naming conventions aim to:

- Improve code readability
- Reduce ambiguity
- Standardize project structure
- Simplify navigation
- Support automated tooling
- Improve onboarding
- Encourage consistency
- Reduce maintenance costs

---

# General Principles

Names should be:

- Descriptive
- Consistent
- Predictable
- Concise
- Domain-oriented
- Easy to search
- Free of unnecessary abbreviations

Avoid names that depend on implementation details.

---

# Python Modules

Use:

```text
snake_case.py
```

Examples:

```text
organization_service.py
project_selector.py
user_validator.py
shot_manager.py
```

Avoid:

```text
OrganizationService.py
OrgSvc.py
temp.py
```

---

# Python Packages

Use:

```text
snake_case
```

Examples:

```text
identity
organization
production
pipeline
notifications
```

---

# Classes

Use:

```text
PascalCase
```

Examples:

```python
OrganizationService
ProjectSelector
ShotValidator
UserManager
TaskSerializer
```

Class names should be nouns representing a single responsibility.

---

# Functions

Use:

```text
snake_case
```

Examples:

```python
create_project()
assign_task()
validate_membership()
publish_event()
```

Function names should describe actions.

---

# Variables

Use:

```text
snake_case
```

Examples:

```python
project_count
organization_name
current_user
task_status
```

Avoid unnecessary abbreviations.

---

# Constants

Use:

```text
UPPER_SNAKE_CASE
```

Examples:

```python
MAX_UPLOAD_SIZE
DEFAULT_PAGE_SIZE
JWT_EXPIRATION_MINUTES
CACHE_TIMEOUT
```

Constants should be immutable.

---

# Enums

Use:

```python
PascalCase
```

Enum members:

```python
UPPER_SNAKE_CASE
```

Example:

```python
class TaskStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
```

---

# Django Models

Model names:

```text
PascalCase
```

Examples:

```python
Organization
Department
Project
Sequence
Shot
Asset
Task
Review
```

Model names should represent business entities.

---

# Database Tables

Use:

```text
snake_case
```

Examples:

```text
organizations
projects
sequences
shots
assets
tasks
```

Plural table names improve readability.

---

# Database Columns

Use:

```text
snake_case
```

Examples:

```text
created_at
updated_at
project_id
organization_id
assigned_to
```

---

# API Endpoints

Use:

```text
kebab-case
```

Examples:

```text
/api/v1/projects/

/api/v1/project-members/

/api/v1/work-calendars/

/api/v1/review-requests/
```

Endpoints should represent resources rather than actions.

---

# URL Parameters

Use:

```text
snake_case
```

Example:

```text
?page=2

?page_size=50

?created_after=

?organization_id=
```

---

# JSON Fields

Use:

```json
snake_case
```

Example:

```json
{
  "project_name": "",
  "created_at": "",
  "assigned_user": ""
}
```

JSON naming should remain consistent across all APIs.

---

# React Components

Use:

```text
PascalCase.tsx
```

Examples:

```text
ProjectTable.tsx
ShotDetails.tsx
TaskEditor.tsx
UserAvatar.tsx
```

---

# React Hooks

Use:

```text
useCamelCase
```

Examples:

```typescript
useAuth()

useProject()

usePermissions()

usePagination()
```

---

# TypeScript Interfaces

Use:

```text
PascalCase
```

Examples:

```typescript
Project

User

TaskAssignment

ApiResponse
```

Avoid prefixing interfaces with `I`.

---

# CSS Classes

Use:

```text
kebab-case
```

Examples:

```text
project-card

user-avatar

dashboard-layout
```

---

# Environment Variables

Use:

```text
UPPER_SNAKE_CASE
```

Examples:

```text
DATABASE_URL

SECRET_KEY

REDIS_URL

JWT_SECRET

MEDIA_ROOT
```

---

# Docker Resources

Container names:

```text
kebab-case
```

Examples:

```text
studiohub-backend

studiohub-frontend

studiohub-postgres
```

---

# Git Branches

Recommended format:

```text
feature/project-management

bugfix/login-redirect

hotfix/security-patch

refactor/service-layer

docs/api-reference
```

---

# Git Commit Messages

Recommended style:

```text
feat(identity): add MFA support

fix(api): resolve pagination bug

docs(security): update incident response

refactor(core): simplify service layer
```

Follow a consistent commit convention across the project.

---

# Test Files

Use:

```text
test_<module>.py
```

Examples:

```text
test_project_service.py

test_user_selector.py

test_task_api.py
```

Frontend:

```text
ProjectTable.test.tsx

LoginForm.test.tsx
```

---

# Documentation Files

Use:

```text
kebab-case.md
```

Examples:

```text
coding-standards.md

api-security.md

deployment-strategy.md
```

---

# Best Practices

- Prefer descriptive names.
- Follow domain terminology.
- Keep naming consistent.
- Avoid abbreviations unless widely understood.
- Use singular names for classes and plural names for collections.
- Align names across backend, frontend, and APIs.
- Refactor names when responsibilities change.

---

# Anti-Patterns

Avoid:

- Generic names such as `data`, `temp`, or `utils`
- Inconsistent casing
- Unclear abbreviations
- Numeric suffixes (e.g., `project2`)
- Names tied to implementation details
- Mixed naming conventions
- Misleading terminology

---

# Related Documents

- overview.md
- coding-standards.md
- glossary.md
- configuration-reference.md
- ../08-development/contributing.md
- ../05-api/overview.md
- ../02-architecture/domain-model.md