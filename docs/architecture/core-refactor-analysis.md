# StudioHub Core Module — Refactoring Analysis (Part 01)

> **Scope:** Analysis only. No production code was modified, moved, or deleted.
> **Date:** 2026-08-14
> **Module:** `backend/apps/core/`
> **Related:** `backend/apps/identity/`, `backend/apps/organization/`

---

## 1. Rules Status

### 1.1 `.roo/rules/` inventory

The `.roo/rules/` directory contains **exactly one file**:

| File | Purpose | Status |
|------|---------|--------|
| `.roo/rules/hindsight-memory.md` | Hindsight long-term memory usage rules | Present |

### 1.2 Coverage assessment

- **No architecture rules exist** in `.roo/rules/`. There are no rules governing module boundaries, dependency direction, layering, naming, or the Core↔Domain relationship.
- The only rule file governs the **Hindsight memory tool**, not the codebase architecture.
- **Gap:** The architecture is documented in `docs/adr/` (25 ADRs) and `docs/03-backend/core.md`, but none of it is enforced as machine-readable rules. This is a primary reason the Core module has drifted into a "dumping ground."

### 1.3 Recommendation

- Do **not** add rules during Part 01 (analysis only).
- In a later stage, codify the Core boundary as `.roo/rules/` (e.g., `core-boundary.md`, `dependency-direction.md`) and back it with architecture tests (see Section 19).

---

## 2. Documentation & ADR Contradictions

### 2.1 Contradiction: ADR-0002 layering vs. actual structure

- **ADR-0002** defines a strict layered flow: `API → Serializers → Permissions → Validators → Services → Selectors → Managers → QuerySets → Models → Database`.
- **Actual:** `apps/core/` mixes these layers with cross-cutting concerns (`context/`, `security/`, `text/`, `dates/`, `filesystem/`, `i18n/`, `logging/`, `middleware/`, `choices/`, `filters/`) and domain-leaking abstractions (`models/bases/scopes.py`, `models/bases/ownership.py`, `api/permissions/`, `choices/department.py`). The layering is not cleanly reflected in the directory structure.

### 2.2 Contradiction: ADR-0004 DDD "shared kernel" vs. domain leakage

- **ADR-0004** positions Core as a **shared kernel** — generic, domain-agnostic foundations.
- **Actual:** Core contains VFX/production-specific abstractions (Project/Sequence/Shot/Task/Review scoped models, VFX departments, project permissions). This violates the shared-kernel contract.

### 2.3 Contradiction: ADR-0002 dependency rule vs. `viewsets/base.py`

- **ADR-0002** states Domain Applications depend on Core, not vice versa.
- **Actual:** `apps/core/api/viewsets/base.py` imports `HasPermission` from `apps.identity.permissions` — a **Core→identity dependency violation** (see Section 8).

### 2.4 Contradiction: docs vs. implementation (empty scaffolding)

- `docs/03-backend/core.md` and `docs/08-development/core.md` describe a rich Core. Many documented directories are **empty scaffolding** (see Section 5.3). `docs/08-development/core.md` is entirely empty.

### 2.5 Contradiction: ADR-0018 event bus vs. broken event import

- **ADR-0018** mandates a consistent event framework. The framework exists (`DomainEvent`, `EventBus`, `publish`, `subscribe`), but `identity/events/mfa.py` imports a non-existent `Event` symbol (see Section 8.3), indicating the event contract is not consistently applied.

---

## 3. Actual `apps/core/` Filesystem Inventory

### 3.1 Top-level files

| File | Content | Assessment |
|------|---------|------------|
| `__init__.py` | Empty | Dead scaffolding |
| `apps.py` | `CoreConfig` with `ready()` | Keep |
| `aliases.py` | JSON/JSONList/Headers/Metadata/QueryParams/Context aliases | Keep |
| `constants.py` | Empty | Dead scaffolding |
| `protocols.py` | HasOrganization/HasOwner/HasStatus/HasMetadata/HasAudit | Keep |
| `types.py` | UUIDType/PathLike/ID/PrimaryKey/Color/Slug/Email/Phone | Keep |
| `typing.py` | Re-exports aliases/protocols/types | Keep |

### 3.2 Sub-packages

| Package | Files | Assessment |
|---------|-------|------------|
| `api/` | builders, exceptions, filters, mixins, pagination, permissions, renderers, serializers, utils, views, viewsets | **Keep** (foundation), but see domain leakage |
| `choices/` | base, department, file, lifecycle, priority, publish, record, visibility | **Keep** (generic), **MOVE** department |
| `context/` | builder, organization, permission, request, user (all empty) | **REMOVE** (dead) |
| `dates/` | formatting, ranges, timezone (all empty) | **REMOVE** (dead) |
| `events/` | full event framework | **Keep** |
| `filesystem/` | paths, storage, upload (all empty) | **REMOVE** (dead) |
| `filters/` | base, date, metadata, ordering, organization, ownership, search, soft_delete, status | **Keep** (generic), **MOVE** organization |
| `i18n/` | constants, countries, currencies, languages, timezones, utils, validators | **Keep** |
| `logging/` | full logging framework | **Keep** |
| `managers/` | active, base, lifecycle, organization, publishable, soft_delete | **Keep** |
| `middleware/` | audit, authentication, base, locale, maintenance, organization, request_context, request_id, security, timezone | **Keep** (generic), **MOVE** organization |
| `models/` | base, bases, managers, mixins, querysets | **Keep** (foundation), but see domain leakage |
| `security/` | hashing, signing, tokens (all empty) | **REMOVE** (dead) |
| `selectors/` | base, utils, mixins | **Keep** |
| `services/` | full service framework | **Keep** |
| `text/` | casing, formatting, normalization (all empty) | **REMOVE** (dead) |
| `utils/` | datetime, enums, files, hashing, json, logger, response, serializers, slug, strings, uuid | **Keep** (fix uuid.py) |
| `validators/` | full validator set | **Keep** |

