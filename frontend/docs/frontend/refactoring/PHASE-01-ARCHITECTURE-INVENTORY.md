# Phase 01 — Architecture & Dependency Inventory (read-only)

Date: 2026-09-23. Branch: `main` @ `07d0e78` (post v2.6.0 consolidation).
Rule for this phase: **no file was modified or deleted**. All verdicts below were
derived from static import analysis (`from '…'`), route tables, registries,
 barrel exports, test imports, and config — never from assumption.
A file is marked *potentially unused* only after checking: direct importers,
barrel re-exports, `<Route>`/redirect tables, `routePermissionsRegistry`,
`permissionCatalog`, `entityConfig`, MSW/mock wiring, `App`/`main` bootstrap,
tests, scripts, and docs references.

> Graph caveat: the `code-review-graph` index for this repo covers the Python
> backend (Django managers/serializers/viewsets — 15 communities, all Python)
> plus JS; it does **not** model TSX components. The frontend inventory below
> is therefore built from direct source inspection, which is authoritative here.

Scale: **879 TS/TSX files, ~275k LOC** (incl. 67k generated OpenAPI).
`src/modules` 445 · `src/shared` 108 · `src/core` 71 · `src/mocks` 68 ·
`src/features` 49 · `src/api` 39 · `src/types` 32 · `src/__tests__` 25 ·
`src/routes` 12 · `src/pages` 9 · `src/components` 8 · `src/layouts` 7.

---

## 1. Architecture map

```
main.tsx → mocks/browser (MSW) + mocks/db init + api/repositories/config
  → App.tsx → [ErrorBoundary → QueryProvider → ThemeProvider → AuthProvider
      → OrganizationProvider → BrowserRouter → GlobalApiStatus + AppRoutes + ToastContainer]
  → routes/AppRoutes.tsx (+ platformRoutes, auditRoutes fragments)
  → layouts/AppLayout (Sidebar/Header/Breadcrumbs/Switchers)
  → modules/*/pages (+ features/dashboard, pages/TestingPage)
```

Provider chain (all in `src/providers` + `src/core`): `QueryProvider`
(TanStack), `ThemeProvider`, `AuthProvider` (`core/auth`), `OrganizationProvider`
(`core/organization`). No `React.lazy` anywhere — **zero route-level code
splitting** (bundle `index-*.js` ≈ 5 MB, gzip ≈ 1 MB).

Data layer (three parallel mock paths + one interface family):

```
hooks (useQuery, 47 files, 46 consumer files)
  → modules/*/services (18 *Service.ts, thin pass-through to repository)
    → modules/*/repositories (concrete, extend core/repository/BaseRepository)
      → api/repositories/factory → adapters/mock/* | adapters/rest/* (8 domains)
ApiClient (31 importers) → mocks/mockRouter.ts (6.7k lines) + masterDataMockRouter
MSW worker (mocks/browser) → mocks/handlers/* (16 files) → mocks/db/*
```

Auth/RBAC layering: `modules/auth` (boundary, 56 importers) → `core/auth`
(context, `useCurrentUser` 22 importers) → `core/permissions` (registry,
catalog, systemRoles, **4 engines**: bulk/resource/field/scope + workflow +
external-access) → `core/organization` (64 importers) + `core/production`
context. Three permission-evaluation APIs coexist: `usePermissionEvaluator`
(9 consumers), `core/permissions/usePermissions` (5), `shared/stores/usePermissionStore` (1).

---

## 2. Module map (responsibility · key files · consumers · verdict)

### Platform (`src/modules/platform`, 28 files) — CANONICAL (post-2.6.0)

`PlatformAdminPage` (11 tabs incl. pipeline/theme/layout/database),
`ApiHealthPage → ApiHealthDashboard` (live telemetry), `DataPlatformPage`
(7-view explorer), `NotificationsPage`. Consumed by `platformRoutes`,
`Sidebar`, tests. Verdict: canonical. Note `useApiHealth` polling lives only here.

### Organization (`src/modules/organization`, 88 files — largest domain)

