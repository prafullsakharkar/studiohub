# Domain-Driven Design (DDD)

## Overview

StudioHub is designed using **Domain-Driven Design (DDD)** principles to organize the codebase around business capabilities rather than technical concerns.

Instead of building a large application around models and views, StudioHub is divided into independent business domains with clear responsibilities, boundaries, and communication patterns.

---

# Why Domain-Driven Design?

A VFX production platform contains many complex business processes:

- User authentication
- Studio organization
- Project management
- Asset tracking
- Shot production
- Reviews
- Publishing
- Pipeline automation

DDD allows each of these business areas to evolve independently while sharing a common enterprise foundation.

---

# Bounded Contexts

Each Django application represents a bounded context.

```text
StudioHub

├── Core
│
├── Identity
│
├── Organization
│
└── Production
```

Every domain owns its:

- Models
- Services
- Selectors
- Validators
- Events
- API
- Permissions

---

# Domain Responsibilities

## Core

Enterprise foundation shared across all modules.

Examples:

- Base Models
- QuerySets
- Managers
- Services
- Validators
- Events
- Utilities

---

## Identity

Responsible for platform identity.

Examples:

- Users
- Authentication
- JWT
- MFA
- Roles
- Permissions
- Sessions

---

## Organization

Responsible for studio structure.

Examples:

- Organizations
- Departments
- Teams
- Offices
- Memberships
- Calendars

---

## Production

Responsible for production workflow.

Examples:

- Projects
- Sequences
- Shots
- Tasks
- Assets
- Versions
- Reviews

---

# Entities

Entities have identity throughout their lifecycle.

Examples:

- User
- Organization
- Department
- Project
- Shot
- Task

Entities are represented by Django models.

---

# Value Objects

Value objects describe concepts without identity.

Examples include:

- Color
- Date Range
- Resolution
- Coordinates
- Metadata
- Work Schedule

Value objects should be immutable whenever practical.

---

# Domain Services

Business workflows belong in services, not models.

Examples:

- UserService
- OrganizationService
- DepartmentService
- AuthenticationService

Services coordinate domain operations, transactions, and events.

---

# Selectors

Selectors encapsulate read operations.

Responsibilities:

- Complex queries
- Filtering
- Search
- Aggregation
- Reporting

Selectors never modify state.

---

# Validators

Validators enforce business rules before data is persisted.

Examples:

- Duplicate organization names
- Unique department codes
- Membership constraints
- Permission validation

---

# Domain Events

Domains communicate using events instead of direct coupling.

```text
User Created
      │
      ▼
UserCreatedEvent
      │
 ├── Audit
 ├── Notification
 ├── Activity Feed
 └── Background Tasks
```

---

# Ubiquitous Language

StudioHub uses business terminology consistently throughout the codebase.

Examples:

| Business Term | Implementation |
|---------------|----------------|
| Studio | Organization |
| Department | Department |
| Team | Team |
| Project | Project |
| Sequence | Sequence |
| Shot | Shot |
| Task | Task |
| Version | Version |

This shared vocabulary improves communication between developers and domain experts.

---

# Repository Pattern

StudioHub intentionally **does not implement a traditional Repository pattern**.

Instead it relies on:

```text
Model
  ↓
QuerySet
  ↓
Manager
  ↓
Selector
```

This leverages Django ORM while maintaining a clean separation between persistence and business logic.

---

# Best Practices

- Keep business rules inside services.
- Use selectors for all read operations.
- Publish domain events for cross-domain communication.
- Keep models focused on state.
- Avoid circular dependencies between domains.
- Place shared functionality in the Core module.

---

# Related Documents

- overview.md
- modular-monolith.md
- clean-architecture.md
- service-layer.md
- event-system.md
- database-design.md
