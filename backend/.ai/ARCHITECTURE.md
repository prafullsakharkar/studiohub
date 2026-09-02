# StudioHub Backend Architecture

## 1. Purpose

StudioHub is an enterprise-grade VFX and Animation Production Management Platform.

The backend is designed as a:

* Domain-Driven Design (DDD) system
* Clean Architecture system
* Modular Monolith
* Django application
* Django REST Framework API platform
* Event-aware enterprise system
* Organization-aware multi-tenant platform

The architecture must support long-term growth from foundational applications into a complete VFX production platform.

---

# 2. Architectural Goals

The backend must provide:

* Strong domain boundaries
* Reusable infrastructure
* Consistent application structure
* Organization isolation
* Explicit business logic
* Testability
* API stability
* Extensibility
* Enterprise security
* Transactional consistency
* Event-driven integration
* PostgreSQL production readiness
* SQLite development/testing capability

---

# 3. High-Level Architecture

```text
                         StudioHub
                            │
              ┌─────────────┴─────────────┐
              │                           │
          Frontend                    External Systems
              │                           │
              ▼                           ▼
       Django REST API              Webhooks / Tools
              │
              ▼
       Application Layer
              │
       ┌──────┴───────┐
       │              │
   Selectors       Services
       │              │
       └──────┬───────┘
              ▼
          Domain Layer
              │
              ▼
       Persistence Layer
              │
              ▼
        Django ORM
              │
              ▼
        PostgreSQL
```

---

# 4. Modular Monolith

StudioHub is a modular monolith.

All domains live in the same Django deployment while maintaining explicit logical boundaries.

```text
apps/
├── core/
├── identity/
├── organization/
├── production/
├── asset/
├── shot/
├── task/
├── review/
├── publishing/
├── workflow/
├── reporting/
└── ...
```

A modular monolith is preferred over premature microservices.

### Benefits

* Simple deployment
* Shared transactions
* Lower operational complexity
* Easier development
* Strong domain boundaries
* Future extraction capability

A module may eventually become a service if scale or organizational requirements justify it.

---

# 5. Architectural Layers

StudioHub follows:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Persistence
     ↓
Infrastructure
```

Django implementation maps these concepts as:

```text
API
 ↓
Services / Selectors
 ↓
Domain
 ↓
Models / Persistence
 ↓
Database
```

---

# 6. Core

`apps/core` is the foundational framework.

Core provides reusable infrastructure but contains no StudioHub business domain.

Core provides:

* Base models
* QuerySets
* Managers
* Selectors
* Services
* Validators
* API infrastructure
* Permissions
* Events
* Context
* Middleware
* Security primitives
* Filesystem abstractions
* Date utilities
* Internationalization utilities
* Logging
* Shared types
* Shared protocols
* Shared constants

Core must remain domain-neutral.

Core must never depend on:

```text
identity
organization
production
asset
shot
task
review
```

---

# 7. Identity

Identity owns user and security concerns.

```text
apps/identity/
```

Responsibilities include:

* User
* Authentication
* Credentials
* Roles
* Permissions
* Devices
* Security events
* Sessions
* MFA
* Tokens

Identity may depend on Core.

Identity must not recreate Core infrastructure.

---

# 8. Organization

Organization is the primary reference implementation for domain applications.

```text
apps/organization/
```

Responsibilities include:

* Organization
* Department
* Office
* Team
* Position
* Membership
* Invitation
* Branding
* Organization settings
* Work calendar

Organization-aware domains reference Organization rather than implementing their own organization model.

---

# 9. Domain Applications

Each business domain owns its own business logic.

Examples:

```text
production
asset
shot
task
review
publishing
workflow
reporting
```

Each domain follows the established application structure.

```text
apps/<domain>/
├── admin/
├── api/
├── choices/
├── constants/
├── events/
├── exceptions/
├── filters/
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
├── validators/
├── views/
└── apps.py
```

Only required directories should be created.

---

# 10. Application Layer

The application layer coordinates use cases.

Primary components:

```text
services/
selectors/
commands/
queries/
```

### Services

Services handle state-changing operations.

Examples:

```text
CreateProject
AssignTask
SubmitVersion
ApproveReview
PublishAsset
```

### Selectors

Selectors handle complex read operations.

Examples:

```text
ProjectSelector
ShotSelector
TaskSelector
VersionSelector
```

---

# 11. Domain Layer

The domain layer contains business concepts and rules.

Domain concepts may include:

* Entities
* Value objects
* Domain events
* Domain exceptions
* Protocols
* Business rules

Domain logic should not depend unnecessarily on Django REST Framework.

---

# 12. Persistence Layer

Persistence is responsible for database interaction.

Use:

```text
Models
QuerySets
Managers
Transactions
```

The standard data-access flow is:

```text
Model
 ↓
