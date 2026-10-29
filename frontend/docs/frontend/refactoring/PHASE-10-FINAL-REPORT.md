# Phase 10 — Final Regression Report (2026-09-23, HEAD `2677643`+)

Base for all comparisons: `7105387` (v2.5.1, pre-engagement). 20 commits audited.
Nothing is claimed below without a passing gate behind it; gaps are stated, not hidden.

## Build (all green — completion gate satisfied)

| Command | Result |
|---|---|
| `pnpm lint` (`tsc --noEmit`) | PASS, 0 errors |
| `pnpm typecheck` (`tsc --noEmit`) | PASS, 0 errors |
| `pnpm test` (`vitest run`) | **56 files, 377/377 PASS** |
| `pnpm build` (`vite + esbuild`) | PASS, fresh `dist/` (only pre-existing chunk-size warning) |

## Files before / after

- Tracked TS/TSX: **880 → 865 (−15 net)**; total diff: **+3064 / −3766 (net −702 lines)**.
- Files removed (28): 5 dead repository classes, 6 duplicated interfaces, 3 T0 dead
  files, 2 consolidated pages, 12 Phase-09 verified-unreferenced files.
- Files created (13): 3 audit workspace shells, `PreserveQueryRedirect`,
  `useBulkEntity`, 7 test files, 1 Playwright scaffold.
- Phases 01–09 docs: 8 reports under `docs/frontend/refactoring/` + consolidation docs.

## What was consolidated

- Duplicate functionality removed: repository interfaces + dead classes (11),
  RBAC triple-entry → single `/access`, audit 8 pages → 3 workspaces,
  Settings → Platform Admin, health/scheduling aliases, bulk twins → generic hook.
- Canonical components created: `useBulkEntity`, `PreserveQueryRedirect`,
  `TabRedirect`, audit shells (all TDD-tested).
- Canonical pages created: `Audit/SystemLogs/JobsWorkspacePage`.
- Routes consolidated: 0 duplicate paths; 19 legacy aliases redirect with state.
- RBAC consolidated: single entry, `can()` throughout, org-mismatch deny,
  settings-scoped admin access (additive only). Remaining role-name checks are
  bootstrap/display-level (`OrganizationContext`, switchers, `Header`) — tracked debt.
- API architecture: single interface home, factory adapters, DRF envelope +
  error normalization identical in mock/rest. Mock/REST parity: contract suite
  green; 7 cross-path items need backend coordination (Phase 07).

## Test results by area (all from the automated suite)

- Frontend flows (org/project/show switching, workspaces, CRUD, bulk, search,
  filters, pagination, errors, notifications): organization journey/integration/
  CRUD/bulk/forms/errors suites green; dashboard + onboarding suites green.
- RBAC (roles, unauthorized org/project/action, isolation): `EntityRbacIsolation`,
  `OrganizationRbacUi`, `LayeredAuthorizationModel`, `TenantIsolation`,
  `QueryKeysAndIsolation`, `rbacCanonical` green.
- API (mock/rest adapters, 401/403/404/422/500/network/timeout simulation):
  `OrganizationMswHttpErrors`, `MockAndRestMode`, `ApiParity`, TestingPage engine
  suites green. Note: vitest forces mock mode; REST-against-live-backend is not
  exercisable in this environment.
- Audit/activity: `AuditConsolidation`, `OrganizationActivityAndNotifications`,
  audit workspace tests green; Phase-06 store-sync fix covered by suite.
- Architecture searches: 0 duplicate paths/routes-targets, 0 orphan pages (73/73),
  0 dead barrel exports, 0 live-code regressions from deletions.
- Known findings kept open (not failures): 52 import cycles (mostly barrel-mediated,
  ESM-safe, build+tests green — needs barrel discipline, not emergency rewiring);
  `entityRegistry` fork + mock triple-path + dual test trees (documented T2/T3).

## NOT completed (stated plainly)

- **Playwright E2E**: no harness exists in the repo (no config, no deps, no browsers
  in this environment); only `e2e/consolidation.spec.ts` scaffold was added.
  "Complete E2E coverage" cannot be claimed — it requires installing
  `@playwright/test` + browsers + a running app (mock and rest).
- **Live-backend REST verification**: impossible here; REST parity rests on
  adapter unit tests + contract suite, pending backend coordination (Phase 07 list).
- **300-file reduction**: reachable-code analysis proves 852+ files live; 15 net
  removed with correctness intact. The 300 target needs product-scope decisions,
  itemized as follow-ups.

## Remaining technical debt (prioritized)

1. E2E harness + live-backend REST pass (biggest verification gap).
2. Mock triple-path convergence per domain (needs path-ownership decision).
3. `entityRegistry` unification (contract-first), dual test-tree merge.
4. CRUD kit adoption beyond the `ApiRequestsPage` pilot (or kit removal).
5. Barrel-discipline cleanup for the 52 import cycles; centralize superuser bypasses.
6. Deferred minors: pipeline Save double-toast; pre-guard org-mismatch fetch.
7. `ProjectWorkspacePage` hardcoded-org fallback → in-page deny hardening.

## Goal scorecard

- LESS CODE: yes (−702 net lines, −15 files, −1,188 T0 lines).
- FEWER DUPLICATES: yes (interfaces, RBAC entries, audit pages, bulk, tables-kit bugs).
- ONE CANONICAL IMPLEMENTATION: yes per area (Phases 03–04 map), pilots gated.
- CLEAR USER NAVIGATION: yes (31 canonical entries, 0 dead links, redirects preserve state).
- STRONG RBAC: yes (suite-proven isolation; residual role-name checks listed).
- MOCK/REST PARITY: contract-green; cross-path + backend items explicitly open.
- NO FUNCTIONAL REGRESSION: yes — 377/377 + tsc + lint + build green on final tree.
