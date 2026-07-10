# Models

## Overview

Models represent the core business entities of StudioHub. Every persistent object in the system is implemented as a Django model and follows the enterprise conventions established by the Core framework.

StudioHub models are intentionally lightweight. They primarily define the data structure, relationships, and basic model behavior, while business logic resides in Services and query logic resides in Selectors and QuerySets.

---

# Objectives

The model layer is responsible for:

- Defining business entities
- Managing database relationships
- Representing domain state
- Enforcing database constraints
- Providing model metadata
- Supporting reusable inheritance

Models should **not** contain complex business logic.

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

# Base Model Hierarchy

All business entities inherit common functionality from the Core module.

```text
UUIDModel
      │
TimeStampedModel
      │
AuditModel
      │
MetadataModel
      │
SoftDeleteModel
      │
Business Entity
```

Example:

```python
class Project(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
):
    ...
```

---

# Core Base Models

## UUIDModel

Provides:

- UUID primary key
- Globally unique identifiers

---

## TimeStampedModel

Provides:

- created_at
- updated_at

---

## AuditModel

Provides:

- created_by
- updated_by
- deleted_by

---

## SoftDeleteModel

Provides:

- is_deleted
- deleted_at

---

## MetadataModel

Provides:

- metadata
- custom attributes
- integration data

---

# Model Organization

Each domain owns its own models.

```text
apps/

core/
identity/
organization/
production/
```

Example:

```text
apps/
└── production/
    └── models/
        ├── project.py
        ├── sequence.py
        ├── shot.py
        ├── asset.py
        ├── task.py
        ├── version.py
        └── publish.py
```

---

# Relationships

StudioHub primarily uses:

- ForeignKey
- OneToOneField
- ManyToManyField

Typical hierarchy:

```text
Organization
      │
      ▼
Project
      │
      ▼
Sequence
      │
      ▼
Shot
      │
      ▼
Task
      │
      ▼
Version
```

---

# Model Responsibilities

Models should:

- Define fields
- Define relationships
- Define database constraints
- Expose simple computed properties
- Register managers

Models should not:

- Execute workflows
- Send notifications
- Perform validation beyond database constraints
- Access external services
- Execute API logic

---

# Managers and QuerySets

Every model should expose a custom manager.

Example:

```python
objects = ProjectManager()
```

Managers return optimized QuerySets.

---

# Database Constraints

Prefer enforcing integrity through:

- Unique Constraints
- Check Constraints
- Foreign Keys
- Indexes

Business rules belong in validators.

---

# Model Metadata

Every model should include:

- verbose_name
- verbose_name_plural
- ordering
- indexes
- constraints

Example:

```python
class Meta:
    ordering = ["name"]
```

---

# Best Practices

- Keep models lightweight.
- Reuse Core base models.
- Place business logic in services.
- Keep relationships explicit.
- Use UUIDs consistently.
- Add indexes for frequently queried fields.

---

# Anti-Patterns

Avoid:

- Fat models
- Business workflows inside models
- API logic
- Notification logic
- Cross-domain dependencies
- Complex database queries

---

# Related Documents

- core.md
- services.md
- selectors.md
- validators.md
- ../02-architecture/database-design.md
- ../02-architecture/service-layer.md