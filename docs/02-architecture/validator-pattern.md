# Validator Pattern

## Overview

The Validator Pattern centralizes business rule validation within dedicated validator classes. Validators ensure that domain rules are consistently enforced before any state-changing operation is executed.

Unlike serializers, which validate API input, validators enforce business constraints that apply regardless of how the operation is triggered (API, background task, management command, or service).

---

# Objectives

The Validator Pattern aims to:

- Centralize business validation
- Eliminate duplicated validation logic
- Keep services focused on workflows
- Improve testability
- Enforce domain consistency

---

# Architecture

```text
Client
   │
APIView
   │
Serializer
   │
Business Service
   │
Validator
   │
Selector
   │
Manager
   │
Model
```

---

# Responsibilities

Validators should:

- Validate business rules
- Check entity relationships
- Verify permissions (when domain-specific)
- Prevent invalid state transitions
- Validate uniqueness beyond database constraints
- Raise domain exceptions

Validators should **not**:

- Save data
- Delete data
- Execute workflows
- Query unrelated domains unnecessarily
- Publish events

---

# Validator Organization

Each domain owns its validators.

```text
apps/
└── organization/
    └── validators/
        ├── organization.py
        ├── department.py
        ├── office.py
        ├── team.py
        └── membership.py
```

---

# Validation Flow

```text
APIView
    │
Serializer
    │
Business Service
    │
Validator
    │
Business Rules
    │
Continue Workflow
```

Validation always occurs before persistence.

---

# Types of Validation

## Entity Validation

Examples:

- Organization exists
- Department exists
- User is active

## Business Validation

Examples:

- Department code is unique
- Team belongs to organization
- Office cannot be archived while active projects exist

## State Validation

Examples:

- Archived records cannot be updated
- Deleted entities cannot be restored twice
- Closed projects cannot accept new tasks

---

# Exceptions

Validators should raise domain-specific exceptions such as:

- ValidationError
- BusinessRuleViolation
- DuplicateEntity
- InvalidStateTransition
- PermissionDenied

API layers convert these into HTTP responses.

---

# Interaction with Services

```text
Business Service
      │
      ▼
Validator
      │
      ▼
Business Rules
      │
      ▼
Continue Processing
```

Services coordinate workflows, while validators enforce rules.

---

# Best Practices

- One validator per entity or aggregate.
- Keep validation deterministic.
- Reuse validators across services.
- Keep database writes out of validators.
- Return meaningful validation errors.
- Validate before opening long transactions.

---

# Anti-Patterns

- Business rules inside serializers
- Validation logic in API views
- Duplicate validation across services
- Database writes inside validators
- Catching and suppressing validation failures

---

# Related Documents

- service-layer.md
- selector-pattern.md
- manager-pattern.md
- api-architecture.md
- database-design.md