### 3.3 Empty / dead-code inventory

Confirmed empty or placeholder files:

- `core/__init__.py`, `core/constants.py`
- `context/` — all 6 files
- `security/` — all 4 files
- `text/` — all 4 files
- `dates/` — all 4 files
- `filesystem/` — all 4 files
- `api/filters/` — both files
- `api/views/` — 9 of 12 files
- `api/mixins/` — 5 of 18 files
- `permissions/` — 3 of 13 files
- `selectors/mixins/` — 5 files
- `events/signals.py`, `events/mixins/` — 4 files
- `models/bases/querysets.py`
- `models/querysets/mixins/project.py`, `ownership.py`
- `models/querysets/search.py`
- `validators/asset.py`, `shot.py`
- `docs/08-development/core.md`

---

## 4. Proposed Target Structure — Validation

The proposed target structure introduces `application/`, `domain/`, and `persistence/` layers inside Core. This is **critically evaluated** below.

### 4.1 Directory-by-directory verdict

| Proposed directory | Verdict | Rationale |
|--------------------|---------|-----------|
| `application/` | **REJECT** | Core is a shared kernel, not an application layer. Application services belong in each domain app, not Core. Adding this layer to Core would re-create the dumping-ground problem. |
| `domain/` | **REJECT** | Core must be domain-agnostic. A `domain/` folder inside Core contradicts ADR-0004 (shared kernel). Domain entities belong in their owning apps. |
| `persistence/` | **REJECT** | Core already has `models/`, `managers/`, `querysets/`. A separate `persistence/` layer is redundant and over-engineered for a modular monolith. |
| `api/` | **KEEP** | Core API foundation (viewsets, serializers, permissions, pagination, renderers, exceptions) is legitimate shared infrastructure. |
| `events/` | **KEEP** | Core event framework is a genuine shared kernel. |
| `services/` | **KEEP** | Core service base classes (BaseService → CRUDService → AuditService → EventService → CacheService, BusinessService) are shared infrastructure. |
| `selectors/` | **KEEP** | Core selector base is shared infrastructure. |
| `models/` | **KEEP** | Core model foundations (UUID, timestamp, audit, soft-delete, metadata, entity) are shared. **MOVE** domain-scoped bases out. |
| `managers/` | **KEEP** | Core managers are shared. |
| `querysets/` | **KEEP** | Core querysets are shared. |
| `validators/` | **KEEP** | Core validators are shared. |
| `filters/` | **KEEP** | Generic filter mixins are shared. **MOVE** organization filter out. |
| `choices/` | **KEEP** | Generic choices are shared. **MOVE** department out. |
| `middleware/` | **KEEP** | Generic middleware is shared. **MOVE** organization middleware out. |
| `i18n/` | **KEEP** | Shared i18n utilities. |
| `logging/` | **KEEP** | Shared logging framework. |
| `utils/` | **KEEP** | Shared utilities (fix uuid.py). |
| `context/`, `security/`, `text/`, `dates/`, `filesystem/` | **REMOVE** | All empty scaffolding. Remove or defer until real content exists. |

### 4.2 Overall verdict

The proposed `application/domain/persistence` layering is **over-engineering** for a modular monolith. The current ADR-0002/0003 architecture (models → querysets → managers → selectors → services → validators → events → api) already provides the correct layering. Introducing DDD-style `domain/` and `application/` folders inside Core would:

1. Contradict ADR-0004 (Core = shared kernel, not a domain).
2. Duplicate the existing service/selector layering.
3. Add indirection without benefit at this scale.

**Recommendation:** Keep Core as a flat, layered shared-kernel package. Do **not** add `application/`, `domain/`, or `persistence/`. Instead, enforce the existing ADR-0002/0003 layering and remove domain leakage.

---

## 5. Core Responsibility

### 5.1 Definition

**Core is the technical foundation / shared kernel of the platform.** It provides generic, domain-agnostic building blocks that all domain apps (identity, organization, production, assets, etc.) depend on. Core is **not** a dumping ground for cross-cutting or domain-specific code.

### 5.2 What belongs in Core

- **Model foundations:** UUID, timestamp, audit, soft-delete, metadata, entity, named-entity, publishable, lifecycle, orderable, color, branding, device/client/network/geo information.
- **Data access foundations:** BaseQuerySet, BaseManager, soft-delete/publishable/organization querysets & managers.
- **Service foundations:** BaseService, CRUDService, AuditService, EventService, CacheService, BusinessService, and generic mixins (lifecycle, soft-delete).
- **Selector foundation:** BaseSelector.
- **Event framework:** DomainEvent, EventBus, EventRegistry, EventDispatcher, publisher, subscriber, decorators, autodiscover.
- **Validation:** generic validators (color, country, currency, datetime, email, file, frame, image, json, language, naming, password, path, regex, sequence, slug, timezone, url, uuid, video).
- **API foundation:** BaseViewSet, ServiceModelViewSet, BaseModelViewSet, serializers, pagination, renderers, exceptions, permission base classes.
- **Cross-cutting utilities:** i18n, logging, generic middleware, generic filters, generic choices, utils.

