Core Cross-Cutting Infrastructure Audit and Refactor Plan

Scope
-----
This document covers apps/core cross-cutting modules:
- context
- middleware
- logging
- security
- filesystem
- dates
- i18n
- text
- utils
- validators
- choices
- constants
- protocols
- types

Goals
-----
- Ensure Core provides platform-generic, stable, and domain-agnostic infrastructure.
- Avoid global mutable state; prefer ContextVar for request-scoped context.
- Consolidate duplicate utilities and centralize logging with request/user/org context.
- Provide abstractions (protocols) for storage and other infra to invert dependencies.
- Keep middleware focused: request-id, request-context, locale, timezone, maintenance.

Summary of concrete changes applied
-----------------------------------
1. Centralized logging factory
   - Implemented context-aware LoggerAdapter in apps/core/logging/logger.py.
   - apps/core/utils/logger.get_logger now delegates to the centralized factory to preserve compatibility.
   - Adapter injects request_id, organization and user into the record.extra payload via ContextVars in apps.core.logging.context.

Planned further changes (staged)
------------------------------
- Replace ad-hoc hashing helpers with a single security.hashing module exposing stable functions.
- Introduce a storage.Protocol in apps.core.protocols.storage and provide a local filesystem implementation in apps.core.filesystem.storage; update injection points in services that interact with storage.
- Audit validators and choices for domain leakage. Move domain-specific validators (asset/shot/sequence) to their respective apps, leaving generic validators (email, url, uuid) in core.
- Ensure middleware does not perform identity or org resolution beyond extracting headers; move heavy logic to identity/organization apps.
- Consolidate datetime/timezone helpers and ensure timezone-aware operations use Django utilities where possible.

Risk assessment
---------------
- Logging changes are backward-compatible: get_logger API preserved and behavior improved.
- Storage protocol introduction requires updating callers; staged migration with compatibility shims required.

Migration order
---------------
1. Centralize logging (done)
2. Introduce storage protocols and adapters (small refactors)
3. Move domain validators and choices (preserve compatibility via re-exports)
4. Thin middleware and move heavy logic to domain apps
5. Run full test-suite and address regressions

Testing
-------
- Added unit tests to assert logging factory shape and basic behavior.
- Run core tests and full backend tests after each refactor stage.

Notes
-----
- No database migrations are required for these refactors unless model/schema changes are proposed later.
- Some files in apps/core currently contain domain-scoped helpers; they will be flagged for migration in a subsequent stage.
