StudioHub — Dependency Rules (Core & Domain)

Purpose
-------
Define the canonical dependency direction and acceptable exceptions for the StudioHub codebase, with a focus on the shared kernel (apps/core).

Primary rule
------------
- Dependency direction must be:

    Domain Application
           ↓
         Core

- Core MUST NOT import or depend on any business application code. Business apps include (but are not limited to):
  - identity
  - organization
  - production
  - assets
  - reviews
  - workflow
  - analytics
  - reports
  - billing
  - notification
  - ai

- Core may depend on third-party libraries (Django, DRF, Celery, Redis clients, etc.).

Rationale
---------
Keeping Core domain-agnostic makes it a stable shared kernel that can evolve independently of feature apps. Domain apps implement business logic and depend on Core primitives.

Allowed exceptions
------------------
- Tests in Core may import fixtures or factories from other apps to exercise integration behavior. These imports must be limited to tests and not used by production code.
- Documentation or examples in Core may reference domain concepts for clarity, but must not create runtime import dependencies.

Migration guidance
------------------
- If Core contains domain-specific classes (e.g., SequenceScopedModel, ShotScopedModel, TaskScopedModel, ReviewScopedModel, ProjectScopedModel), migrate them to an appropriate domain app (e.g., apps/production) and replace the Core symbols with thin compatibility shims that re-export the domain symbols and emit a deprecation warning.
- Replace direct imports of domain functionality in Core with one of:
  - Protocols defined in Core (dependency inversion): domain apps implement these protocols and Core programs against the protocol interface.
  - Event publishing: Core emits events and domain apps subscribe. For cross-domain notifications, prefer event-driven communication.
  - Adapters passed via configuration: allow domain apps to register adapters with Core at startup (e.g., via AppConfig.ready hooks) without importing domain modules from Core.

Enforcement
-----------
- Add automated checks in CI to fail if any module in `apps/core` imports `apps.<non-core>` production modules. Use ripgrep or AST analysis in a dedicated architecture test.
- When migrating symbols, keep deprecation shims for at least one release and document changes in CHANGELOG.

Example patterns
----------------
Good (Core defines protocol; domain app implements):

    # apps/core/protocols.py
    class HasMembers(Protocol):
        members: models.Manager

    # apps/core/api/permissions/some.py
    def is_member(obj: HasMembers, user):
        return obj.members.filter(pk=user.pk).exists()

  Domain app defines the concrete project model with `members` manager.

Event-driven approach example:

    # apps/core/events.py
    class ProjectMemberRemoved(DomainEvent):
        project_id: UUID
        user_id: UUID

    # apps/production/listener.py
    @subscribe(ProjectMemberRemoved)
    def on_removed(event):
        # domain logic here

CI rule (recommended):

    # pseudo
    for file in git_ls_files('backend/apps/core'):
        if import_path_in_file(file) matches r"from apps\.(?!core)":
            fail('Core imports domain app: ' + path)

Change log
----------
- 2026-08-18: Initial dependency rules added. Enforced by architectural audit (docs/architecture/core-refactor-analysis.md).
