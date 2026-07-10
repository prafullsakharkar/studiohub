# Manager Pattern

## Overview

The Manager Pattern provides the primary entry point to the Django ORM for each model. Custom managers encapsulate reusable query entry points and expose domain-specific operations while delegating query construction to custom QuerySets.

In StudioHub, managers act as the bridge between models and selectors, ensuring that data access remains organized and reusable.

---

# Objectives

The Manager Pattern is used to:

- Provide a consistent ORM entry point
- Expose reusable query methods
- Delegate query logic to QuerySets
- Improve code readability
- Keep models lightweight

---

# Architecture

```text
Business Service
       │
       ▼
Selector
       │
       ▼
Manager
       │
       ▼
QuerySet
       │
       ▼
Model
       │
       ▼
Database
```

---

# Responsibilities

Managers are responsible for:

- Returning the default QuerySet
- Exposing common query entry points
- Delegating complex filtering to QuerySets
- Creating specialized managers when required

Managers should **not**:

- Contain business workflows
- Perform validation
- Publish events
- Execute HTTP logic

---

# Manager Organization

Every model should have its own manager.

```text
apps/
└── organization/
    └── managers/
        ├── organization.py
        ├── department.py
        ├── office.py
        ├── team.py
        └── membership.py
```

---

# Relationship with QuerySets

Managers expose methods that return QuerySets.

```text
Manager
   │
   ├── active()
   ├── archived()
   ├── visible()
   └── by_code()
         │
         ▼
QuerySet
```

The QuerySet performs the actual query construction.

---

# Relationship with Selectors

Selectors should access models through managers rather than calling the ORM directly.

```text
Selector
    │
    ▼
Manager
    │
    ▼
QuerySet
    │
    ▼
Database
```

This keeps selectors independent from low-level query implementation.

---

# Common Responsibilities

Typical manager methods include:

- active()
- inactive()
- deleted()
- visible()
- by_uuid()
- by_code()
- available()

Each method should return a QuerySet for further composition.

---

# Best Practices

- Keep managers thin.
- Delegate filtering to QuerySets.
- Expose expressive domain-specific methods.
- Use one manager per model.
- Keep business logic in services.
- Reuse managers across selectors.

---

# Anti-Patterns

- Business logic inside managers
- Validation inside managers
- HTTP-specific behavior
- Returning raw SQL
- Duplicating QuerySet logic

---

# Related Documents

- queryset-pattern.md
- selector-pattern.md
- service-layer.md
- database-design.md
