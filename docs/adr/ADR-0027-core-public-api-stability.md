ADR-0027: Core Public API Stability

Status: Proposed

Context
-------
The Core package (apps/core) is the shared kernel for the StudioHub
platform. Many domain applications depend on Core's public API surface.
Stability of that surface is critical to avoid frequent breaking changes
across the monolith.

Decision
--------
- Treat apps/core public modules as a stable API with a deprecation policy.
- Changes that remove or rename public symbols must follow a deprecation
  sequence:
  1. Introduce the new API and provide shims that keep the original import
     path intact, emitting a DeprecationWarning at import time.
  2. Keep the shim for at least one minor release and document the
     migration path in CHANGELOG/docs.
  3. Remove the shim in a later release after consumers have migrated.

- Public API is defined as modules and symbols imported by at least one
  non-test production module outside apps/core (detected via repository
  search during audits and CI).

- Minor/backwards-compatible additions (new functions, optional args) do
  not require a deprecation shim.

Consequences
------------
- Developers must add CHANGELOG entries and update docs when making public
  API changes.
- CI will enforce detection of public API removals via an architecture
  test that scans for changes to public symbols.

Rationale
---------
This policy balances maintainability of the shared kernel with the
need to evolve Core. It reduces breakage and provides a clear upgrade
path for dependent applications.
