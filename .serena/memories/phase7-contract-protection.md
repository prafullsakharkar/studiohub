# Phase 7 Contract Protection (2026-09-13)

## Backend tests (all passing, ruff clean)
- Extended `apps/core/tests/test_contract.py` OpenAPI gate: path->methods table
  (~100 entries: auth, production CRUD+bulk/actions, deliveries, publishing,
  scheduling, settings, audit, intelligence, masterdata, nested org actions,
  legacy aliases). Asserts >500 paths. Fixed SIM118 in passing.
- New `apps/core/tests/test_contract_regression.py` (19 tests): wrong-method 405s,
  list/detail field+type shapes (project/shot/team/org/membership/knowledge),
  paginated-vs-RAW[] envelopes, 401/404/400/cross-org error envelopes,
  seed-matrix coverage of every enforced permission_map code, shot search/ordering.
  Org header attached via `_scoped` (credentials pattern, not **kwargs, to keep
  strict editors quiet; repo precedent uses **headers with same noise class).
- Full backend suite: 1869 passed, 1 skipped.

## Frontend tests + policy
- New `src/test/contract/apiContractConformance.test.ts` (8 tests, MSW-backed):
  DRF paginated envelope (shots), bare arrays (nested teams), fixture required
  fields (teams id/code/department/organization inputs; shots id/code),
  {detail} 404, errorMapper 404/403/500 preservation.
- New `docs/frontend/MOCK_POLICY.md`: mocks = dev/test fixtures only;
  rest-mode is the production source; conformance rules.
- Full frontend: lint clean, 179/179 tests, build clean.

## Docs (studiohub/docs/api)
- REAL_API.md: knowledge/search membership gate, seed org-domain RBAC grants,
  membership hydration note.
- API_MIGRATION_MATRIX.md: new §11 Phase 7 section.
- MOCK_TO_REAL_MIGRATION.md: mock-policy section.
- Phase 6 findings already in REAL_API_GAPS.md.

## CI
- studiohub/.github/workflows/ci.yml: removed stale frontend job (dir `frontend/`
  does not exist in this repo — could never pass); added `makemigrations --check`.
  Backend pytest already runs all contract tests via testpaths=apps.
- New studiohub-react/.github/workflows/ci.yml: pnpm lint + test + build
  (--no-frozen-lockfile: repo has bun.lock, no pnpm-lock.yaml).
- Both YAMLs validated. Recommended cadence: existing triggers (push/PR) suffice;
  no new scheduled jobs needed.

## Verification of the gates
- Negative check: temp copy of surface test with renamed path + extra method ->
  fails with clear "Missing contract endpoints" message (copy removed afterwards).
- Pre-existing debt untouched: seed_dev.py 16 ruff findings (newer-ruff style vs
  old code, HEAD has same blocks), strict-editor LSP noise (repo basedpyright is
  arbiter; CI runs ruff+pytest only).

## Open (unchanged, documented)
- Person->User lead mapping; Show epic; analytics KPIs; AI/LLM+trigram (stubs).
- PermissionRoute deny-path not exercised live; shot-card bulk affordance UI gap.