### 5.3 What does NOT belong in Core

- **Domain entities** (Project, Sequence, Shot, Task, Asset, Review, Version) — belong in their owning apps.
- **Domain-scoped abstractions** (OrganizationScopedModel, ProjectScopedModel, etc.) — belong in owning apps.
- **Domain permissions** (IsOrganizationMember, IsProjectMember, IsReviewer) — belong in owning apps.
- **Domain choices** (VFX Department) — belongs in production app.
- **Domain middleware/filters** (OrganizationMiddleware, OrganizationFilterMixin) — belong in organization app.
- **Domain exceptions** (OrganizationPermissionException, ProjectPermissionException) — belong in owning apps.

---

## 6. Domain Leakage Audit

The following Core components leak domain concepts and must be moved to their owning apps in a later stage.

### 6.1 Models

| File | Leaked concept | Target app |
|------|----------------|------------|
| `models/bases/ownership.py` | `OrganizationOwnedModel`, `ProjectOwnedModel`, `UserOwnedModel` | organization / production / identity |
| `models/bases/scopes.py` | `OrganizationScopedModel`, `ProjectScopedModel`, `SequenceScopedModel`, `ShotScopedModel`, `TaskScopedModel`, `ReviewScopedModel`, `UserScopedModel` | organization / production / review / identity |
| `models/bases/organization.py` | `OrganizationEntityModel` | organization |
| `models/bases/project.py` | `ProjectEntityModel` | production |
| `models/bases/user.py` | `UserEntityModel` | identity |
| `models/querysets/organization.py` | `OrganizationQuerySet` | organization |
| `models/querysets/mixins/organization.py` | `OrganizationQuerySetMixin` | organization |
| `models/querysets/mixins/project.py` | (empty) project mixin | production |
| `models/querysets/mixins/ownership.py` | (empty) ownership mixin | organization |

### 6.2 API

| File | Leaked concept | Target app |
|------|----------------|------------|
| `api/viewsets/base.py` | imports `HasPermission` from `apps.identity.permissions` | identity (dependency violation) |
| `api/permissions/organization.py` | `IsOrganizationMember`, `IsOrganizationAdmin` | organization |
| `api/permissions/project.py` | `IsProjectMember` | production |
| `api/permissions/reviewer.py` | `IsReviewer` | review |
| `api/exceptions/permissions.py` | `OrganizationPermissionException`, `ProjectPermissionException` | organization / production |

### 6.3 Choices / Filters / Middleware

| File | Leaked concept | Target app |
|------|----------------|------------|
| `choices/department.py` | `Department` (VFX: MODELING, RIGGING, ANIMATION, FX, LIGHTING, COMPOSITING, EDITORIAL, PRODUCTION) | production |
| `filters/organization.py` | `OrganizationFilterMixin` | organization |
| `middleware/organization.py` | `OrganizationMiddleware` (X-Organization header) | organization |

### 6.4 Validators

| File | Leaked concept | Target app |
|------|----------------|------------|
| `validators/asset.py` | (empty) asset validator | assets |
| `validators/shot.py` | (empty) shot validator | production |

---

## 7. Core Dependency Rule

### 7.1 The rule

**Domain Applications → Core** (Domain depends on Core). **Core must NOT depend on any Domain Application.**

### 7.2 Dependency graph (current)

```text
identity ──┐
           ├──▶ core  (models, services, selectors, events, validators, api, i18n, choices)
organization ┘

core ──▶ identity   ❌ VIOLATION (api/viewsets/base.py imports HasPermission)
```

### 7.3 Violations

| Violation | Location | Impact |
|-----------|----------|--------|
| Core → identity | `api/viewsets/base.py:19-21` | `BaseViewSet` (the foundation of every viewset) imports `HasPermission` from identity. This makes Core unusable without identity and creates a circular conceptual dependency. |

### 7.4 Fix direction (later stage)

- Move `HasPermission`-based default permission resolution out of `BaseViewSet`, or invert the dependency so identity supplies the permission class via configuration/injection rather than Core importing it.

---

## 8. Application / Domain / Infrastructure Analysis

### 8.1 Current state

- **Infrastructure (Core):** models, querysets, managers, services, selectors, events, validators, api, i18n, logging, middleware, filters, choices, utils.
- **Domain apps:** `identity`, `organization` (only 2 exist; ADRs reference production/assets/pipeline/review/reporting/notifications/automation as planned).
- **Application layer:** Not explicitly separated. Application orchestration currently lives inside domain services (e.g., `BusinessService` in Core, domain services in identity/organization).

### 8.2 Simplest recommended architecture

For a modular monolith, the **simplest correct architecture** is:

1. **Core** = shared kernel / infrastructure (as defined in Section 5).
2. **Each domain app** = its own bounded context containing its models, querysets, managers, selectors, services, validators, events, permissions, serializers, viewsets, and application orchestration.
3. **No separate `application/` or `domain/` folders** inside Core or inside domain apps at this scale. The existing ADR-0002/0003 layering already separates concerns within each app.

### 8.3 Critical finding: broken event import

