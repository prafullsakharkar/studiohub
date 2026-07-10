# Django Development Guidelines

## Overview

This document defines the Django-specific development standards for StudioHub. It establishes architectural boundaries, coding conventions, and best practices for building scalable, maintainable, and secure enterprise applications.

StudioHub follows a layered architecture where Django is primarily responsible for persistence, request handling, and framework integration. Business logic belongs in dedicated service layers rather than models or views.

---

# Objectives

These guidelines promote:

- Clean Architecture
- Separation of Concerns
- Reusable Components
- Testability
- Scalability
- Security
- Performance
- Maintainability

---

# Architectural Principles

StudioHub follows the following layered architecture.

```text
HTTP Request

↓

API Layer

↓

Serializer

↓

Service

↓

Validator

↓

Selector

↓

Manager / QuerySet

↓

Model

↓

Database
```

Each layer has a single responsibility.

---

# Application Structure

Every Django application should follow the same structure.

```text
apps/<module>/
│
├── admin/
├── api/
├── choices/
├── constants.py
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
├── urls.py
├── utils/
└── validators/
```

Consistency across applications is mandatory.

---

# Models

Models should represent the persistence layer only.

Models may contain:

- Field Definitions
- Relationships
- Metadata
- Simple Computed Properties

Models should **not** contain:

- Business Rules
- Complex Validation
- External API Calls
- Notification Logic
- Permission Checks

---

# Managers

Managers provide reusable query entry points.

Example responsibilities

- Active Records
- Published Records
- Organization Scope
- User Scope

Managers should delegate query logic to QuerySets whenever possible.

---

# QuerySets

QuerySets encapsulate reusable database queries.

Examples

- active()
- archived()
- visible_to(user)
- for_organization(org)

Business workflows should not be implemented in QuerySets.

---

# Selectors

Selectors are responsible for reading data.

Typical responsibilities

- Complex Queries
- Cross-Module Reads
- Dashboard Queries
- Aggregations
- Reporting Queries

Selectors should never modify data.

---

# Services

Services contain business logic.

Typical responsibilities

- Create Objects
- Update Objects
- Delete Objects
- Workflow Execution
- Domain Rules
- Transactions
- Event Publishing

Services should be the primary location for write operations.

---

# Validators

Validators enforce business rules before persistence.

Examples

- Duplicate Detection
- Organization Constraints
- Business Policies
- Cross-Entity Validation

Validation logic should not be duplicated across serializers and services.

---

# Serializers

Serializers are responsible for:

- Input Validation
- Data Transformation
- API Representation

Serializers should not implement business workflows.

---

# Views

Views should remain thin.

Responsibilities

- Authentication
- Authorization
- Request Parsing
- Serializer Invocation
- Service Invocation
- Response Generation

Views should not contain business logic.

---

# Signals

Signals should be used sparingly.

Suitable use cases

- Audit Logging
- Cache Invalidation
- Analytics
- Non-Critical Notifications

Avoid business-critical workflows inside signals.

---

# Transactions

Business operations involving multiple writes should use database transactions.

Example

```python
from django.db import transaction

with transaction.atomic():
    service.execute()
```

Keep transaction scopes as small as possible.

---

# Permissions

Permission checks should be centralized.

Responsibilities include

- Object-Level Authorization
- Organization Access
- Role Validation
- Feature Access

Avoid scattered permission logic throughout the codebase.

---

# Events

Business events should be published from the service layer.

Examples

```text
ProjectCreated

TaskAssigned

ReviewCompleted

OrganizationArchived
```

Events enable loose coupling between modules.

---

# Background Tasks

Use Celery for:

- Email Delivery
- Report Generation
- AI Processing
- File Processing
- Long Running Jobs

Avoid blocking HTTP requests with expensive operations.

---

# ORM Best Practices

Prefer:

- select_related()
- prefetch_related()
- bulk_create()
- bulk_update()
- exists()
- only()
- defer()

Avoid N+1 query problems.

---

# Database Migrations

Every schema change must use Django migrations.

Never:

- Modify production schemas manually
- Edit applied migrations
- Delete committed migrations

Review migrations before committing.

---

# Configuration

Configuration belongs in Django settings or environment variables.

Never hardcode:

- Secrets
- URLs
- API Keys
- Database Credentials

---

# Testing

Every Django module should include:

- Model Tests
- Service Tests
- Selector Tests
- API Tests
- Permission Tests
- Integration Tests

Services should receive the highest level of test coverage.

---

# Performance

Monitor:

- Database Queries
- ORM Efficiency
- Response Times
- Cache Usage
- Background Task Duration

Optimize only after identifying measurable bottlenecks.

---

# Security

Always:

- Validate user input
- Enforce permissions
- Protect against CSRF where applicable
- Use parameterized ORM queries
- Store secrets securely
- Audit sensitive operations

---

# Best Practices

- Keep views thin.
- Keep models simple.
- Place business logic in services.
- Use selectors for reads.
- Validate before persistence.
- Use transactions appropriately.
- Write comprehensive tests.

---

# Anti-Patterns

Avoid:

- Business logic in models
- Business logic in views
- Fat serializers
- Direct ORM access from views
- Hidden signal dependencies
- Raw SQL without justification
- Manual database changes

---

# Related Documents

- overview.md
- coding-standards.md
- python-style-guide.md
- git-workflow.md
- testing.md
- ../02-architecture/backend-architecture.md
- ../03-backend/overview.md
- ../03-backend/services.md
- ../03-backend/selectors.md
- ../03-backend/api.md
- ../10-security/secure-coding.md