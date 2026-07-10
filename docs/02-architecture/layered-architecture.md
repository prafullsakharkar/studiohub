# Layered Architecture

## Overview

StudioHub follows a layered architecture to clearly separate presentation, business logic, data access, and persistence. Each layer has a single responsibility and communicates only with adjacent layers.

---

## Layer Stack

```text
Client
  │
  ▼
API Layer
  │
  ▼
Serializer Layer
  │
  ▼
Service Layer
  │
  ├── Validator Layer
  └── Selector Layer
        │
        ▼
Manager Layer
        │
        ▼
QuerySet Layer
        │
        ▼
Model Layer
        │
        ▼
Database
```

---

## Layer Responsibilities

### API Layer

- Accept HTTP requests
- Authenticate and authorize users
- Invoke serializers and services
- Return HTTP responses

### Serializer Layer

- Validate request payloads
- Transform request/response data
- Map API data to domain objects

### Service Layer

- Execute business workflows
- Manage transactions
- Coordinate multiple domain operations
- Publish domain events

### Validator Layer

- Enforce business rules
- Validate cross-entity constraints
- Prevent invalid state changes

### Selector Layer

- Handle read-only queries
- Encapsulate complex filtering
- Optimize data retrieval

### Manager Layer

- Provide model entry points
- Expose reusable query methods

### QuerySet Layer

- Build reusable database queries
- Support filtering, annotations, and ordering

### Model Layer

- Define persistent entities
- Describe relationships
- Represent application state

---

## Request Lifecycle

```text
HTTP Request
    │
APIView
    │
Serializer
    │
Service
 ┌──┴─────────┐
 │            │
Validator  Selector
 │            │
 └─────┬──────┘
       ▼
 Manager
       ▼
 QuerySet
       ▼
   Model
       ▼
 PostgreSQL
```

---

## Dependency Rules

- Upper layers may depend on lower layers.
- Lower layers must never depend on upper layers.
- Models never call services.
- Views never query models directly.
- Business logic belongs in services.
- Read operations belong in selectors.

---

## Read Flow

```text
Client
 → API
 → Serializer
 → Selector
 → Manager
 → QuerySet
 → Model
 → Database
```

---

## Write Flow

```text
Client
 → API
 → Serializer
 → Service
 → Validator
 → Manager
 → Model
 → Database
 → Domain Event
```

---

## Cross-Cutting Concerns

Implemented through the Core module:

- Audit Logging
- Domain Events
- Soft Delete
- Metadata
- Permissions
- Caching
- Background Tasks

---

## Best Practices

- Keep each layer focused on a single responsibility.
- Avoid skipping layers.
- Keep controllers thin.
- Keep services cohesive.
- Reuse selectors for all read operations.
- Publish events instead of tightly coupling domains.

---

## Related Documents

- clean-architecture.md
- service-layer.md
- selector-pattern.md
- validator-pattern.md
- api-architecture.md
