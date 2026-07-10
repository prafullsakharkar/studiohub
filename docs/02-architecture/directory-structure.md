# Directory Structure

## Purpose

StudioHub follows a feature-oriented modular monolith architecture. Each business domain is isolated into its own Django application while sharing common enterprise functionality through the Core module.

---

# Repository Structure

```text
studiohub/
├── backend/
│   ├── apps/
│   │   ├── core/
│   │   ├── identity/
│   │   ├── organization/
│   │   └── production/
│   ├── config/
│   ├── infrastructure/
│   ├── tests/
│   └── manage.py
├── frontend/
├── docs/
└── docker-compose.yml
```

---

# Backend Layout

## apps/core

Provides shared enterprise components:

- Base Models
- Managers
- QuerySets
- Selectors
- Services
- Validators
- Events
- API Foundation
- Utilities

## apps/identity

Responsible for:

- Users
- Authentication
- Roles
- Permissions
- MFA
- JWT
- Security

## apps/organization

Responsible for:

- Organizations
- Departments
- Offices
- Teams
- Memberships
- Calendars
- Branding

## apps/production

Responsible for:

- Projects
- Assets
- Sequences
- Shots
- Tasks
- Versions
- Reviews
- Publishing

---

# Standard Domain Layout

```text
apps/<domain>/
├── api/
├── choices/
├── constants/
├── events/
├── managers/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── validators/
└── views/
```

---

# Design Principles

- One business domain per Django app.
- Shared functionality belongs in `core`.
- Business logic lives in services.
- Read operations belong in selectors.
- Validation belongs in validators.
- Database access flows through managers and querysets.
- APIs remain thin and delegate to services.

---

# Related Documents

- overview.md
- modular-monolith.md
- layered-architecture.md
