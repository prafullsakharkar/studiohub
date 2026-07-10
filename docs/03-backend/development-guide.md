# Backend Development Guide

## Overview

This document defines the backend development standards for StudioHub. Every backend module should follow these guidelines to maintain consistency, scalability, readability, and long-term maintainability.

The backend follows a **Domain-Driven Design (DDD)** approach with a **Modular Monolith** architecture and a strict separation of responsibilities.

---

# Backend Architecture

Every backend module follows the same layered architecture.

```text
API Layer
     │
Serializer Layer
     │
Service Layer
     │
Validator Layer
     │
Selector Layer
     │
Manager Layer
     │
QuerySet Layer
     │
Model Layer
     │
Database
```

Each layer has a single responsibility.

---

# Standard Module Structure

Every business module should follow this structure.

```text
apps/<module>/

├── admin/
├── api/
│   ├── filters/
│   ├── permissions/
│   ├── serializers/
│   ├── views/
│   └── urls.py
│
├── choices/
├── constants/
├── events/
├── exceptions/
├── managers/
├── middleware/
├── migrations/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── signals/
├── tasks/
├── tests/
├── utils/
├── validators/
└── views/
```

Every module should remain self-contained.

---

# Layer Responsibilities

## Models

Responsible for:

- Entity definition
- Database relationships
- Constraints
- Metadata

Must **not** contain business workflows.

---

## QuerySets

Responsible for:

- Query construction
- Filtering
- Ordering
- Reusable database logic

---

## Managers

Responsible for:

- ORM entry point
- Exposing reusable QuerySets

---

## Selectors

Responsible for:

- Read operations
- Search
- Reporting
- Dashboard queries

Selectors never modify data.

---

## Validators

Responsible for:

- Business validation
- Workflow validation
- State validation

Validators never persist data.

---

## Services

Responsible for:

- Business workflows
- Transactions
- Event publishing
- Lifecycle management

Services are the only layer allowed to modify business state.

---

## API

Responsible for:

- HTTP requests
- Authentication
- Permissions
- Serialization
- HTTP responses

Views remain thin.

---

# Dependency Rules

```text
API
 ↓
Service
 ↓
Validator
 ↓
Selector
 ↓
Manager
 ↓
QuerySet
 ↓
Model
```

Lower layers must never depend on upper layers.

Examples:

✅ Services can use Selectors.

✅ Selectors can use Managers.

❌ Models should never import Services.

❌ Validators should never import API classes.

---

# Naming Conventions

## Models

```text
Project
Department
Office
Shot
Version
```

---

## Managers

```text
ProjectManager
DepartmentManager
ShotManager
```

---

## QuerySets

```text
ProjectQuerySet
ShotQuerySet
DepartmentQuerySet
```

---

## Services

```text
ProjectService
ShotService
VersionService
```

---

## Selectors

```text
ProjectSelector
DepartmentSelector
ShotSelector
```

---

## Validators

```text
ProjectValidator
TaskValidator
ShotValidator
```

---

## Events

```text
ProjectCreatedEvent
ShotApprovedEvent
VersionPublishedEvent
```

---

# Coding Standards

## Models

Keep models focused on persistence.

Avoid:

- Business logic
- Notifications
- Workflow logic

---

## Services

Every write operation should:

- Validate
- Open transaction
- Execute workflow
- Publish event
- Return result

---

## Selectors

Selectors should:

- Optimize queries
- Use select_related()
- Use prefetch_related()
- Support filtering
- Support pagination

---

## Validators

Validators should:

- Raise domain exceptions
- Never save data
- Never publish events

---

# Exception Handling

Every module should define custom exceptions.

Example

```text
ProjectNotFound

DuplicateDepartment

InvalidWorkflowState

PermissionDenied
```

Avoid exposing internal exceptions directly through the API.

---

# Transactions

Every write workflow should use database transactions.

Example flow

```text
Begin Transaction

↓

Validate

↓

Business Logic

↓

Persist

↓

Commit

↓

Publish Event
```

---

# Event Publishing

Only Services publish events.

Examples

```text
DepartmentCreated

TaskAssigned

VersionApproved
```

Subscribers perform:

- Notifications
- Audit logging
- Analytics
- Background processing

---

# Testing Standards

Each module should include:

```text
tests/

models/

services/

selectors/

validators/

api/

permissions/
```

Test categories:

- Unit Tests
- Integration Tests
- API Tests
- Permission Tests
- Event Tests

---

# Documentation

Every module should include documentation for:

- Models
- Services
- API
- Events
- Permissions
- Workflows

Complex workflows should include diagrams.

---

# Best Practices

- Keep modules independent.
- Keep Services cohesive.
- Keep Models lightweight.
- Use Selectors for reads.
- Use Validators for business rules.
- Publish events after successful commits.
- Keep APIs consistent.
- Reuse Core components whenever possible.

---

# Anti-Patterns

Avoid:

- Fat Models
- Fat Views
- Business logic in Serializers
- Direct ORM access from API views
- Circular imports
- Cross-domain model manipulation
- Duplicated query logic
- Hard-coded permissions

---

# Code Review Checklist

Before merging code, verify:

- Architecture follows layering
- Tests pass
- No business logic in models
- Services use validators
- Selectors optimize queries
- Events are published correctly
- Permissions are enforced
- Documentation is updated

---

# Related Documents

- core.md
- models.md
- services.md
- selectors.md
- validators.md
- permissions.md
- authentication.md
- ../02-architecture/overview.md
- ../02-architecture/layered-architecture.md
- ../02-architecture/service-layer.md