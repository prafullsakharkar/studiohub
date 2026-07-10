# Services

## Overview

The Service layer is the heart of StudioHub's business logic. Every business operation that modifies the application's state is executed through a Service.

Services coordinate workflows, execute business rules, validate data, manage database transactions, publish domain events, and communicate with other domain services.

The Service layer ensures that models remain lightweight and API views remain thin.

---

# Objectives

The Service layer is responsible for:

- Executing business workflows
- Managing transactions
- Coordinating multiple models
- Calling validators
- Using selectors for data retrieval
- Publishing domain events
- Updating audit information
- Managing lifecycle operations

Services are the only layer responsible for changing business state.

---

# Architecture

```text
Client
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
 ┌──┴─────────────┐
 │                │
 ▼                ▼
Validator     Selector
 │                │
 └──────┬─────────┘
        ▼
     Manager
        ▼
     QuerySet
        ▼
      Model
        ▼
    PostgreSQL
```

---

# Service Organization

Each module contains its own services.

```text
apps/

core/
    services/

identity/
    services/

organization/
    services/

production/
    services/
```

Example

```text
apps/organization/services/

organization.py
department.py
office.py
team.py
membership.py
```

---

# Base Service

All business services inherit from the Core BusinessService.

Typical responsibilities include:

- Validation
- Transactions
- Event publishing
- Cache invalidation
- Audit updates
- Exception handling

Example

```python
class DepartmentService(BusinessService):
    ...
```

---

# CRUD Workflow

## Create

```text
Validate

↓

Business Rules

↓

Create Entity

↓

Publish Event

↓

Return Entity
```

---

## Update

```text
Load Entity

↓

Validate Changes

↓

Update Entity

↓

Publish Event

↓

Return Entity
```

---

## Delete

```text
Validate

↓

Soft Delete

↓

Publish Event

↓

Return Result
```

---

# Service Responsibilities

Services should:

- Execute business workflows
- Coordinate multiple entities
- Open database transactions
- Call validators
- Publish events
- Call selectors
- Update audit fields

Services should not:

- Render HTTP responses
- Parse HTTP requests
- Build database queries
- Format JSON
- Perform presentation logic

---

# Transaction Management

Every write operation should execute inside a transaction.

Example flow

```text
Begin Transaction

↓

Validate

↓

Business Logic

↓

Save Changes

↓

Commit

↓

Publish Event
```

Rollback occurs automatically when an exception is raised.

---

# Validation

Before modifying data, services should invoke validators.

Example

```text
DepartmentService

↓

DepartmentValidator

↓

Business Rules

↓

Continue
```

Validation is never performed inside models.

---

# Selectors

Services never query the ORM directly.

Instead they call selectors.

Example

```text
DepartmentService

↓

DepartmentSelector

↓

Department.objects.active()
```

This keeps business logic independent from query implementation.

---

# Event Publishing

After a successful transaction, services publish domain events.

Example

```text
DepartmentCreated

↓

EventBus

↓

Audit

Notification

Analytics

Background Jobs
```

---

# Cross-Domain Communication

Services may coordinate with other domains through their public services.

Example

```text
OrganizationService

↓

IdentityService

↓

Create Organization Owner
```

Avoid accessing another domain's models directly.

---

# Error Handling

Services raise domain-specific exceptions.

Examples

- ValidationError
- BusinessRuleViolation
- EntityNotFound
- DuplicateEntity
- InvalidOperation

API views translate these exceptions into HTTP responses.

---

# Common Services

## Core

- AuditService
- LifecycleService
- SoftDeleteService
- CacheService

---

## Identity

- UserService
- AuthenticationService
- PermissionService
- RoleService
- MFAService

---

## Organization

- OrganizationService
- DepartmentService
- OfficeService
- TeamService
- MembershipService
- InvitationService

---

## Production

- ProjectService
- SequenceService
- ShotService
- TaskService
- VersionService
- PublishService
- ReviewService

---

# Best Practices

- One responsibility per service.
- Keep services cohesive.
- Use transactions for writes.
- Publish events after commit.
- Keep views thin.
- Keep models lightweight.
- Use selectors for reads.
- Validate before persistence.

---

# Anti-Patterns

Avoid:

- Business logic in views
- Business logic in models
- Direct ORM access from API views
- Long-running transactions
- Calling external APIs inside transactions
- Circular service dependencies

---

# Testing

Services should be unit tested independently.

Typical test cases include:

- Successful workflow
- Validation failure
- Transaction rollback
- Event publication
- Permission checks
- Audit updates

---

# Related Documents

- models.md
- selectors.md
- validators.md
- events.md
- authentication.md
- ../02-architecture/service-layer.md
- ../02-architecture/event-system.md
```