- `backend/apps/identity/events/mfa.py:1` does `from apps.core.events import Event`.
- `apps/core/events/__init__.py` does **not** export `Event` (only `DomainEvent`, `EventBus`, `EventSource`, `EventVersion`, `publish`, `subscribe`, `listens_to`, exceptions, `DomainEventHandler`).
- No `class Event` exists anywhere in `apps/core`.
- `mfa.py` is imported by `identity/services/mfa/*` (enrollment, verification, lockout, recovery, trusted_device), so this is a **latent ImportError** that will surface when MFA services are loaded.
- **Fix (later stage):** change `mfa.py` to subclass `DomainEvent` (consistent with all other identity events) or export `Event` as an alias.

---

## 9. Model Foundation Audit

### 9.1 Base models (keep)

| Model | File | Notes |
|-------|------|-------|
| `UUIDModel` | `models/bases/uuid.py` | UUID PK, default uuid4 |
| `TimeStampedModel` | `models/bases/timestamp.py` | created_at/updated_at |
| `AuditModel` | `models/bases/audit.py` | audit fields |
| `MetadataModel` | `models/bases/metadata.py` | metadata JSON |
| `SoftDeleteModel` | `models/bases/soft_delete.py` | soft delete |
| `EntityModel` | `models/bases/entity.py` | composes UUID+TimeStamped+Audit+Metadata+SoftDelete |
| `NamedEntityModel` | `models/bases/named.py` | name/description + slug |
| `PublishableModel` | `models/bases/publishable.py` | is_published |
| `LifecycleModel` | `models/bases/lifecycle.py` | lifecycle status |
| `OrderableModel` | `models/bases/orderable.py` | ordering |
| `ColorModel` | `models/bases/color.py` | color |
| `BrandingModel` | `models/bases/branding.py` | logo/colors/icon |
| `DeviceInformationModel` | `models/bases/device.py` | device info |
| `ClientInformationModel` | `models/bases/client.py` | client info |
| `GeoLocationModel` | `models/bases/location.py` | geo |
| `NetworkInformationModel` | `models/bases/network.py` | network |

### 9.2 Domain-scoped bases (MOVE out)

| Model | File | Target |
|-------|------|--------|
| `OrganizationOwnedModel`, `ProjectOwnedModel`, `UserOwnedModel` | `models/bases/ownership.py` | organization/production/identity |
| `OrganizationScopedModel` … `UserScopedModel` | `models/bases/scopes.py` | organization/production/review/identity |
| `OrganizationEntityModel` | `models/bases/organization.py` | organization |
| `ProjectEntityModel` | `models/bases/project.py` | production |
| `UserEntityModel` | `models/bases/user.py` | identity |

### 9.3 Mixins (keep)

`models/mixins/`: AuditMixin, BaseMixin, ColorMixin, MetadataMixin, OrderingMixin, OwnershipMixin, PublishableMixin, SearchMixin, SlugMixin, SoftDeleteMixin.

### 9.4 Exports

- `models/bases/__init__.py` exports all base models (including domain-scoped ones — these should be trimmed when moved).
- `models/mixins/__init__.py` exports all mixins.
- `models/querysets/__init__.py` exports BaseQuerySet, OrganizationQuerySet, PublishableQuerySet, SoftDeleteQuerySet.
- `models/__init__.py` star-imports from base, bases, mixins, querysets.

---

## 10. QuerySet / Manager Audit

### 10.1 QuerySets

| QuerySet | File | Assessment |
|----------|------|------------|
| `BaseQuerySet` | `models/querysets/base.py` | Keep (active/inactive/ids/ordered/latest_first/oldest_first) |
| `SoftDeleteQuerySet` | `models/querysets/soft_delete.py` | Keep |
| `PublishableQuerySet` | `models/querysets/publishable.py` | Keep |
| `OrganizationQuerySet` | `models/querysets/organization.py` | **MOVE** to organization |
| `SoftDeleteQuerySetMixin` | `models/querysets/mixins/soft_delete.py` | Keep |
| `OrganizationQuerySetMixin` | `models/querysets/mixins/organization.py` | **MOVE** to organization |
| `project.py`, `ownership.py`, `search.py` mixins | `models/querysets/mixins/` | Empty — remove |

### 10.2 Managers

| Manager | File | Assessment |
|---------|------|------------|
| `BaseManager` | `managers/base.py` | Keep |
| `ActiveManager` | `managers/active.py` | Keep |
| `SoftDeleteManager` | `managers/soft_delete.py` | Keep |
| `PublishableManager` | `managers/publishable.py` | Keep |
| `OrganizationManager` | `managers/organization.py` | **MOVE** to organization |
| `LifecycleManager` | `managers/lifecycle.py` | Keep |
| `AllObjectsManager`, `DeletedObjectsManager`, `AllPublishedManager`, `PublishedManager` | `managers/__init__.py` | Keep |

---

## 11. Service / Selector Audit

### 11.1 Service inheritance chain (keep)

```text
BaseService
 └── CRUDService
      └── AuditService
           └── EventService
                └── CacheService
BusinessService(LifecycleMixin, SoftDeleteMixin, AuditService)
```

### 11.2 Services

