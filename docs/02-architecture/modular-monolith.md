# Modular Monolith Architecture

## Overview

StudioHub is built as a **Modular Monolith**, combining the simplicity of a monolithic deployment with the maintainability of well-defined domain boundaries.

Unlike a traditional monolith, each business capability is implemented as an independent module with its own models, services, selectors, validators, APIs, and events.

---

# Why a Modular Monolith?

For StudioHub, a Modular Monolith provides:

- Simpler deployment
- Faster development
- Easier debugging
- Strong domain isolation
- Lower operational complexity
- Better transaction consistency
- Future migration path to microservices if required

---

# High-Level Architecture

```text
                 StudioHub

        +-----------------------+
        |        Core           |
        +-----------------------+
           /      |        \
          /       |         \
         v        v          v

 +---------------+  +----------------+  +----------------+
 |   Identity    |  | Organization   |  |   Production   |
 +---------------+  +----------------+  +----------------+

          \          |             /
           \         |            /
            +--------------------+
            | PostgreSQL Database|
            +--------------------+
```

---

# Domain Responsibilities

## Core

Shared enterprise framework.

Responsibilities:

- Base Models
- Utilities
- Events
- Services
- QuerySets
- Managers
- Selectors
- Validators

---

## Identity

Handles platform security.

Responsibilities:

- Users
- Authentication
- JWT
- MFA
- Roles
- Permissions
- Sessions

---

## Organization

Represents studio structure.

Responsibilities:

- Organizations
- Departments
- Teams
- Offices
- Memberships
- Calendars

---

## Production

Represents the production pipeline.

Responsibilities:

- Projects
- Assets
- Sequences
- Shots
- Tasks
- Versions
- Reviews
- Publishing

---

# Dependency Rules

The dependency direction is intentionally one-way.

```text
Production
      |
Organization
      |
Identity
      |
Core
```

Rules:

- Core never depends on other modules.
- Identity may depend on Core.
- Organization may depend on Core and Identity.
- Production may depend on Core, Identity, and Organization.
- Modules should not create circular dependencies.

---

# Module Communication

Modules communicate through:

- Services
- Selectors
- Domain Events

Avoid:

- Direct model manipulation across domains
- Circular imports
- Business logic inside views

---

# Benefits

- Clear ownership
- Easier testing
- Better maintainability
- Reusable business logic
- Scalable architecture
- Consistent code organization

---

# Scaling Strategy

As StudioHub grows:

1. Keep domains isolated.
2. Introduce asynchronous processing using Celery.
3. Publish domain events for cross-module workflows.
4. Extract a module into a microservice only if operational requirements justify it.

---

# Best Practices

- One business domain per Django app.
- Keep APIs thin.
- Place business logic in services.
- Use selectors for reads.
- Use validators for business rules.
- Publish events for cross-cutting concerns.
- Share reusable code through the Core module.

---

# Related Documents

- overview.md
- directory-structure.md
- layered-architecture.md
- service-layer.md
- event-system.md
