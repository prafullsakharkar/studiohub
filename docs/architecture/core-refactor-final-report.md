Core Refactoring Final Report

Date: 2026-08-18
Author: Copilot CLI (AI assistant using Copilot CLI runtime in VS Code)

Executive summary
-----------------
This report consolidates the multi-stage Core refactor work (Parts 01–10).
The goal was to stabilize apps/core as the stable, domain-agnostic shared
kernel for the StudioHub platform. The refactor was careful, compatibility
first, and focused on removing domain leakage, consolidating infra, and
providing clear migration guidance.

Before architecture (short)
---------------------------
- Core contained a broad set of primitives but also domain-scoped
  abstractions (Sequence/Shot/Task/Review/Project) and duplicated utilities.
- Dependency direction was intended to be domain -> core but some domain
  concepts lived in Core, causing subtle coupling.

After architecture (short)
--------------------------
- Core now documents and enforces dependency rules (docs/architecture/dependency-rules.md).
- Centralized logging and context infrastructure; added ContextVar-based
  logging adapter to provide request/user/org context.
- Introduced meta-level and DB-backed tests for model foundation, soft-delete,
  event bus transaction semantics, selectors/services shape, and logging factory.
- Marked domain-scoped bases as deprecated with FutureWarning for staged
  migration.

Files added
-----------
- docs/02-architecture/core-architecture.md
- docs/02-architecture/model-foundations.md
- docs/core.md (added earlier)
- docs/03-development/core-development.md
- docs/architecture/core-cross-cutting.md
- docs/architecture/core-refactor-final-report.md (this file)
- docs/adr/ADR-0027-core-public-api-stability.md
- backend/apps/core/tests/test_api_foundation.py
- backend/apps/core/tests/test_logging_context.py

Files moved
-----------
- None in this stage. All moves are planned and will be performed in
  dedicated migration PRs with compatibility shims.

Files merged
------------
- None; consolidated behavior in code (utils logger now delegates) but no
  file merges performed.

Files removed
-------------
- None.

Domain code moved
-----------------
- None moved yet. Domain-scoped items (Sequence, Shot, Task, Review) were
  flagged for migration and marked with FutureWarning where appropriate.

Dependencies fixed
------------------
- Performed repository scan and validated that production code under
  apps/core contains no imports of business applications (Core → Domain = 0).
  Test-only cross-app imports remain and are documented.

API changes
-----------
- get_logger API preserved; apps.core.utils.logger.get_logger delegates to
  apps.core.logging.logger.get_logger (compat shim).
- ResponseBuilder remains the canonical response builder (no public
  API removal performed).

Model changes
-------------
- No schema or migration changes performed. BaseModel deprecation warnings
  were added to encourage composition. New mixins exist conceptually and
  are documented; code changes are incremental and non-schema-impacting.

Service changes
---------------
- Services were audited; soft delete and event services adjusted to ensure
  consistent hook behavior (e.g., after_delete returns the instance).

Selector changes
----------------
- Selectors verified to be read-only by design; meta tests ensure selector
  classes conform to expected shape.

Event changes
-------------
- EventBus.publish now defers dispatch via django.db.transaction.on_commit
  when inside a transaction to provide transaction-safe event dispatch.
- Event infrastructure remains in Core; domain applications own domain
  events and handlers.

Infrastructure changes
----------------------
- Centralized logging factory: ContextLoggerAdapter added to provide
  structured logging with request_id, organization, and user injected from
  ContextVars.
- Delegated legacy utils.get_logger to the centralized logging factory.

Tests
-----
- Added meta-level tests and DB-backed tests for core foundational flows.
- Test run in this environment aborted due to Python 3.9 vs repository
  requiring Python 3.10+. Full test pass is pending CI validation.

Migrations
----------
- None created.

Documentation
-------------
Files created/updated:
- docs/02-architecture/core-architecture.md
- docs/02-architecture/model-foundations.md
- docs/02-architecture/service-layer.md (existing; reviewed)
- docs/02-architecture/selector-pattern.md (existing; reviewed)
- docs/02-architecture/event-system.md (existing; reviewed)
- docs/architecture/dependency-rules.md (created earlier)
- docs/03-development/core-development.md
- docs/core.md
- docs/architecture/core-cross-cutting.md
- docs/architecture/core-refactor-analysis.md (updated with final validation)
- docs/architecture/core-refactor-final-report.md (this file)

ADRs
----
- Existing ADRs were verified (ADR-0026 core boundary, ADR-0018 event bus,
  ADR-0003 service-selector). A new ADR was added:
  - ADR-0027 Core Public API Stability

Remaining technical debt
------------------------
- Migrate domain-scoped bases (Sequence/Shot/Task/Review/Project) to domain
  apps with deprecation shims.
- Implement storage Protocol and adapters, then update callers to use
  dependency injection / protocol-based adapters.
- Decide and implement EventDispatcher error-handling policy (fail-fast vs
  resilient). Add tests to validate behavior.
- Add CI enforcement for Core → Domain import rule and public API stability
  checks.
- Remove placeholder/unused mixins and consolidate duplicate utilities after
  usage trace confirms safety.

Recommended next StudioHub development stage
-------------------------------------------
1. Run full test suite in CI (Python 3.10+) and remediate test failures.
2. Implement storage protocol and local adapter; migrate services to accept
   an injected backend.
3. Start staged migration of domain-scoped model bases to a new domain app
   (apps/production or apps/project) using compatibility shims.
4. Add CI checks for Core import rules and public API diffs.
5. Decide event dispatch error policy and implement it with tests.

Final validation status
-----------------------
- Dependency boundaries: validated for production code (Core → Domain = 0).
- Documentation: updated across architecture and development docs.
- Tests: added, but full test run is pending due to environment runtime
  mismatch. Do not declare final production readiness until CI confirms
  green tests.

Acknowledgements
----------------
This refactor was performed in stages with a focus on compatibility. The
report and changes include recommendations and staged migration plans to
preserve stability across the platform.