| Service | File | Assessment |
|---------|------|------------|
| `BaseService` | `services/base.py` | Keep |
| `CRUDService` | `services/crud.py` | Keep |
| `AuditService` | `services/audit.py` | Keep |
| `EventService` | `services/event.py` | Keep |
| `CacheService` | `services/cache.py` | Keep |
| `BusinessService` | `services/business.py` | Keep (large, 577 lines — consider splitting) |
| `LifecycleService` | `services/lifecycle.py` | Keep |
| `SoftDeleteService` | `services/soft_delete.py` | Keep |
| `PublishableService` | `services/publishable.py` | Keep |
| `OrderingService` | `services/ordering.py` | Keep |
| `MetadataService` | `services/metadata.py` | Keep |
| `SlugService` | `services/slug.py` | Keep |
| `ColorService` | `services/color.py` | Keep |
| `BulkService` | `services/bulk.py` | Keep |
| `EmailService` | `services/email.py` | Keep |
| `NotificationService` | `services/notifications.py` | Keep |
| `StorageService` | `services/storage.py` | Keep |
| `SearchService` | `services/search.py` | Keep |
| `LifecycleMixin`, `SoftDeleteMixin` | `services/mixins/` | Keep |

### 11.3 Selectors

| Selector | File | Assessment |
|----------|------|------------|
| `BaseSelector` | `selectors/base.py` | Keep |
| `selectors/utils.py` | `selectors/utils.py` | Keep |
| `selectors/mixins/` (filtering, pagination, prefetch, search, select_related) | `selectors/mixins/` | All empty — remove |

---

## 12. Event Audit

### 12.1 Framework (keep)

| Component | File | Assessment |
|-----------|------|------------|
| `DomainEvent` | `events/base.py` | Keep (dataclass, frozen, slots, kw_only) |
| `EventBus` | `events/bus.py` | Keep |
| `EventRegistry` | `events/registry.py` | Keep |
| `EventDispatcher` | `events/dispatcher.py` | Keep |
| `publish` | `events/publisher.py` | Keep |
| `subscribe` | `events/subscriber.py` | Keep |
| `listens_to` | `events/decorators.py` | Keep |
| `autodiscover_events` | `events/autodiscover.py` | Keep |
| `DomainEventHandler` | `events/handlers.py` | Keep |
| `EventSource`, `EventVersion` | `events/constants.py` | Keep |
| exceptions | `events/exceptions.py` | Keep |
| `event_name`, `event_module` | `events/utils.py` | Keep |
| `EventHandlerProtocol` | `events/typing.py` | Keep |

### 12.2 Dead / broken

| Item | File | Assessment |
|------|------|------------|
| `signals.py` | `events/signals.py` | Empty — remove |
| `events/mixins/` (auditable, cache, logging, notification) | `events/mixins/` | Empty — remove |
| **`Event` import** | `identity/events/mfa.py:1` | **Broken** — `Event` not exported by `apps.core.events` |

### 12.3 Event usage across apps

- `identity` and `organization` both subclass `DomainEvent` for their domain events (correct direction: Domain → Core).
- `identity/events/mfa.py` is the sole outlier importing a non-existent `Event`.

---

## 13. API Audit

### 13.1 Builders (keep)

`ExportBuilder`, `PaginationBuilder`, `ResponseBuilder` (success/error envelope: success/status_code/message/data/meta/errors).

### 13.2 Exceptions (keep)

- `api/exceptions/api.py`: BaseAPIException + BadRequest/Validation/Authentication/PermissionDenied/NotFound/Conflict/ResourceLocked/RateLimit/ServiceUnavailable.
- `api/exceptions/authentication.py`: InvalidCredentials, UserInactive, EmailNotVerified, PasswordExpired.
- `api/exceptions/validation.py`: ValidationException, DuplicateNameException, InvalidStateException.
- `api/exceptions/handlers.py`: custom_exception_handler.
- `api/exceptions/permissions.py`: PermissionDeniedException, **OrganizationPermissionException, ProjectPermissionException (MOVE)**.

### 13.3 Filters (dead)

`api/filters/base.py` and `api/filters/__init__.py` are **both empty** — remove.

### 13.4 Pagination (keep)

`BasePagination` (page_size=25, max=500), `StandardCursorPagination` (ordering=-created_at), `InfinitePagination` (page_size=50), `StandardLimitOffsetPagination` (default_limit=25, max=500), `StandardPagination`.

### 13.5 Renderers (keep)

`CSVRenderer`, `ExcelRenderer` (openpyxl), `StandardJSONRenderer` (pass).

### 13.6 Utils (keep)

`RequestUtils`, `ResponseUtils`, `SerializerUtils`.

### 13.7 Serializers (keep)

`BaseSerializer`, `BaseModelSerializer`, `BaseReadSerializer`, `BaseWriteSerializer`, `BaseNestedSerializer`, `BaseListSerializer`, `BulkModelSerializer`, `NestedModelSerializer`, fields (LowercaseEmailField, UppercaseCharField, TrimmedCharField, ChoiceDisplayField).

### 13.8 Permissions

| Permission | File | Assessment |
|------------|------|------------|
| `BasePermission` | `permissions/base.py` | Keep |
| `PermissionMapPermission` | `permissions/mixins.py` | Keep |
| `PermissionResolver` | `permissions/resolver.py` | Keep |
| `ReadOnlyPermission` | `permissions/readonly.py` | Keep |
| `IsOwner` | `permissions/owner.py` | Keep |
| `IsStaff`, `IsSuperUser` | `permissions/staff.py` | Keep |
| `IsOrganizationMember`, `IsOrganizationAdmin` | `permissions/organization.py` | **MOVE** to organization |
| `IsProjectMember` | `permissions/project.py` | **MOVE** to production |
| `IsReviewer` | `permissions/reviewer.py` | **MOVE** to review |

