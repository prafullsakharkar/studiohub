# Validators

## Overview

Validators are responsible for enforcing business rules throughout StudioHub. They ensure that every business operation complies with domain-specific constraints before data is persisted.

Unlike Django model validation or serializer validation, validators focus exclusively on business logic and domain integrity. They are invoked by Services before any state-changing operation.

Validators never save data, execute workflows, or publish events.

---

# Objectives

The Validator layer is responsible for:

- Business rule validation
- Cross-entity validation
- State transition validation
- Permission-aware validation
- Organization-level validation
- Preventing invalid operations
- Raising domain exceptions

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
    ▼
Validator
    │
    ▼
Selector
    │
    ▼
Database
```

---

# Directory Structure

Each module contains its own validators.

```text
apps/

core/
    validators/

identity/
    validators/

organization/
    validators/

production/
    validators/
```

Example

```text
apps/organization/validators/

organization.py
department.py
office.py
team.py
membership.py
```

---

# Responsibilities

Validators should:

- Validate business rules
- Verify entity state
- Check relationships
- Ensure uniqueness beyond database constraints
- Validate workflow transitions
- Raise domain exceptions

Validators should not:

- Save models
- Delete records
- Query unrelated domains unnecessarily
- Publish events
- Return HTTP responses

---

# Validation Workflow

```text
Client

↓

APIView

↓

Serializer

↓

Business Service

↓

Validator

↓

Business Rules

↓

Continue Transaction
```

---

# Types of Validation

## Entity Validation

Examples

- Organization exists
- User exists
- Project exists
- Department exists

---

## State Validation

Examples

- Entity is active
- Entity is not archived
- Entity is not deleted
- Entity can transition to next state

---

## Relationship Validation

Examples

- Department belongs to Organization
- Team belongs to Department
- User belongs to Organization
- Task belongs to Project

---

## Business Rule Validation

Examples

- Department code is unique
- Organization name is unique
- Version number is valid
- Project code is unique
- Shot code is unique

---

## Permission Validation

Examples

- User can archive department
- User can approve version
- User can delete project
- User can invite members

---

# Validation Categories

## Identity

Typical validations

- Email uniqueness
- Password policy
- MFA configuration
- Role assignment
- Permission assignment

---

## Organization

Typical validations

- Organization ownership
- Department hierarchy
- Membership uniqueness
- Invitation validity
- Office assignment

---

## Production

Typical validations

- Project uniqueness
- Shot uniqueness
- Workflow transition
- Task assignment
- Version numbering
- Publish eligibility

---

# Exception Handling

Validators should raise domain-specific exceptions.

Examples

```text
ValidationError

BusinessRuleViolation

DuplicateEntity

EntityNotFound

InvalidStateTransition

PermissionDenied

DependencyViolation
```

The API layer converts these exceptions into standardized HTTP responses.

---

# Validator Composition

Complex workflows may require multiple validators.

Example

```text
ProjectService

↓

ProjectValidator

↓

WorkflowValidator

↓

PermissionValidator

↓

Continue Processing
```

Each validator should have a single responsibility.

---

# Integration with Services

Services are responsible for invoking validators.

```text
Business Service

↓

Validator

↓

Selector

↓

Continue Workflow
```

Validators never execute independently.

---

# Testing

Validators should be tested independently.

Typical scenarios include:

- Valid input
- Invalid input
- Duplicate entities
- Invalid relationships
- Invalid workflow transitions
- Permission failures

---

# Best Practices

- One validator per business entity.
- Keep validators deterministic.
- Keep validators stateless.
- Raise meaningful exceptions.
- Reuse validators across services.
- Validate before starting long transactions.

---

# Anti-Patterns

Avoid:

- Saving data inside validators
- Business workflows inside validators
- HTTP response generation
- Duplicate validation logic
- Direct API access
- External service calls

---

# Related Documents

- models.md
- services.md
- selectors.md
- permissions.md
- events.md
- ../02-architecture/validator-pattern.md
- ../02-architecture/service-layer.md
```