Pages, workspaces, tabs, hooks, services, repositories for orgs, clients,
vendors, people, departments, teams, offices + master-data tabs. 38 external
importers. Verdict: canonical domain, but oversized — master-data tabs overlap
`platform/admin/masterData` (OrgSoftwareConfig ≈ PlatformSoftwareTab etc.).

### Access/RBAC (`src/modules/access`, 12 files) — CANONICAL

`AccessWorkspacePage` (8 tabs) + 8 section components + `RoleEditorModal`,
org-mismatch guard intact. Verdict: canonical org/platform RBAC entry.

### Production (`src/modules/production`, 38) · Shots (24) · Assets (31) ·
Tasks (30) · Versions (15) · Reviews (23) · Deliveries (12) · Publishing (10) ·
Workflows (16) · Scheduling (17) · Sequences (6) · Playlists (6) · Media (4) ·
Attachments (4)

Each: pages + workspace + tabs + hooks + services + repositories. Verdict:
canonical per-entity verticals. Recurring internal duplication: per-entity
`<table>` markup (~15 ad-hoc tables), bulk hooks (`useBulkAssets/Shots/Tasks`),
overview/activity/notes tabs per workspace.

### Audit (`src/modules/audit`, 17) — CANONICAL (post-2.6.0)

3 shells (`Audit/SystemLogs/JobsWorkspacePage`) over 8 existing pages;
`useAudit*` hooks + `auditServices` unchanged. Verdict: canonical.

### Testing (`src/core/testing` + `src/pages/TestingPage.tsx`, 1.1k lines)

`TestRunnerEngine` (3.4k lines) + suites + parity harness; admin-gated QA
runner. Imports `ApiClient` directly. Verdict: canonical QA runner, **not** API
health — must stay separate (different users/data/lifecycle).

### Workspace (`src/shared/workspace`, 12 + `canonical/`, 6)

`Workspace`, `WorkspaceShell`, `WorkspaceTabs`, `ContextBar/Stack`,
`EntityDrawer/Ref`, `PeekPanel`, search modal; `canonical/` (ActionBar,
Buttons, Header, OverflowMenu, Shell) used by 16+ files. Verdict: canonical
workspace kit. Anomaly: non-canonical `WorkspaceHeader.tsx` has **1 importer**
(`Workspace.tsx`) while `canonical/WorkspaceHeader` has **0** — inverted naming.

### CRUD (`src/shared/crud`, 11) — MOSTLY UNUSED

`EntityList` (1 importer: `DataPlatformPage`), `EntityTable`/`EntityForm` **0
importers**; `CreateDialog/EditDrawer/EntityDetail` used only inside the kit +
`DataPlatformPage`. All 15 entity tables are hand-built per page. Verdict:
kit exists but adoption failed — revive-or-remove decision for Phase 2.

### Shared UI (`src/shared/components`, `src/shared/activity`,
`src/shared/filters`, `src/shared/hooks`, `src/shared/stores` ×9,
`src/shared/views`, `src/shared/relationships`, `src/shared/layouts`)

Healthy: `Button/Card/Modal/Pagination/SearchInput`, `ActivityTimeline`
(3 importers), `useActivityStore` (17), `PageLayout` (**only 2 importers**:
`OrganizationsPage`, `AccessWorkspacePage` — most pages roll their own headers).
`shared/filters` (FilterBuilder/QuickFilterBar) has **1 consumer**
(`ProductionView`); every list page hand-rolls search/filter state (cf.
`TestingPage` 5 filter dimensions inline). `shared/views` (saved views) used
only by `EntityList/Table`. Verdict: canonical kit, low adoption for
filters/views/tables/layout.

### Mock (`src/mocks`, 68) — TRIPLE-ENCODED endpoint logic

