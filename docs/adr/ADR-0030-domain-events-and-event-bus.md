# ADR-0030: Domain Events and Event Bus (Consolidation)

- **Status:** Accepted
- **Date:** 2026-09-07
- **Decision Makers:** Architecture Team
- **Supersedes:** ADR-0005 (Event-Driven Architecture), ADR-0018 (Event Bus Architecture)
- **Superseded By:** None

---

# Context

StudioHub previously recorded its event architecture in two separate ADRs:

- **ADR-0005 — Event-Driven Architecture**: the strategic decision to adopt domain events as the cross-domain communication mechanism.
- **ADR-0018 — Event Bus Architecture**: the concrete Event Bus mechanism and its implementation status.

A documentation audit (`docs/architecture/documentation-audit.md`) identified that the two records substantially overlap: both restate the same context, publication rules, event structure, synchronous/asynchronous guidance, idempotency requirements, and alternatives. Maintaining the same rules in two accepted ADRs risks divergence, and ADR-0018's implementation status had already drifted from the actual code (for example, it described `DomainEvent` as a frozen dataclass and claimed `signals.py` and `mixins/` had been removed; neither is accurate today).

The platform requires a single, canonical decision record for events that reflects both the strategic intent and the implemented mechanism.

---

# Decision

This ADR consolidates ADR-0005 and ADR-0018 into a single record. ADR-0005 and ADR-0018 are retained as historical context but are **superseded by this ADR**; where their wording conflicts with this record, this record prevails.

StudioHub adopts an **event-driven architecture based on domain events, dispatched through a centralized Event Bus owned by Core**.

## Principles

1. **Events are facts.** Events communicate that something has happened (past tense, e.g. `ProjectCreated`, `AssetPublished`), not what another service should do.
2. **Core owns event infrastructure; domains own events.** The bus, dispatcher, registry, base classes, and discovery live in `apps/core/events/`. Concrete domain events are defined in the domain app that owns the aggregate — never in Core.
3. **Publish after commit.** Events are dispatched only after the surrounding database transaction commits, so subscribers never observe uncommitted data. Outside a transaction, dispatch is immediate.
4. **Only services publish.** Models, serializers, views, querysets, and selectors must not publish events directly.
5. **Publishers are unaware of subscribers.** Downstream domains subscribe; the publishing service never invokes consumer implementations.
6. **Subscribers are independent and idempotent.** Repeated delivery must not duplicate side effects. Subscriber failures must not invalidate the completed business transaction.
7. **Asynchronous by default for long-running work.** Lightweight in-process reactions may run synchronously; notifications, media processing, indexing, reporting, and external integrations run through background workers (ADR-0007).
8. **Events are immutable and versioned.** Breaking payload changes require a new event version. Events reference rather than embed sensitive data and respect organization boundaries.

## Scope Split (Historical Record)

| Concern | Previously recorded in | Now canonical in |
| --- | --- | --- |
| Why event-driven; coupling rationale | ADR-0005 | This ADR — Principles |
| Event bus mechanism and lifecycle | ADR-0018 | This ADR — Implementation Status |
| Implementation status of `apps/core/events/` | ADR-0018 | This ADR — Implementation Status |
| Event rules and anti-patterns (usage guide) | `docs/02-architecture/event-system.md` | `docs/02-architecture/event-system.md` (unchanged) |
| Concrete publishing/subscribing how-to | `docs/03-backend/events.md` | `docs/03-backend/events.md` (unchanged) |

---

# Implementation Status

The event bus is implemented in `apps/core/events/` as a single, unified mechanism:

- **Core owns event infrastructure** — `base.py`, `bus.py`, `dispatcher.py`, `publisher.py`, `registry.py`, `subscriber.py`, `handlers.py`, `decorators.py`, `autodiscover.py`, `exceptions.py`, `constants.py`, `typing.py`, `utils.py`, plus media-related event helpers (`tag.py`, `attachment.py`).
- **Domain apps own domain events** — concrete events (e.g. `ProjectCreated`, `ShotStatusChanged`, `AssetPublished`, `VersionApproved`) are defined in their owning domain app, never in Core.
- **`DomainEvent`** (`base.py`) is the base class for domain events. Services publish with `**kwargs` payloads (e.g. `instance`, `user`); the payload is retained on `.payload` for handlers. Subclasses may be frozen dataclasses declaring explicit fields (e.g. `BaseCreated`, `BaseUpdated` with `entity_uuid`, `entity_name`, `organization_uuid`).
- **`DomainEvent.dispatch(**kwargs)`** publishes an instance of the event class to the default bus; subclasses may override it to publish through a specific bus.
- **`EventBus`** (`bus.py`) owns a `Registry` and a `Dispatcher`. The module-level `default_event_bus` singleton is the platform-wide bus; `publish(event)` and `subscribe(event, handler)` are instance methods on it.
- **Transaction-safe dispatch** — `publish` checks the current connection's atomic block: inside a transaction, dispatch is deferred via `transaction.on_commit(...)`; outside one, it dispatches immediately.
- **Autodiscovery** — `autodiscover_events()` imports `{app}.events` for every installed app and calls each module's `register_events()` when present; `CoreConfig.ready()` invokes it at startup.
- **Event mixins** — `apps/core/events/mixins/` provides reusable subscriber behaviors (`auditable`, `cache`, `logging`, `notification`) used by core models and API components.

---

# Alternatives Considered

- **Keep two ADRs with clarified scopes** — rejected: the overlap is too large, and divergence has already occurred between ADR-0018's implementation status and the code.
- **Direct service calls** — rejected (tight coupling, circular dependencies); see superseded ADRs for full analysis.
- **Database triggers** — rejected (hidden logic, difficult testing).
- **External message broker only** — deferred until scaling requires distributed messaging; the in-process bus keeps this evolution possible without changing domain logic.

---

# Consequences

## Positive

- One canonical record for the event architecture; no duplicated or conflicting rules.
- Implementation status can be corrected in one place when the code evolves.
- Historical reasoning in ADR-0005/ADR-0018 remains accessible via cross-references.

## Negative

- The consolidated ADR is longer than either predecessor.
- Existing references to ADR-0005/ADR-0018 in other documents remain valid but resolve to historical records.

---

# Compliance

Architecture reviews should verify:

- Services publish events; no publication from models, serializers, views, querysets, or selectors.
- Domain events are defined in their owning domain app, not Core.
- Events are dispatched after transaction commits.
- Subscribers are independent and idempotent.
- Long-running handlers execute asynchronously.
- Events use past-tense names and are versioned on breaking changes.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0004 — Domain-Driven Design
- ADR-0005 — Event-Driven Architecture (superseded, historical)
- ADR-0007 — Background Processing with Celery & Redis
- ADR-0011 — Audit Logging Strategy
- ADR-0015 — Caching Strategy
- ADR-0018 — Event Bus Architecture (superseded, historical)

---

# References

- `docs/02-architecture/event-system.md`
- `docs/03-backend/events.md`
- `docs/03-backend/services.md`
- `docs/06-infrastructure/messaging.md`
- `docs/architecture/documentation-audit.md`