### 13.9 Viewsets

| ViewSet | File | Assessment |
|---------|------|------------|
| `BaseViewSet` | `viewsets/base.py` | Keep, but **remove identity import** (Section 7) |
| `ServiceModelViewSet` | `viewsets/service.py` | Keep |
| `BaseModelViewSet` | `viewsets/generic.py` | Keep |
| `ReadOnlyModelViewSet` | `viewsets/readonly.py` | Keep |
| `NestedModelViewSet` | `viewsets/nested.py` | Keep |
| `BulkModelViewSet` | `viewsets/bulk.py` | Keep (pass) |

### 13.10 Views (mostly dead)

`api/views/base.py` (BaseAPIView) is real; `api/views/generic.py` and 9 others are empty scaffolding.

### 13.11 Mixins

Real: ResponseMixin, ContextMixin, ErrorMixin, FilteringMixin, PaginationMixin, PermissionMixin, QuerysetMixin, ServiceMixin, ValidationMixin, AuditMixin, MetadataMixin, DynamicFieldsMixin. Empty: action, filter, ordering, selector, serializer.

---

## 14. Cross-Cutting Audit

### 14.1 i18n (keep)

`constants.py` (DEFAULT_COUNTRY="IN", DEFAULT_LANGUAGE="en", DEFAULT_CURRENCY="INR", DEFAULT_TIMEZONE="Asia/Kolkata"), `countries.py`, `currencies.py`, `languages.py`, `timezones.py`, `validators.py` (validate_country/currency/language/timezone). `utils.py` empty.

### 14.2 logging (keep)

`config.py` (LOGGING dict), `constants.py` (DEFAULT/API/DB/AUTH/SECURITY/AUDIT/TASK loggers), `context.py` (ContextVars), `filters.py` (RequestContextFilter), `formatters.py` (StandardFormatter), `handlers.py` (rotating_file_handler), `logger.py` (get_logger), `middleware.py` (LoggingContextMiddleware), `utils.py` (log_exception).

### 14.3 middleware (keep generic, move organization)

Real: BaseMiddleware, RequestIDMiddleware, SecurityHeadersMiddleware, TimezoneMiddleware, LocaleMiddleware, MaintenanceMiddleware, AuditMiddleware, AuthenticationMiddleware (pass). Empty: request_context.py. **MOVE:** OrganizationMiddleware.

### 14.4 filters (keep generic, move organization)

Real: BaseFilterSet, SearchFilterMixin, SoftDeleteFilterMixin, DateRangeFilterMixin, MetadataFilterMixin, OrderingFilterMixin, StatusFilterMixin, OwnershipFilterMixin. **MOVE:** OrganizationFilterMixin.

### 14.5 choices (keep generic, move department)

Real: BaseChoices, Priority, PublishStatus, Visibility, LifecycleStatus, RecordStatus, FileType. **MOVE:** Department (VFX).

### 14.6 utils (keep, fix uuid.py)

Real: datetime, enums, files, hashing, json, logger, response, serializers, slug, strings, uuid. **BUG:** `utils/uuid.py:38` uses Python 2 syntax `except ValueError, TypeError:` — invalid in Python 3 (should be `except (ValueError, TypeError):`).

### 14.7 Empty cross-cutting dirs (remove)

`context/`, `security/`, `text/`, `dates/`, `filesystem/` — all empty.

---

## 15. Public Import Audit

### 15.1 Scale

**237 imports** of `apps.core` across the codebase. `identity` and `organization` depend heavily on Core.

### 15.2 What domain apps import from Core

| Core surface | Imported by |
|--------------|-------------|
| `models` (AuditModel, BaseQuerySet, BaseManager, mixins, bases) | identity, organization |
| `services` (BusinessService, BaseService, EventBus) | identity, organization |
| `events` (DomainEvent, EventBus, publish, subscribe) | identity, organization |
| `selectors` (BaseSelector) | identity, organization |
| `validators` | identity, organization |
| `api` (BaseAPIView, ServiceModelViewSet, BaseWriteSerializer, BaseNestedSerializer, BaseReadSerializer) | identity, organization |
| `i18n`, `choices`, `filters` | identity, organization |
| `logging` (LOGGING) | config/settings/components/logging.py |
| `models.mixins.slug`, `validators` | organization/migrations/0001_initial.py |

### 15.3 Direction check

- **Correct:** identity/organization → core (Domain → Core).
- **Violation:** core → identity (`api/viewsets/base.py`).
- **Broken:** `identity/events/mfa.py` imports `Event` from `apps.core.events` (not exported).

### 15.4 Public API surface (stable contracts)

The following are the de-facto public contracts that must remain stable during refactoring (or be migrated with compatibility shims):

- `apps.core.models`: AuditModel, BaseQuerySet, BaseManager, EntityModel, NamedEntityModel, SoftDeleteModel, TimeStampedModel, UUIDModel, mixins.
- `apps.core.services`: BaseService, BusinessService, CRUDService, AuditService, EventService, CacheService.
- `apps.core.events`: DomainEvent, EventBus, publish, subscribe, listens_to, DomainEventHandler.
- `apps.core.selectors`: BaseSelector.
- `apps.core.api`: BaseAPIView, ServiceModelViewSet, BaseModelViewSet, BaseWriteSerializer, BaseReadSerializer, BaseNestedSerializer, BaseListSerializer, pagination, renderers, exceptions.
- `apps.core.validators`, `apps.core.managers`, `apps.core.i18n`, `apps.core.logging`, `apps.core.choices`, `apps.core.filters`.