`db/*` seeds (mirror `src/types/*` per domain) + `IndexedDB storage` +
`handlers/*` (MSW, with inline auth/project-scope/filter/pagination logic) +
`mockRouter` + `masterDataMockRouter` + `errorScenarios` + `mockAuthGuard`.
Same asset CRUD semantics live in **three** places: `handlers/assetHandlers`,
`adapters/mock/MockAssetAdapter`, `mockRouter`. Verdict: canonical data, but
endpoint behavior is forked ×3 — highest divergence risk in the repo.

### REST (`src/api`, 39)

`ApiClient` (mockRouter-backed) + `repositories/{interfaces,factory,
adapters/mock,adapters/rest}` (8 domains) + `errors/` + `masterDataApi`.
Verdict: canonical interface family. Anomaly: **6 `I*Repository` interfaces
duplicated** verbatim in `api/repositories/interfaces/` ↔ `modules/*/repositories/`
(Asset/Auth/Organization/Project/Shot/Task).

### Auth (`src/modules/auth`, 8) + `src/core/auth` (4)

Boundary + context/provider/storage. Verdict: canonical two-layer split, keep.

### Settings (`src/modules/settings`, 4 → sections only)

Pages deleted in 2.6.0; remaining `ThemeEditor/Layout/DatabaseSchema` sections
exported via boundary, consumed by `PlatformAdminPage`. Verdict: canonical
component library; module shell could dissolve into platform.

### Dashboard — WRAPPER + PARALLEL TREE

`modules/dashboard` (2 files: `DashboardPage` = thin wrapper over
`features/dashboard`) vs `features/dashboard` (full: api/hooks/components/
routes/schemas/types). Verdict: keep wrapper, note `modules/` vs `features/`
duality (see §4).

### Legacy `src/components` (8 files)

`entity/entityConfig.ts` **0 importers**; `system/{ApiErrorState,
GlobalApiStatus, ValidationSummary}` alive (6/1/1+); `permissions/PermissionMatrix`
**0 importers** since 2.6.0 (only deleted pages used it); `ui/{Dialog,Menu,
SmartImg}` — verify vs `shared/components` equivalents before touching.
Verdict: mixed — system components canonical, `entityConfig` + `PermissionMatrix`
candidates for removal/merge.

### Layouts (7) · Routes (12) · Pages (9) · Types (32) · Providers (2)

`AppLayout/Sidebar/Header/Breadcrumbs/Switchers` canonical; `routes/` guards +
`PreserveQueryRedirect` + `TabRedirect` canonical; `pages/` = error pages +
`TestingPage` canonical; `src/types` canonical per-domain (mirrored by mocks).
`src/test/mocks/factories` (org/user factories) = **fourth** fixture source
beside `mocks/db`, MSW, adapters.

### Tests

`src/features/organizations/__tests__` (live tree, imports real pages) vs
`src/__tests__/organizations` (parallel tree incl. duplicate
`OrganizationsPage.test.tsx`) — dual maintenance. `src/__tests__/{audit,
parity,permissions,platform,onboarding}` alive; `src/test/contract`
(API contract conformance, CI-gated) canonical. CI (`ci.yml`): tsc + biome +
vitest coverage floor + build. **No Playwright harness** (no config/deps;
only `e2e/consolidation.spec.ts` scaffold + stale `playwright-report/`).

### Config & docs

`vite/biome/tsconfig/vitest` + `server.ts` + `scripts/` (contract
generate/validate, seed, engine runners) canonical. `docs/` 67 md files
(`frontend/`, `api/`, `superpowers/`); audit docs (`*_AUDIT.md`,
`REMOVED_FEATURES_DEPENDENCY_AUDIT.md`) partially stale post-2.6.0.
`core/api/generated/` (67k-line `openapi.ts` + bridge/validator/schema yml)
canonical contract source — regenerating, not hand-editing.

---

## 3. Dependency relationships (highest-traffic edges)

- `core/organization` ← 64 · `modules/auth` ← 56 · `ApiClient` ← 31 ·
  `core/auth/useCurrentUser` ← 22 · `core/repository` ← 21 · `api/repositories` ← 23 ·
  `shared/workspace` ← 20 · `core/masterData` ← 18 · `useActivityStore` ← 17 ·
  `shared/workspace/canonical` ← 16+ · `components/system/ApiErrorState` ← 6.
