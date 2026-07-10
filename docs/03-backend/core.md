# Backend Core Framework

## Overview

The Core module is the foundation of the StudioHub backend. Every business domain depends on the Core framework for shared models, services, query infrastructure, validation, events, utilities, and API components.

Rather than duplicating common functionality across applications, StudioHub centralizes enterprise features inside the Core module.

---

# Responsibilities

The Core module provides:

- Base Models
- Base Managers
- Base QuerySets
- Business Services
- Selectors
- Validators
- Domain Events
- API Foundation
- Utilities
- Middleware
- Constants
- Choices

---

# Directory Structure

```text
apps/core/

├── api/
├── choices/
├── constants/
├── events/
├── exceptions/
├── managers/
├── middleware/
├── models/
├── querysets/
├── selectors/
├── services/
├── validators/
├── utils/
└── permissions/
```

---

# Base Models

Every business entity inherits reusable enterprise models.

Implemented models include:

- UUIDModel
- TimeStampedModel
- AuditModel
- SoftDeleteModel
- MetadataModel

These models provide consistent behavior across the entire application.

---

# Data Access Layer

The Core framework defines the standard data access pipeline.

```text
Model
  │
QuerySet
  │
Manager
  │
Selector
  │
Business Service
```

This architecture separates persistence from business logic.

---

# Services

Core services provide reusable enterprise functionality such as:

- Audit management
- Lifecycle management
- Soft deletion
- Event publishing
- Cache invalidation

Domain services extend these base services.

---

# Validators

Reusable validators enforce common rules including:

- Entity existence
- Status validation
- Soft-delete constraints
- Business rule helpers

---

# Event Framework

The event framework enables communication between modules.

Typical events:

- EntityCreated
- EntityUpdated
- EntityDeleted

Subscribers handle auditing, notifications, analytics, and background processing.

---

# API Foundation

The Core API layer provides reusable components for all domains:

- Base serializers
- Base viewsets
- Pagination
- Filters
- Permissions
- Exception handling
- Response formatting

---

# Best Practices

- Place reusable functionality in Core.
- Avoid business-specific logic in Core.
- Keep Core independent of other domains.
- Build extensible base classes.
- Maintain backward compatibility for shared components.

---

# Related Documents

- ../02-architecture/overview.md
- ../02-architecture/service-layer.md
- ../02-architecture/event-system.md