---

## 16. Test Audit

### 16.1 Findings

- **Zero test files exist** in the entire `backend/apps/` tree (no `test_*.py`, no `*_test.py`, no `tests/` directories).
- **No `tests/` directory** at the backend root.
- **pytest is fully configured** but unused:
  - `pyproject.toml`: `DJANGO_SETTINGS_MODULE = "config.settings.testing"`, `python_files = ["test_*.py", "*_test.py"]`, `addopts = ["--reuse-db", "--strict-markers", "--cov=apps"]`, `testpaths = ["tests", "apps"]`.
  - Dev deps include pytest, pytest-django, pytest-cov, factory-boy, faker.
- **Testing settings exist** (`config/settings/testing.py`): MD5 password hasher, locmem email backend, eager Celery.

### 16.2 Assessment

The testing infrastructure is fully provisioned but **no tests have been written**. This is a critical gap: the Core module (and the whole backend) has no automated safety net, which makes the refactoring riskier.

---

## 17. Architecture Test Recommendations

Given zero existing tests, the following architecture tests should be added **before** any refactoring (in a later stage) to enforce the Core boundary:

### 17.1 Dependency direction tests

- **Core must not import from any domain app** (`identity`, `organization`, `production`, `assets`, etc.). Enforce via a test that scans `apps/core` for imports of `apps.identity`, `apps.organization`, etc. (This would currently fail on `viewsets/base.py`.)
- **Domain apps may import from Core** — no restriction.

### 17.2 Domain leakage tests

- Assert that `apps/core` contains no references to domain entity names (Project, Sequence, Shot, Task, Asset, Review, Version, Organization-owned concepts) in model bases, permissions, choices, filters, middleware.
- Assert that `apps/core/models/bases/scopes.py` and `ownership.py` are empty or removed.

### 17.3 Public API stability tests

- Assert that the public contracts in Section 15.4 remain importable after refactoring (import smoke tests).

### 17.4 Empty-scaffolding tests

- Assert that no empty placeholder modules remain in `apps/core` (files with only docstrings/`pass`).

### 17.5 Tooling

- Use `pytest` + a lightweight import-graph checker (e.g., `import-linter` or a custom AST-based test) to enforce the above.
- Add `import-linter` to dev dependencies and define contracts in `pyproject.toml`.

---

## 18. ADR Audit

### 18.1 ADR inventory (25 total, all "Accepted")

| ADR | Topic | Core relevance |
|-----|-------|----------------|
| 0001 | Repository structure | Modular monorepo |
| 0002 | Layered architecture | **Core layering** |
| 0003 | Service & Selector pattern | **Core services/selectors** |
| 0004 | Domain-Driven Design | **Core = shared kernel** |
| 0005 | Event-driven architecture | **Core events** |
| 0006 | PostgreSQL primary DB | infra |
| 0007 | Celery & Redis | infra |
| 0008 | API design principles | **Core API** |
| 0009 | Auth & authorization | identity |
| 0010 | Multi-tenant organization model | organization |
| 0011 | Audit logging strategy | **Core AuditModel** |
| 0012 | File & asset storage | assets |
| 0013 | UUID primary keys | **Core UUIDModel** |
| 0014 | Soft delete strategy | **Core SoftDeleteModel** |
| 0015 | Caching strategy | **Core CacheService** |
| 0016 | Validation architecture | **Core validators** |
| 0017 | Permission & authorization model | **Core permissions** |
| 0018 | Event bus architecture | **Core events** |
| 0019 | API versioning strategy | **Core API** |
| 0020 | Exception handling strategy | **Core exceptions** |
| 0021 | Configuration & settings | infra |
| 0022 | Logging & observability | **Core logging** |
| 0023 | Search & indexing | **Core search** |
| 0024 | Notification architecture | **Core events/notifications** |
| 0025 | Intelligent automation | automation |

### 18.2 ADR vs. implementation gaps

- **ADR-0002/0004** (layering, shared kernel): violated by domain leakage and the Core→identity import.
- **ADR-0018** (event bus): framework exists, but the `Event` import bug shows inconsistent application.
- **ADR-0016** (validation): validator layer exists; `validators/asset.py` and `shot.py` are empty placeholders.
- **ADR-0023** (search): `SearchService` and `SearchFilterMixin` exist but are minimal; `models/querysets/search.py` is empty.
- **ADR-0024** (notifications): `NotificationService` exists but is minimal; `events/mixins/notification.py` is empty.
- **ADR-0025** (automation): no implementation yet (planned app).

### 18.3 Missing ADRs

- No ADR documents the **Core module boundary / shared-kernel contract** explicitly. Recommend a new ADR (e.g., ADR-0026 "Core Module Boundary") codifying what belongs in Core and the dependency rule.

---

## 19. KEEP / MOVE / MERGE / REMOVE Matrix