- Pages import hooks → services → repositories → factory adapters (one direction, clean).
- Risk edges: `AssetService` imports the `Asset` **type from `@/mocks/db`** —
  mock-as-type-source boundary violation (if mocks ever tree-shaken/renamed,
  production compile breaks). Same pattern likely in other services — verify in Phase 2.
- `TestingPage` → `ApiClient` directly (bypasses repository layer).
- No cycles detected at module level; `shared/views ↔ shared/crud` co-dependency
  (`EntityList/Table` import views; `ProductionView` imports filters only).

---

## 4. Duplicate / overlapping functionality

| # | Overlap | Locations | Verdict |
|---|---------|-----------|---------|
| 1 | `I*Repository` ×6 duplicated | `api/repositories/interfaces/` ↔ `modules/*/repositories/` | Merge to one home (Phase 2) |
| 2 | `PermissionMatrix` ×2 | `components/permissions/` (0 importers, dead) vs `platform/.../OrgStructure/` (1 importer) | Diff, keep one |
| 3 | `BulkActionBar` ×2 | `shared/components/bulk/` (4 importers, live) vs `core/permissions/components/` (0) | Remove dead copy |
| 4 | `entityRegistry` ×2 (functional fork) | `core/workspace/` (workspace chrome, 7) vs `shared/relationships/` (CRUD kit, 4) | **High risk**: unify or version |
| 5 | `WorkspaceHeader` vs `canonical/WorkspaceHeader` | `shared/workspace/` (1 importer) vs `canonical/` (0) | Inverted naming; consolidate |
| 6 | `modules/` vs `features/` duality | dashboard (wrapper+full), organizations (tests-only tree) | Keep wrappers; decide tree ownership |
| 7 | Test trees ×2 for organizations | `features/…/__tests__` vs `src/__tests__/organizations` (dup `OrganizationsPage.test`) | Merge, keep live tree |
| 8 | Tables ×15 hand-built | every list page | Adopt or drop `shared/crud/EntityTable` |
| 9 | Filters hand-rolled per page | `TestingPage`, audit pages, entity lists vs `shared/filters` (1 consumer) | Canonicalize filter state |
| 10 | Fixture sources ×4 | `mocks/db`, MSW `handlers`, adapters, `test/mocks/factories` | Hierarchy: factories→db→adapters; handlers delegate |
| 11 | Endpoint logic ×3 | handlers vs adapters vs `mockRouter` | Single source per endpoint |
| 12 | `timelogs` mock ×2 | `mocks/db/production/` vs `mocks/db/tasks/` | Merge |
| 13 | Permission evaluators ×3 | `usePermissionEvaluator` (9) vs `usePermissions` (5) vs `usePermissionStore` (1) | One API + codemod |
| 14 | Master-data config UIs | org `MasterDataTab/*` vs platform `Platform*Tab` | Compare; share components |
| 15 | Page headers/layouts | `PageLayout` (2 users) vs per-page headers | Adopt or accept |
| 16 | `components/entity/entityConfig.ts` (0) | legacy | Remove after registry check |

---

## 5. Candidate canonical implementations

- Tables/filters/forms: `shared/crud` + `shared/filters` (prove with one pilot page, e.g. `TasksPage`).
- Workspace chrome: `shared/workspace/canonical` (rename, delete non-canonical header).
- Registries: `core/workspace/entityRegistry` (absorb relationship variant behind versioned API).
- Repositories: `api/repositories/interfaces` (single interface home; module repos implement).
- RBAC matrix: diff the two `PermissionMatrix` copies, keep the fuller one under `shared/`.
- Permissions: `usePermissionEvaluator` (widest adoption).
- Dashboard: `features/dashboard` (keep `modules/dashboard` wrapper for route stability).
- Mock data: `mocks/db` (+ `test/mocks/factories` for unit-only builders); endpoint logic in adapters, with MSW handlers delegating instead of re-implementing.

---

