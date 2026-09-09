# StudioHub Technical Architecture — Overview

Generated: 2026-08-18T12:26:00+05:30
Author: Principal Architect (documentation produced by Copilot CLI runtime in VS Code)

Purpose
-------
This document is the canonical technical architecture entry-point for StudioHub. It reconciles Domain-Driven Design (DDD), Clean Architecture, Layered Architecture, and the Modular Monolith approach for a large Django codebase. It provides explicit rules, mapping to Django constructs, module boundaries, dependency direction, and operational guidance for developers and architects.

Audience
--------
- Architects and technical leads
- Backend and frontend engineers
- Pipeline TDs and integrators
- DevOps and SRE
- Documentation authors and AI-assisted tooling

High-level philosophy
---------------------
StudioHub is a domain-driven modular monolith: start with a single deployable application that models production business domains with strong ownership, explicit dependency rules, and clear separation between Application, Domain, Presentation, and Infrastructure responsibilities.

The system should be:
- Understandable — developers can answer "Where should I put this code?"
- Maintainable — small, focused modules and clear public APIs
- Testable — small unit boundaries and integration tests for contracts
- Modular & Extensible — bounded contexts map to modules/apps
- Enterprise-ready — secure, auditable, and deployable in customer infrastructure
- Django-friendly — pragmatic mapping between architecture and Django idioms

This document defines the canonical architecture. Other architecture documents (pattern how-tos, ADRs) should reference it.

Canonical layers
----------------
StudioHub uses four canonical layers. Dependency flow is shown with arrows (↓ means "depends-on").

Presentation (edge)
  ↓
Application (use-cases, orchestration)
  ↓
Domain (entities, rules, events)
  ↑
Infrastructure (implements abstractions)

Responsibilities
----------------
- Presentation
  - HTTP endpoints (DRF views/viewsets), GraphQL, Websockets
  - Authentication extraction, request parsing, basic validation
  - Adapt transport data to application input (serializers/DTOs)

- Application
  - Use-cases / application services (each represents a business operation)
  - Transaction boundaries (transaction.atomic)
  - Orchestration of domain operations, authorization coordination, and calling infrastructure via abstractions
  - Emitting domain events (high-level business events)

- Domain
  - Entities, Aggregates, Value Objects, Domain Services, Domain Events, Invariants
  - Contain business rules; must be framework-agnostic

- Infrastructure
  - Persistence (Django ORM, QuerySets), caching, messaging (Celery/Redis), object storage, external integrations
  - Implement abstractions required by Application/Domain (repositories if used)
  - Must depend on Domain (not vice versa)

Dependency Direction — the rule
-------------------------------
- Code in Presentation depends on Application and Domain.
- Code in Application depends on Domain and abstractions (interfaces) that Infrastructure implements.
- Domain must not import infrastructure frameworks (Django ORM, DRF, Celery, Redis) directly. Exceptions must be explicitly documented via ADRs.
- Infrastructure implements required interfaces and may depend on Domain (e.g. ORM models mirroring domain entities, or adapters).

Django mapping (practical)
---------------------------
Django is not an obstacle to Clean Architecture — it provides pragmatic building blocks. Map Django idioms to layers:

- DRF View/ViewSet → Presentation (adapter, thin)
- DRF Serializer → Presentation boundary / input DTOs (also structural validation)
- Application Service (module) → app/application/services or app/application/commands
- Domain Entities / Value Objects → app/domain/entities, value_objects
- Domain Services / Events → app/domain/services, events
- Django Models (ORM) → Infrastructure/persistence layer or a thin mapping in domain models when justified
- QuerySets / Managers → Infrastructure/persistence (specialized query primitives) but exposed via Selectors for application consumption

Guiding rule: Prefer composition over inheritance and keep Django specifics at Infrastructure or Presentation layers. Domain logic should be expressed in plain Python classes and pure functions where possible.

Bounded contexts and application boundaries
------------------------------------------
Bounded contexts (from Part 2) map to modules or Django apps. Example mapping (suggested):

- identity/ (Identity Context)
- organization/
- production/
- project/
- asset/
- shot/
- task/
- review/
- publishing/
- delivery/
- workflow/
- scheduling/
- notification/
- reporting/
- audit/
- integration/

Each module should present a small public interface and keep implementation details private. A module directory structure should reflect layering (api/, application/, domain/, infrastructure/).

Public vs private module API
---------------------------
- Public API: stable functions/classes for other modules. Documented and covered by contract tests.
- Private/internal: implementation details under internal/ or not exported in __init__.py.

Module metadata to document (per module)
- Bounded Context
- Django App name
- Ownership (team or person)
- Public Interface (what others may import)
- Allowed incoming dependencies
- Events published / consumed
- External integrations

Module dependency rules (recommended)
-------------------------------------
Define explicit allowed dependencies to avoid cyclic imports:

- identity ← organization (identity can refer to organization data for tenancy)
- organization ← production
- production ← project
- project ← {asset, shot, task}
- asset ← {task, publishing}
- shot ← {task, review, publishing}
- task ← version
- review ← version
- publishing ← version