QuerySet
 ↓
Manager
 ↓
Selector
 ↓
Service
```

Selectors and services should not contain raw SQL unless there is a demonstrated need.

---

# 13. Service Layer

Services are the primary location for business operations.

Example:

```text
CreateProjectService
UpdateProjectService
DeleteProjectService
AssignTaskService
PublishVersionService
ApproveReviewService
```

Services must:

* Validate business rules
* Perform transactions
* Modify state
* Publish events where required
* Trigger background work where appropriate

---

# 14. Selector Layer

Selectors are responsible for reads.

Selectors should provide:

* Filtering
* Searching
* Ordering
* Related-object loading
* Aggregations
* Query optimization

Avoid putting write operations inside selectors.

---

# 15. QuerySets

QuerySets provide reusable database query behavior.

Examples:

```text
active()
deleted()
published()
for_organization()
for_project()
owned_by()
search()
```

QuerySets should focus on database-level behavior rather than business workflows.

---

# 16. Managers

Managers expose QuerySet functionality at the model level.

Managers should remain lightweight.

Complex business workflows belong in services.

---

# 17. Validators

Validators enforce reusable rules.

There are two categories:

### Generic Validators

Located in Core.

Examples:

```text
email
uuid
url
slug
file
datetime
currency
```

### Domain Validators

Located inside the relevant application.

Examples:

```text
project naming
shot status
task assignment
review transition
```

---

# 18. Events

StudioHub uses domain events for loosely coupled communication.

```text
Business Operation
       ↓
Domain Event
       ↓
Event Bus
       ↓
Handlers
       ├── Audit
       ├── Notification
       ├── Analytics
       ├── Celery
       └── Webhooks
```

Events should communicate meaningful business facts.

Examples:

```text
ProjectCreated
ShotCreated
TaskAssigned
VersionSubmitted
ReviewApproved
AssetPublished
```

---

# 19. API Architecture

Django REST Framework provides the external API.

```text
HTTP Request
      ↓
View / ViewSet
      ↓
Serializer
      ↓
Service / Selector
      ↓
Domain
      ↓
Persistence
      ↓
Database
```

Views should remain thin.

Serializers should primarily handle:

* Input validation
* Serialization
* Deserialization

Business workflows belong in services.

---

# 20. API Contract

The API is a compatibility boundary.

API contracts include:

* URL
* HTTP method
* Request payload
* Query parameters
* Response payload
* Status codes
* Pagination
* Filtering
* Ordering
* Searching
* Errors
* Actions

Existing frontend API contracts must not be changed casually.

Architectural API changes require review and documentation.

---

# 21. Organization Isolation

Organization is a fundamental security boundary.

Where applicable:

```text
Organization
    ↓
Project
    ↓
Production
    ↓
Asset / Shot / Task / Version
```

Every organization-aware query must enforce the organization scope.

Never rely on frontend filtering.

---

# 22. Transactions

State-changing operations should use transactions where multiple database operations must succeed atomically.

Example:

```text
Service
  ↓
transaction.atomic()
  ├── update entity
  ├── create audit
  ├── create event
  └── schedule task
```

Avoid partial state.

---

# 23. Background Processing

Celery is used for asynchronous workloads.

Examples:

* Notifications
* Emails
* Media processing
* File processing
* Reports
* Exports
* Webhooks
* Long-running workflows

Do not move simple synchronous business operations into Celery unnecessarily.

---

# 24. Filesystem

VFX production generates large numbers of:

* Images
* Videos
* EXR files
* Playblasts
* Documents
* Attachments

Filesystem/storage abstractions must remain separate from domain business logic.

Use Core filesystem abstractions.

---

# 25. Security Architecture

Security is enforced server-side.

Layers include:

```text
Authentication
 ↓
Permission
 ↓
Organization Scope
 ↓
Object Permission
 ↓
Business Validation
```

Frontend permissions are for UX only.

Backend authorization is authoritative.

---

# 26. Database Strategy

Production:

```text
PostgreSQL
```

Development/testing:

```text
SQLite
```

when explicitly configured.

The application must remain database portable.

Use Django ORM rather than database-specific application logic.

---

# 27. Testing Architecture

Testing should cover:

```text
Unit
Integration
API
Permission
Organization Isolation
Events
Services
Selectors
Frontend Integration
```

Critical business rules must be tested at the backend level.

---

# 28. Architectural Principle

The most important StudioHub architecture rule is:

> **Reuse before reinventing.**

Before creating a new abstraction:

1. Check Core.
2. Check Identity.
3. Check Organization.
4. Check existing domain implementations.
5. Check documentation.
6. Check ADRs.

Only then introduce new architecture.
