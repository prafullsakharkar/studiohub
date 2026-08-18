Core Architecture — StudioHub

Overview
--------
Core is the shared kernel and infrastructure layer of StudioHub. It provides
stable, domain-agnostic building blocks used by all domain applications. Core
is intentionally narrow, focusing on infrastructure concerns such as:

- Persistence primitives (models, QuerySets, managers)
- API foundation (DRF serializers, view/viewset bases, builders)
- Event infrastructure (bus, dispatcher, registry, publisher)
- Cross-cutting infrastructure (logging, context, middleware, storage, security)

Conceptual diagram
------------------

                         StudioHub
                            │
              ┌─────────────┼─────────────┐
              │             │             │
          Identity     Organization   Production
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                           Core
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   Persistence             API               Events
        │                   │                   │
   Models               DRF              Event Bus
   QuerySets            Serializers       Publisher
   Managers             Views             Dispatcher
   Selectors            Filters           Registry
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    Infrastructure
                            │
          ┌─────────┬───────┼────────┬──────────┐
          │         │       │        │          │
       Storage   Security  Context  Logging   Middleware

Principles
----------
- Domain independence: Core must never import business application code. The
  dependency direction is always domain app → core.
- Low coupling: Keep public APIs small and stable. Prefer composition over
  inheritance and avoid sprawling base classes.
- High cohesion: Each Core component has a focused responsibility.
- Testability: Core provides test fixtures and meta-level tests to guard the
  public surface.

Public surface
--------------
- apps.core.models: foundational mixins (UUIDModel, TimeStampedModel,
  SoftDeleteModel), BaseModel (deprecated convenience aggregate), managers,
  and QuerySet mixins.
- apps.core.api: Base serializers, Base viewsets, ResponseBuilder, pagination
  strategies, common permissions, and generic filters.
- apps.core.events: Event bus, dispatcher, registry and publisher.
- apps.core.services: generic infrastructure services (soft delete, lifecycle,
  event publishing helpers).
- apps.core.logging: structured logging adapters and context integration.
- apps.core.filesystem: storage abstractions and local adapter (planned).

Compatibility and migration
---------------------------
- When migrating domain-scoped code out of Core (e.g., project/shot/sequence
  bases), create compatibility re-exports in Core that emit deprecation
  warnings for at least one release.
- Add CI checks to enforce Core → Domain boundaries and catch regressions.

"Stable foundation" checklist
----------------------------
- Core contains no direct imports from business apps in production code.
- Public invariants (serializer/viewset shapes, event bus contract,
  manager/queryset API) are protected by tests.
- Cross-cutting context uses ContextVar to avoid global mutable state.

See also
--------
- docs/architecture/core-refactor-analysis.md
- docs/02-architecture/service-layer.md
- docs/02-architecture/selector-pattern.md
- docs/02-architecture/event-system.md