This is a suggested graph — minimize cross-module writes and prefer events for coupling. Any deviation must be justified in an ADR.

Shared Kernel (core) guidance
-----------------------------
ADR-0026 establishes a shared kernel boundary. Use Core cautiously.

Allowed in core/shared kernel:
- Primitive domain types (UUID helpers, timestamps)
- Small, stable value-objects (FrameRange, VersionNumber) used across contexts
- Domain exceptions and result types
- Event base classes and interfaces (DomainEvent, EventBus interface)
- Small shared utilities (logging wrappers, tracing helpers)

Not allowed in core:
- Business concepts tied to a single bounded context
- Large domain models used across multiple contexts (prefer lean contracts)
- Application services or heavy workflow logic

Criteria for adding to Core:
- Cross-context stable concept used by 3+ contexts
- Low churn expected
- Backwards-compatible API

Service layer (application services)
-----------------------------------
Define application services as use-case implementations. They:
- Encapsulate a single business operation (e.g., CreateProduction, AssignTask)
- Orchestrate domain calls and infrastructure adapters
- Own transaction boundaries (transaction.atomic)
- Publish domain events but do not implement subscribers

Good service definition:
- Small and single-purpose
- Well-named (verb/object: SubmitVersionForReview)

Bad service anti-patterns:
- GodService (one service per aggregate with many responsibilities)
- Service-as-repository (services should call repositories/adapters appropriately)

Selector pattern vs QuerySet vs Manager
--------------------------------------
- QuerySet: Django-level reusable DB filters/compositions (Shot.objects.active()) — Infrastructure-persistence.
- Manager: factory/creation helpers and high-level model constructs — Infrastructure.
- Selector: Read-oriented API that composes QuerySets and performs read-only queries for application use. Examples: get_active_shots(project_id), get_pending_reviews(user_id).

Rules:
- Selectors are pure read adaptors returning DTOs or domain read models; no business-side effects.
- QuerySets return ORM objects; Selectors may expose simpler typed objects to Application.
- Avoid embedding domain mutating logic inside QuerySets/Managers.

Repository pattern — when to use
--------------------------------
- For many Django projects, repositories are unnecessary because Django ORM + QuerySets are expressive.
- Consider repositories when you need to:
  - Wrap multiple persistence operations behind a clear interface
  - Provide alternative implementations (tests, different stores)
  - Encapsulate complex mapping between domain entities and persistence models

If used, keep repositories thin and focused.

Domain services and aggregates
-----------------------------
Aggregates (candidates): Organization, Production, Project, Asset, Shot, Task, Version, Review, Publish, Delivery.

For each aggregate define:
- Aggregate root (single entry point for modifications)
- Owned entities (value objects or child entities)
- Invariants enforced within the aggregate boundary
- Transaction boundaries: keep transactions within aggregates when possible

Domain services are for domain logic that:
- Crosses multiple entities
- Represents policy or domain rules not belonging to one entity

Avoid turning procedural code into domain services without domain justification.

Entities vs Value Objects (examples)
------------------------------------
Entities:
- Shot (identity: shot code), Asset (asset code), Version (uuid)

Value objects:
- FrameRange (start, end, handles)
- Timecode
- Resolution
- FileChecksum

Use value objects when they encapsulate validation and behaviour.

Transaction management
----------------------
- Application services should own transaction.atomic blocks.
- Do not place transaction.atomic inside models, QuerySets, or arbitrary utility functions.
- Use on_commit hooks to publish domain events only after commit (avoid publishing events for rolled-back transactions).

Events and event architecture
-----------------------------
Separation of concerns:
- Domain events: business facts (TaskAssigned, VersionApproved)
- Application events: internal notifications for application-level processes
- Integration events: contracts intended for external systems
- Infrastructure/operational events: JobFailed, StorageUploaded

Event rules:
- Event payloads must be compact and stable; include event_id, occurred_at, aggregate_type, aggregate_id, actor, org_id, version, and minimal payload.
- Version event contracts explicitly; never break consumers silently.
- Idempotency: consumers must be idempotent or deduplicate via event_id/correlation_id.
- Ordering: do not assume strict ordering across distributed consumers; if ordering matters, document and use sequence numbers or single-aggregate event streams.
- Transactional consistency: prefer outbox or DB-backed event staging when integrating with external brokers (documented as optional). Use on_commit for in-process dispatch.

Outbox pattern
--------------
- Outbox pattern improves reliability for publishing to external brokers. Consider as future enhancement if cross-process delivery guarantees are required.
- For now, document the pattern and use it when implementing integrations that cannot tolerate at-least-once gaps.

API boundary and validation
---------------------------
- Presentation (DRF Serializers) handle structural validation; complex domain validation occurs in Application/Domain validators.
- Authorization is an orthogonal concern: check in Presentation for simple permission gating and re-check in Application for business-level authorization.
- Keep views thin: translate request → DTO → call application service → format response.