## 6. Potentially unused files (verify-then-remove, Phase 2)

`components/permissions/PermissionMatrix.tsx` (0) ·
`components/entity/entityConfig.ts` (0) ·
`core/permissions/components/BulkActionBar.tsx` (0) ·
`shared/workspace/WorkspaceHeader.tsx` (1, via `Workspace.tsx` — check barrel) ·
`shared/workspace/canonical/WorkspaceHeader.tsx` (0) ·
`shared/crud/EntityTable.tsx`, `EntityForm.tsx` (0 direct — keep if pilot adopts) ·
`src/components/ui/{Dialog,Menu,SmartImg}` (verify vs shared equivalents) ·
`features/organizations/__tests__` vs `src/__tests__/organizations` (merge, don't just delete) ·
stale `playwright-report/`, `test-results/`, `dist/` artifacts (untracked/build output — confirm gitignored).

---

## 7. High-risk dependencies

1. **Mock triple-encoding** (handlers/adapters/mockRouter): same auth/scope/filter/pagination rules in 3 places; a scope fix in one leaks in others. Plus `mockAuthGuard` as 4th auth copy.
2. **`entityRegistry` fork**: workspace chrome vs CRUD graph traversal can disagree on entity identity/relations.
3. **Mock-as-type-source** (`services` importing types from `mocks/db`): production compile coupled to mock files.
4. **No code splitting**: 5 MB bundle, every page pays for `TestRunnerEngine` + admin + mocks.
5. **`core/api/generated/openapi.ts` (67k lines)**: hand-edits would silently diverge from `django-openapi.yml`; gate regeneration in CI.
6. **Registry permission metadata** (`routePermissionsRegistry` ~940 lines + `systemRoles` 2k lines): exact-match entries added in 2.6.0; any new canonical tab needs a matching entry or the app-level guard 404s to `/forbidden`.
7. **Dual test trees** for organizations: same pages tested twice with different helpers (`testUtils` vs `renderWithOrgProviders`) — fixes applied to one suite silently rot the other.

---

## 8. Recommended consolidation order (Phase 2+)

1. **Dead-code sweep** (§6 zero-importer files; each verified by test run) — safe, immediate −5–8 files.
2. **Repository interfaces** (#1) + **BulkActionBar** (#3) + **timelogs** (#12) — mechanical merges.
3. **Permission evaluators** (#13) — codemod 5+1 call sites to `usePermissionEvaluator`.
4. **Mock hierarchy** (#10/#11): handlers delegate to adapters; retire `mockRouter` duplication; factories→db rule. Mock-mode suite after each step.
5. **`entityRegistry` unification** (#4) with contract tests pinning both consumer sets.
6. **CRUD/table/filter pilot** (#8/#9 on one page) before repo-wide adoption.
7. **Test-tree merge** (#7) + **modules/features ownership** (#6) + master-data UI compare (#14).
8. **Code splitting** (route-level `lazy()`; mocks/test-engine out of default chunk).

## 9. Estimated file-reduction opportunities

- Dead/mergeable files identified: ~15–20 (zero-importer ×5, dup interfaces ×6, dup tests/tree ×2–4, timelogs ×1, headers ×1, ui dupes ×0–3).
- Duplicated logic (not file-counted): endpoint behavior ×3, tables ×15, filters ×N pages, master-data UIs ×2 sets.
- Biggest win is not file count but **behavioral single-sourcing** (mock paths, registries, tables/filters) plus bundle splitting.

---

## Safe refactoring plan for Phase 2

Principles: one responsibility per phase step; redirects before deletions (proven in 2.6.0);
`surgical` order §8; after **every** step: `vitest run` + `tsc --noEmit` + `biome check src`
(+ `vite build` for structural moves); mock **and** rest boot verification for data-layer steps;
RBAC/org-isolation spot checks for permission/route steps; fresh `FUNCTIONALITY_*`-style
matrix + report docs per step. Stop conditions: any red suite, any forbidden-route regression,
any mock/rest divergence — fix forward in the same step, never carry red into the next.
