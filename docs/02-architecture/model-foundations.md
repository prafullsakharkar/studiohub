Model Foundations — Core

Purpose
-------
Document the small, composable model primitives Core provides and the
recommended composition patterns for domain applications.

Guiding rules
-------------
- Prefer composition over a single monolithic BaseModel.
- Keep model mixins generic and free of domain logic.
- Avoid adding capabilities that represent business concepts (Project,
  Shot, Sequence, Task, Review, Asset).
- Ensure mixins are independently testable and documented.

Foundational mixins
-------------------
Core exposes a set of small, well-scoped mixins. New domain models should
compose the ones they need rather than inheriting a large monolithic base.

- UUIDModel
  - Provides a stable UUID primary key alias (``uuid``) mapping to the
    underlying ``id`` field when appropriate.

- TimeStampedModel
  - Adds ``created_at`` and ``updated_at`` automatic timestamps.

- SoftDeleteModel
  - Soft delete flag (``is_deleted``) and helper methods. Querysets provide
    ``alive()`` and ``deleted()`` filters.

- AuditModel
  - Lightweight audit fields (``created_by``, ``updated_by``) and helpers.

- MetadataModel
  - JSON metadata storage with validation hooks.

- Ownership mixins
  - Generic ownership abstractions (OwnerForeignKey, OrganizationForeignKey)
    but not domain-specific ownership semantics.

BaseModel (Deprecated convenience aggregate)
-------------------------------------------
- BaseModel exists for backwards compatibility and aggregates common mixins.
- New code should prefer explicit composition.
- Core emits an import-time FutureWarning to encourage migration.

QuerySet & Manager composition
-----------------------------
- QuerySet mixins represent query responsibilities: filtering, ordering,
  lifecycle, publish state, organization scope, search.
- Managers are thin facades that delegate to QuerySet methods via
  ``Manager.from_queryset`` and expose convenience manager APIs only.

Migration guidance for domain-scoped models
------------------------------------------
- If a model or mixin contains domain-specific logic (project, shot, task,
  vendor, client), move it to the appropriate domain app and re-export a
  compatibility shim from Core with a deprecation warning.

Testing
-------
- Unit tests for each mixin (timestamps, uuid behavior, soft-delete
  lifecycle, metadata validation) live in backend/apps/core/tests and are
  run as part of the Core test suite.

Examples
--------
A recommended domain model composition:

    class ProjectModel(UUIDModel, TimeStampedModel, SoftDeleteModel, models.Model):
        name = models.CharField(max_length=255)
        # domain-specific fields here (but defined in a domain app)

Notes
-----
- Do not change database schemas as part of this refactor unless a
  deliberate migration is required and approved.
- Preserve public manager and queryset APIs when refactoring for
  compatibility.
