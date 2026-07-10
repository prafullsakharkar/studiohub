# Project Structure

## Overview

StudioHub follows a **modular, domain-driven architecture** that separates business domains, infrastructure, and shared components. The repository is organized to promote scalability, maintainability, and clear ownership of functionality.

Each major business capability is implemented as an independent Django application with well-defined responsibilities. Shared functionality resides in the `core` application, while deployment, documentation, and automation are maintained outside the application code.

This structure enables teams to work independently on different domains while maintaining architectural consistency.

---

# Objectives

The project structure provides:

- Domain Driven Organization
- High Cohesion
- Low Coupling
- Clear Ownership
- Scalable Codebase
- Reusable Components
- Consistent Architecture
- Enterprise Maintainability

---

# Repository Structure

```text
studiohub/
│
├── backend/
├── frontend/
├── infrastructure/
├── docs/
├── scripts/
├── .github/
├── LICENSE
├── README.md
└── .gitignore
```

---

# Backend Structure

```text
backend/
│
├── apps/
├── config/
├── requirements/
├── tests/
├── media/
├── static/
├── templates/
├── manage.py
└── pyproject.toml
```

---

# Django Applications

```text
backend/apps/
│
├── core/
├── identity/
├── organization/
├── production/
├── assets/
├── pipeline/
├── review/
├── finance/
├── notification/
├── integration/
├── reporting/
└── automation/
```

Each application represents a single business domain.

---

# Typical Application Structure

Every Django application follows a common layout.

```text
apps/<module>/
│
├── admin/
├── api/
├── apps.py
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
├── validators/
└── views/
```

This structure keeps responsibilities clearly separated.

---

# Core Application

The `core` application contains reusable framework components.

Examples include:

- Base Models
- Base Managers
- QuerySets
- Utilities
- API Framework
- Event Bus
- Exceptions
- Mixins
- Validators
- Common Services

Business-specific logic should never be placed in the Core module.

---

# Identity Module

Responsible for:

- Users
- Roles
- Permissions
- Authentication
- MFA
- Sessions
- API Tokens
- Audit Information

Identity is shared across the entire platform.

---

# Organization Module

Responsible for:

- Organizations
- Offices
- Departments
- Teams
- Positions
- Memberships
- Calendars
- Business Configuration

---

# Production Module

Responsible for:

- Projects
- Sequences
- Shots
- Assets
- Tasks
- Versions
- Reviews
- Deliveries

This module represents the production pipeline.

---

# Configuration

Project configuration is located in:

```text
backend/config/
│
├── settings/
├── urls.py
├── asgi.py
├── wsgi.py
└── celery.py
```

Settings should be split by environment.

---

# Tests

Tests are organized by application.

```text
apps/

identity/tests/

organization/tests/

production/tests/
```

Each module owns its own test suite.

---

# Frontend Structure

```text
frontend/
│
├── src/
├── public/
├── tests/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

Frontend documentation describes this structure in detail.

---

# Documentation

Documentation resides under:

```text
docs/
│
├── 01-introduction/
├── 02-architecture/
├── 03-backend/
├── 04-frontend/
├── 05-database/
├── 06-infrastructure/
├── 07-deployment/
├── 08-development/
├── 09-testing/
├── 10-security/
└── 11-operations/
```

Documentation should evolve with the codebase.

---

# Infrastructure

Infrastructure configuration resides under:

```text
infrastructure/
│
├── compose/
├── docker/
├── nginx/
├── postgres/
├── redis/
├── monitoring/
└── scripts/
```

Infrastructure is managed separately from application code.

---

# Scripts

Reusable automation scripts belong in:

```text
scripts/
│
├── setup/
├── deployment/
├── database/
├── backup/
└── maintenance/
```

Scripts should be idempotent whenever possible.

---

# Design Principles

The repository follows these principles:

- Domain Driven Design
- Layered Architecture
- Single Responsibility
- Dependency Inversion
- Explicit Module Boundaries
- Shared Core Framework

---

# Module Independence

Each module owns:

- Models
- APIs
- Services
- Validators
- Permissions
- Selectors
- Events
- Tests
- Documentation

Cross-module dependencies should be minimized.

---

# Naming Conventions

Follow consistent naming.

Examples

```text
models/

services/

selectors/

validators/

permissions/

tests/
```

Avoid abbreviations unless universally understood.

---

# Best Practices

- Keep modules focused.
- Avoid circular dependencies.
- Place business logic in services.
- Share common functionality through the Core module.
- Keep documentation close to implementation.
- Maintain consistent directory structures.

---

# Anti-Patterns

Avoid:

- Monolithic applications
- Business logic inside views
- Shared mutable utilities
- Circular imports
- Deep module coupling
- Duplicate implementations

---

# Related Documents

- overview.md
- coding-standards.md
- django-guidelines.md
- git-workflow.md
- testing.md
- documentation.md
- ../02-architecture/backend-architecture.md
- ../03-backend/overview.md
- ../07-deployment/overview.md
```