Frontend boundary
-----------------
- Frontend performs optimistic validation for user experience but authoritative validation is server-side.
- Frontend interacts with backend via stable, versioned APIs documented in docs/05-api.

Database ownership and patterns
-------------------------------
- Single PostgreSQL database is acceptable; ownership is logical not physical.
- Ownership: each bounded context owns its tables; other modules read via public interfaces.
- Foreign keys: allowed across contexts when ownership is clear, but prefer references by ID and read models to avoid cross-module write coupling.
- Soft delete: document and apply selectively. Not all entities require soft delete (e.g. low-value audit logs might be retained elsewhere).
- UUID strategy: use UUIDs as primary keys for cross-system uniqueness; index appropriately and consider surrogate integer PKs only where performance requires.

Soft delete strategy
--------------------
- Entities that require resurrection or historical continuity (Versions, Publishes, Deliveries) should support soft-delete with clear rules.
- Soft-delete must be consistent: queries must default to non-deleted unless explicitly requested.
- Document queries and indexes for soft-deleted records.

Testing architectural rules
---------------------------
- Add import-boundary tests (module dependency tests) to prevent accidental coupling.
- Add contract tests for public module APIs.
- Add event contract tests (schema and version compatibility).

Architecture diagrams (example)
--------------------------------
Mermaid sample (editable):

```mermaid
flowchart TD
  UI[Frontend (React)] -->|HTTP| API[Presentation (DRF views)]
  API --> App[Application Layer (Use Cases)]
  App --> Domain[Domain Layer (Entities / Services)]
  App --> Infra[Infrastructure (adapters)]
  Infra --> DB[(PostgreSQL)]
  Infra --> REDIS[(Redis/Celery)]
  Infra --> STORAGE[(Object Storage)]
  Domain -->|emits| Events[(Domain Events)]
  Events --> Infra
```

This diagram should be expanded into container and module diagrams for the repository.

Shared Kernel and Core anti-patterns
------------------------------------
Avoid letting core become a dumping ground. Prefer small, well-justified shared primitives. Create an ADR when adding core concepts.

Anti-patterns to avoid
----------------------
- Fat API View / Fat Serializer — move logic to Application/Domain
- God Service / God Model — split responsibilities into smaller services or domain objects
- Cross-module ORM access — import via public APIs
- Business logic in QuerySets/Managers
- Excessive repository/abstraction ceremony without multiple implementations
- Event for every CRUD change — emit events for meaningful business facts

ADR alignment and recommendations
---------------------------------
- Map existing ADRs to this model. ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0016, ADR-0018, ADR-0026 should be referenced and, where overlap exists, a consolidating ADR should be created to clarify shared kernel and event bus distinctions (e.g., ADR-0005 vs ADR-0018).
- Create ADRs for any deliberate exceptions to dependency rules.

Developer / AI-assisted workflow
-------------------------------
Before changing a module, follow these steps (machine- and human-readable):
1. Read module architecture (module/README.md)
2. Read domain documentation (docs/03-domain)
3. Read related ADRs
4. Determine public interface to extend
5. Add unit and integration tests
6. Update documentation and ADRs if behavior or boundaries change

This checklist should be enforced in PR templates and CI.

Architecture tests and automation
---------------------------------
Implement the following automated checks in CI:
- Link checks for docs/SUMMARY.md
- Import boundary tests (import-linter or custom script)
- Event contract schema validation
- API contract tests (OpenAPI against examples)

Recommended repository file layout (per module)
-----------------------------------------------
```
apps/<module>/
├── api/                 # presentation layer (views, serializers, urls, permissions)
├── application/         # use-cases, services, commands, queries
├── domain/              # entities, value_objects, domain services, events, exceptions
├── infrastructure/      # persistence adapters, repositories, external integrations
├── models.py            # (if used) django ORM models (prefer infra/persistence mapping)
├── querysets.py         # queryset customizations
├── managers.py          # model managers (creation helpers)
├── selectors.py         # read-oriented query APIs
├── validators.py        # domain- and application-level validators
├── tasks.py             # Celery tasks (infrastructure)
└── tests/
```

This layout is a guideline. Modules may adapt to repository conventions.

Final quality checks
---------------------
- Ensure DDD and Clean Architecture are coherent and complementary in this document.
- Ensure layers do not contradict each other.
- Ensure Django mapping is pragmatic.
- Ensure event, transaction, and shared kernel rules are explicit.

Next steps
----------
- Create module README templates describing ownership and public APIs.
- Add import-boundary tests and a small example of how to structure an application service and selector.
- Convene a brief architecture review to reconcile ADR overlaps (especially event ADRs and shared kernel scope).

Related documents
-----------------
- docs/02-architecture/* (legacy architecture how-tos)
- docs/03-domain/* (domain definitions)
- docs/architecture/documentation-audit.md (Part 1 audit)
- docs/04-architecture (this directory)
- docs/05-api/* (API contract)
- docs/12-reference/glossary.md (canonical terms)

End of document.
