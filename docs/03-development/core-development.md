Core Development — Guidelines for contributors

Purpose
-------
Provide pragmatic guidance for engineers contributing to apps/core. Core
is the shared kernel — changes must be conservative, backward-compatible,
and well-documented.

When to change Core
-------------------
- Add features that are genuinely reusable across domain apps.
- Provide infrastructure that enables platform concerns (logging,
  storage, events, API foundations).
- Fix bugs or omissions in existing Core primitives.

When NOT to change Core
----------------------
- Implement domain-specific business logic (project, shot, asset, task).
- Add models that represent business entities — they belong in domain apps.
- Make breaking API changes without a compatibility plan and deprecation
  period.

Pull request rules
------------------
- Keep changes small and focused.
- Add tests that exercise the public surface (unit + integration where
  appropriate).
- Update documentation (docs/*) for architectural guidance and public
  API changes.
- Add a CHANGELOG entry and a short migration note if the change impacts
  downstream apps.

Schema and migrations
---------------------
- Avoid creating migrations unless a real schema change is required.
- If a migration is necessary, validate it with local DB and CI runs.

Testing
-------
- Run Core tests locally before opening a PR.
- CI must run the Core test matrix (unit + DB-backed tests) on Python 3.10+.

Dependency rule enforcement
---------------------------
- Core must not import business application modules (see
  docs/architecture/dependency-rules.md).
- Add CI checks that fail the build if a production file in apps/core
  imports other apps.<app> modules. Test-only imports are allowed with a
  clear justification.

Release and deprecation
-----------------------
- Deprecate public APIs rather than removing them. Provide a compatibility
  shim that warns at import time for at least one release.
- Document migration steps for downstream apps and update references.

Common tasks
------------
- Adding a new mixin: implement, add unit tests, document its public
  contract in docs/02-architecture/model-foundations.md.
- Adding a storage backend: implement a Protocol in apps.core.protocols,
  add a local adapter in apps.core.filesystem, and register it with the
  service layer via configuration.

Contact & governance
--------------------
- Core maintainers: platform team (list maintainers in the repo README).
- For architecture decisions, open an ADR and discuss in the platform
  design channel before implementing large changes.