| Item | Verdict | Action |
|------|---------|--------|
| `api/` (builders, exceptions, pagination, renderers, serializers, utils, viewsets) | **KEEP** | Remove empty `api/filters/`, `api/views/` scaffolding; move domain permissions/exceptions |
| `api/viewsets/base.py` | **KEEP (fix)** | Remove `HasPermission` import from identity |
| `api/permissions/organization.py`, `project.py`, `reviewer.py` | **MOVE** | To organization/production/review |
| `api/exceptions/permissions.py` (org/project exceptions) | **MOVE** | To organization/production |
| `choices/` (generic) | **KEEP** | — |
| `choices/department.py` | **MOVE** | To production |
| `context/` | **REMOVE** | Empty |
| `dates/` | **REMOVE** | Empty |
| `events/` | **KEEP** | Remove `signals.py`, `mixins/`; fix `Event` import |
| `filesystem/` | **REMOVE** | Empty |
| `filters/` (generic) | **KEEP** | — |
| `filters/organization.py` | **MOVE** | To organization |
| `i18n/` | **KEEP** | — |
| `logging/` | **KEEP** | — |
| `managers/` | **KEEP** | Move `OrganizationManager` to organization |
| `middleware/` (generic) | **KEEP** | Remove `request_context.py` |
| `middleware/organization.py` | **MOVE** | To organization |
| `models/bases/` (generic) | **KEEP** | — |
| `models/bases/ownership.py`, `scopes.py`, `organization.py`, `project.py`, `user.py` | **MOVE** | To owning apps |
| `models/querysets/organization.py` + mixins | **MOVE** | To organization |
| `models/querysets/mixins/project.py`, `ownership.py`, `search.py` | **REMOVE** | Empty |
| `security/` | **REMOVE** | Empty |
| `selectors/` | **KEEP** | Remove empty `mixins/` |
| `services/` | **KEEP** | Consider splitting `BusinessService` |
| `text/` | **REMOVE** | Empty |
| `utils/` | **KEEP** | **Fix `uuid.py` Python 2 syntax** |
| `validators/` | **KEEP** | Remove empty `asset.py`, `shot.py` |
| `core/__init__.py`, `constants.py` | **REMOVE** | Empty |
| `application/`, `domain/`, `persistence/` (proposed) | **REJECT** | Over-engineering; contradicts ADR-0004 |

---

## 20. Safe Refactoring Sequence (for later stages)

Ordered to minimize breakage and keep the public API stable:

1. **Fix bugs first (no structural change):**
   - Fix `utils/uuid.py` Python 2 syntax error.
   - Fix `identity/events/mfa.py` `Event` → `DomainEvent` import.
2. **Add architecture tests** (Section 17) to lock the boundary before moving code.
3. **Remove dead scaffolding** (empty dirs: context, security, text, dates, filesystem, api/filters, api/views, empty mixins, empty validators, empty queryset mixins, events/signals, events/mixins, core/__init__, core/constants).
4. **Move domain-leaked code to owning apps** (scopes, ownership, organization/project/user entity models, organization queryset/manager, department choice, organization filter/middleware, domain permissions, domain exceptions). Use compatibility re-exports in Core temporarily if needed.
5. **Resolve the Core→identity dependency** in `viewsets/base.py` (inject permission class rather than import).
6. **Split `BusinessService`** if warranted.
7. **Write unit tests** for Core foundations (models, services, selectors, events, validators, api) as the code stabilizes.
8. **Add ADR-0026 "Core Module Boundary"** documenting the shared-kernel contract and dependency rule.

---

## 21. Critical Findings Summary

1. **`.roo/rules/` is empty of architecture rules** — only the Hindsight memory rule exists. No enforcement of the Core boundary.
2. **Core→identity dependency violation** in `api/viewsets/base.py` (imports `HasPermission`).
3. **Broken import:** `identity/events/mfa.py` imports non-existent `Event` from `apps.core.events` (latent ImportError in MFA services).
4. **Python 2 syntax error** in `utils/uuid.py:38` (`except ValueError, TypeError:`).
5. **Extensive domain leakage** in Core: scopes, ownership, organization/project/user entity models, VFX department choice, organization filter/middleware, domain permissions/exceptions.
6. **Large amount of empty/dead scaffolding** (context, security, text, dates, filesystem, api/filters, api/views, empty mixins/validators/querysets).
7. **Zero tests exist** despite fully configured pytest infrastructure — no safety net for refactoring.
8. **Proposed `application/domain/persistence` target structure is over-engineered** and contradicts ADR-0004; the existing ADR-0002/0003 layering is sufficient.
9. **237 public imports** of `apps.core` — the public API surface (Section 15.4) must be treated as stable contracts.
10. **ADR-0002/0004 are violated** by the current structure; a new ADR-0026 should codify the Core boundary.

---

## 22. Recommended Part 02

**Part 02: Core Boundary Enforcement & Bug Fixes (safe, non-structural)**

1. Fix the two bugs (uuid.py syntax, mfa.py Event import).
2. Add architecture tests (dependency direction, domain leakage, public API stability, empty-scaffolding).
3. Remove all dead scaffolding.
4. Move domain-leaked code to owning apps with compatibility re-exports.
5. Resolve the Core→identity dependency in `viewsets/base.py`.
6. Add ADR-0026 "Core Module Boundary".
7. Begin writing unit tests for Core foundations.

This sequence is safe because it fixes bugs and removes dead code first, locks the boundary with tests, then moves domain code with compatibility shims — all without changing the public API contracts that 237 imports depend on.
